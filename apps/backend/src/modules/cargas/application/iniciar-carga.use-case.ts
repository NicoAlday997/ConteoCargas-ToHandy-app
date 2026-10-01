import type { TipoCarga } from '@prisma/client';

import { HandyGateway } from '../../sincronizacion/application/handy.gateway';
import { esFechaPermitidaPorCalendario } from '../domain/calendario-laboral';
import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import type { AsignacionRepository } from './asignacion.repository';
import { diasNoLaborablesDesde } from './calendario';
import {
  CargaInicialDuplicadaError,
  CargaInicialSinTerminarError,
  type CargaRepository,
  type EventoCarga,
  type SesionConteo,
} from './carga.repository';
import type {
  ConsultasCargaRepository,
  InicialSinTerminar,
} from './consultas-carga.repository';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';
import { sigueAbiertaEnHandy } from './sigue-abierta-en-handy';

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
 * Y una sola INICIAL SIN TERMINAR por ruta, sin importar la fecha: el camion es
 * uno y no puede tener dos salidas colgadas. "Sin terminar" es cualquier estado
 * que no sea ENVIADA ni CANCELADA. Sin esto, una inicial para mañana esperando
 * al contador dejaba abrir otra para hoy porque la fecha era distinta. El
 * vendedor la termina, la cancela o le cambia la fecha antes de empezar otra.
 * Las RECARGAS tampoco entran aqui.
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
 * Y ENVIADA no basta: dice que la inicial salio hacia Handy alguna vez, NO que
 * la ruta siga abierta. Cuando el vendedor liquida, Handy la cierra y nadie nos
 * avisa. Por eso la RECARGA tambien le pregunta a Handy
 * (`consultarRutaAbierta`): debe haber una ruta abierta y debe ser justo la de
 * esa inicial (`idHandy`). Si Handy no se puede consultar no se bloquea al
 * vendedor por la caida de un tercero: pasa con la regla local, y el envio
 * dira la ultima palabra.
 *
 * La fecha operativa sigue el calendario laboral (`domain/calendario-laboral`):
 * el vendedor solo carga para hoy (si hoy se trabaja) o para la siguiente
 * salida, nunca para un domingo, un dia marcado como no laborable ni para
 * dentro de varios dias. Aplica a INICIAL y RECARGA por igual. Este caso de uso
 * es siempre del vendedor (crea SU sesion y parte de SU asignacion), por eso
 * no recibe rol: la regla del supervisor solo existe al mover una carga
 * (`CambiarFechaOperativaUseCase`).
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
 * - `FECHA_NO_DISPONIBLE`: no es hoy-habil ni la siguiente salida segun el
 *   calendario laboral (domingo, dia no laborable o demasiado adelante).
 * - `YA_TIENE_CARGA_ABIERTA`: ya existe una carga INICIAL de la ruta para esa
 *   fecha operativa (en cualquier estado). Trae su `eventoId` para que la app
 *   ofrezca continuarla en vez de crear otra.
 * - `SIN_SALIDA_ENVIADA`: es una RECARGA y la ruta no tiene carga INICIAL
 *   ENVIADA para esa fecha operativa: en Handy no hay ruta a la que sumarle.
 * - `SIN_RUTA_ABIERTA_EN_HANDY`: es una RECARGA, la inicial esta ENVIADA, pero
 *   Handy dice que el vendedor no tiene ruta abierta, o que la abierta es otra
 *   (la inicial ya se liquido o se cancelo alla).
 * - `CARGA_INICIAL_SIN_TERMINAR`: es una INICIAL y la ruta ya tiene otra sin
 *   terminar en OTRA fecha (si es la misma fecha gana `YA_TIENE_CARGA_ABIERTA`,
 *   que deja continuarla). `cargaEnConflicto` dice cual es, para nombrarla;
 *   `null` solo si la base rechazo el alta por carrera y ya no se encontro.
 */
export type ResultadoIniciarCarga =
  | { exito: true; evento: EventoCarga; sesion: SesionConteo }
  | {
      exito: false;
      motivo:
        | 'SIN_RUTA_ASIGNADA'
        | 'FECHA_OPERATIVA_INVALIDA'
        | 'FECHA_NO_DISPONIBLE'
        | 'SIN_SALIDA_ENVIADA'
        | 'SIN_RUTA_ABIERTA_EN_HANDY';
    }
  | { exito: false; motivo: 'YA_TIENE_CARGA_ABIERTA'; eventoId: string }
  | {
      exito: false;
      motivo: 'CARGA_INICIAL_SIN_TERMINAR';
      cargaEnConflicto: InicialSinTerminar | null;
    };

export class IniciarCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly asignaciones: AsignacionRepository,
    private readonly handy: HandyGateway,
    private readonly diasNoLaborables: DiaNoLaborableRepository,
    private readonly consultas: ConsultasCargaRepository,
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

    // 1b. Y solo hoy (si se trabaja) o la siguiente salida.
    const noLaborables = await diasNoLaborablesDesde(this.diasNoLaborables, ahora);
    if (
      !esFechaPermitidaPorCalendario(fechaOperativa, 'VENDEDOR', ahora, noLaborables)
    ) {
      return { exito: false, motivo: 'FECHA_NO_DISPONIBLE' };
    }

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

    // 3a. ...y una sola INICIAL sin terminar por ruta, de la fecha que sea.
    if (entrada.tipo === 'INICIAL') {
      const sinTerminar = await this.consultas.buscarInicialSinTerminarPorRuta(
        asignacion.rutaId,
      );
      if (sinTerminar !== null) {
        return {
          exito: false,
          motivo: 'CARGA_INICIAL_SIN_TERMINAR',
          cargaEnConflicto: sinTerminar,
        };
      }
    }

    // 3b. La RECARGA se suma a una salida que ya esta en Handy.
    if (entrada.tipo === 'RECARGA') {
      if (inicialDelDia?.estado !== 'ENVIADA') {
        return { exito: false, motivo: 'SIN_SALIDA_ENVIADA' };
      }
      // 3c. ...y que esa salida siga ABIERTA en Handy.
      if (
        !(await sigueAbiertaEnHandy(
          this.handy,
          entrada.usuarioHandyId,
          inicialDelDia.idHandy,
        ))
      ) {
        return { exito: false, motivo: 'SIN_RUTA_ABIERTA_EN_HANDY' };
      }
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
      // base de datos la rechazo por uno de los indices unicos. Misma respuesta
      // que arriba, se vuelve a buscar cual estorba: el indice que salto no
      // siempre lo dice (con la misma fecha aplican los dos).
      if (
        error instanceof CargaInicialDuplicadaError ||
        error instanceof CargaInicialSinTerminarError
      ) {
        const delDia = await this.cargas.buscarCargaInicialDeFecha(
          asignacion.rutaId,
          fechaOperativa,
        );
        if (delDia !== null) {
          return {
            exito: false,
            motivo: 'YA_TIENE_CARGA_ABIERTA',
            eventoId: delDia.id,
          };
        }
        const sinTerminar = await this.consultas.buscarInicialSinTerminarPorRuta(
          asignacion.rutaId,
        );
        if (sinTerminar !== null || error instanceof CargaInicialSinTerminarError) {
          // Sin datos (la otra ya termino o se cancelo entretanto) el
          // controlador da el mensaje generico en vez de inventar la fecha.
          return {
            exito: false,
            motivo: 'CARGA_INICIAL_SIN_TERMINAR',
            cargaEnConflicto: sinTerminar,
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
