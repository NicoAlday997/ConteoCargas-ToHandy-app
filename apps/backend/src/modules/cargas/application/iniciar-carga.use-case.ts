import type { TipoCarga } from '@prisma/client';

import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import type { AsignacionRepository } from './asignacion.repository';
import {
  CargaInicialDuplicadaError,
  type CargaRepository,
  type EventoCarga,
  type SesionConteo,
} from './carga.repository';

/**
 * Caso de uso: el vendedor inicia una carga (inicial o recarga) de SU ruta
 * (RF-12, docs/04 `POST /eventos-carga`).
 *
 * El vendedor no elige ruta: la ruta y la plantilla salen de su asignacion
 * vigente y se copian al evento como SNAPSHOT, de modo que el historial siga
 * mostrando el catalogo correcto aunque despues lo reasignen.
 *
 * Una sola carga INICIAL por ruta y fecha operativa: si se pudieran crear a
 * discrecion, se podrian generar versiones hasta que una pase la verificacion.
 * Las RECARGAS si pueden ser varias por dia.
 *
 * Una RECARGA exige una carga INICIAL de la misma ruta y fecha operativa en
 * estado ENVIADA: `/route/recharge` de Handy le suma producto a una ruta
 * ABIERTA, y esa ruta solo nace cuando la inicial se envia. Una inicial en
 * BORRADOR, esperando contador o autorizacion, o en ERROR_ENVIO todavia no puso
 * nada en Handy, y una CANCELADA tampoco cuenta (`buscarCargaInicialDeFecha`
 * las excluye). Se revisa aqui, al iniciar, y no al enviar: si no, el vendedor
 * y el contador contarian toda la recarga para que Handy la rechace al final,
 * con el camion esperando.
 *
 * La liquidacion de la ruta anterior en Handy NO se revisa aqui: el conteo del
 * vendedor es trabajo fisico que no compromete nada, y a veces hay que cargar
 * un camion antes de que liquide (p. ej. para moverlo en la bodega). El
 * bloqueo vive en la verificacion del contador (`VerificarCortePendienteUseCase`,
 * docs/01 seccion 6 regla 2), que es la que lleva la carga hacia Handy.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaIniciarCarga {
  usuarioAppId: string;
  tipo: TipoCarga;
  /**
   * Id del vendedor en Handy. Viaja en el JWT (docs/04 seccion 1: el token
   * contiene `usuario_handy_id`) y no puede derivarse de la asignacion de ruta,
   * que solo conoce ruta y plantilla.
   */
  usuarioHandyId: number;
  /** Dia para el que sale el camion, elegido por el usuario (ver `domain/fecha-operativa`). */
  fechaOperativa: Date;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `SIN_RUTA_ASIGNADA`: el vendedor no tiene asignacion vigente. Sin ruta no
 *   puede contar; el evento no se crea.
 * - `FECHA_OPERATIVA_INVALIDA`: la fecha es un dia pasado. Nunca se registra
 *   una carga para un dia anterior a hoy.
 * - `YA_TIENE_CARGA_ABIERTA`: ya existe una carga INICIAL de la ruta para esa
 *   fecha operativa (en cualquier estado). Trae su `eventoId` para que la app
 *   ofrezca continuarla en vez de crear otra.
 * - `SIN_SALIDA_ENVIADA`: es una RECARGA y la ruta no tiene carga INICIAL
 *   ENVIADA para esa fecha operativa: en Handy no hay ruta a la que sumarle.
 */
export type ResultadoIniciarCarga =
  | { exito: true; evento: EventoCarga; sesion: SesionConteo }
  | {
      exito: false;
      motivo:
        | 'SIN_RUTA_ASIGNADA'
        | 'FECHA_OPERATIVA_INVALIDA'
        | 'SIN_SALIDA_ENVIADA';
    }
  | { exito: false; motivo: 'YA_TIENE_CARGA_ABIERTA'; eventoId: string };

export class IniciarCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly asignaciones: AsignacionRepository,
  ) {}

  async ejecutar(
    entrada: EntradaIniciarCarga,
    ahora: Date,
  ): Promise<ResultadoIniciarCarga> {
    // 1. Nunca una carga para un dia pasado.
    if (!esFechaOperativaValida(entrada.fechaOperativa, ahora)) {
      return { exito: false, motivo: 'FECHA_OPERATIVA_INVALIDA' };
    }
    const fechaOperativa = normalizarFechaOperativa(entrada.fechaOperativa);

    // 2. La asignacion vigente define ruta y plantilla. Sin ella no hay carga.
    const asignacion = await this.asignaciones.buscarAsignacionVigente(
      entrada.usuarioAppId,
    );
    if (asignacion === null) {
      return { exito: false, motivo: 'SIN_RUTA_ASIGNADA' };
    }

    const inicialDelDia = await this.cargas.buscarCargaInicialDeFecha(
      asignacion.rutaId,
      fechaOperativa,
    );

    // 3. Una sola INICIAL por ruta y fecha operativa.
    if (entrada.tipo === 'INICIAL' && inicialDelDia !== null) {
      return {
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: inicialDelDia.id,
      };
    }

    // 3b. La RECARGA se suma a una salida que ya esta en Handy.
    if (entrada.tipo === 'RECARGA' && inicialDelDia?.estado !== 'ENVIADA') {
      return { exito: false, motivo: 'SIN_SALIDA_ENVIADA' };
    }

    // 4. Evento en BORRADOR. rutaId y plantillaId quedan como snapshot; hoy
    //    todas las rutas operan en AUTOVENTA (docs/02 seccion 3).
    let evento: EventoCarga;
    try {
      evento = await this.cargas.crearEvento({
        rutaId: asignacion.rutaId,
        plantillaId: asignacion.plantillaId,
        tipo: entrada.tipo,
        usuarioHandyId: entrada.usuarioHandyId,
        tipoOperacion: 'AUTOVENTA',
        fechaConteo: ahora,
        fechaOperativa,
      });
    } catch (error) {
      // Carrera: otra solicitud creo la INICIAL entre la consulta y el alta; la
      // base de datos la rechazo por el indice unico. Misma respuesta que arriba.
      if (error instanceof CargaInicialDuplicadaError) {
        const existente = await this.cargas.buscarCargaInicialDeFecha(
          asignacion.rutaId,
          fechaOperativa,
        );
        if (existente !== null) {
          return {
            exito: false,
            motivo: 'YA_TIENE_CARGA_ABIERTA',
            eventoId: existente.id,
          };
        }
      }
      throw error;
    }

    // 5. Sesion del primer conteo. En autoventa el primero siempre es el
    //    vendedor; el contador abrira la suya al verificar.
    const sesion = await this.cargas.crearSesion(
      evento.id,
      'VENDEDOR',
      entrada.usuarioAppId,
    );

    return { exito: true, evento, sesion };
  }
}
