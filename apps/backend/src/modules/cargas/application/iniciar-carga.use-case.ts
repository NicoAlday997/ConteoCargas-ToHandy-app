import type { TipoCarga } from '@prisma/client';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
} from '../../sincronizacion/application/handy.gateway';
import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import type { AsignacionRepository } from './asignacion.repository';
import {
  CargaInicialDuplicadaError,
  PermisoCargaNoDisponibleError,
  type CargaRepository,
  type DatosCrearEvento,
  type EventoCarga,
  type SesionConteo,
} from './carga.repository';
import type { PermisoCargaRepository } from './permiso-carga.repository';

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
 * Ademas, una INICIAL no arranca si el vendedor tiene la ruta anterior sin
 * liquidar en Handy (`consultarRutaAbierta`): mientras el camion no regrese y
 * se liquide no hay nada que cargar para el dia siguiente. Excepcion: un
 * permiso puntual del supervisor (`PermisoCargaSinLiquidar`, 24 h, un solo
 * uso), que se consume al crear el evento. Si Handy no responde, NO se bloquea
 * (detendria la bodega): la carga arranca marcada `liquidacionNoVerificada`.
 * Las dos reglas conviven; las RECARGAS no pasan por ninguna.
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
 * - `RUTA_ANTERIOR_SIN_LIQUIDAR`: el vendedor tiene una ruta abierta en Handy y
 *   no hay permiso vigente del supervisor para la ruta. Trae el id de esa ruta
 *   en Handy.
 */
export type ResultadoIniciarCarga =
  | { exito: true; evento: EventoCarga; sesion: SesionConteo }
  | { exito: false; motivo: 'SIN_RUTA_ASIGNADA' | 'FECHA_OPERATIVA_INVALIDA' }
  | { exito: false; motivo: 'YA_TIENE_CARGA_ABIERTA'; eventoId: string }
  | { exito: false; motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR'; rutaHandyId: string };

/** Lo que la verificacion de liquidacion agrega al alta del evento. */
type DatosLiquidacion = Pick<
  DatosCrearEvento,
  'permisoSinLiquidar' | 'liquidacionNoVerificada'
>;

type VerificacionLiquidacion =
  | { permitido: true; datos: DatosLiquidacion }
  | { permitido: false; rutaHandyId: string };

/**
 * Fallos de Handy que significan "no se pudo verificar", no "hay ruta
 * abierta". Cualquier otro error es un defecto propio y se propaga.
 */
function esFalloDeHandy(error: unknown): boolean {
  return (
    error instanceof HandySinRespuestaError ||
    error instanceof HandyErrorServidorError ||
    error instanceof HandyTokenInvalidoError ||
    error instanceof HandyRespuestaNoOkError
  );
}

export class IniciarCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly asignaciones: AsignacionRepository,
    private readonly handy: HandyGateway,
    private readonly permisos: PermisoCargaRepository,
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

    // 3. Una sola INICIAL por ruta y fecha operativa. Va antes de consultar
    //    Handy: si ya existe, la app ofrece continuarla aunque haya ruta sin
    //    liquidar.
    let datosLiquidacion: DatosLiquidacion = {};
    if (entrada.tipo === 'INICIAL') {
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

      // 4. La ruta anterior del vendedor debe estar liquidada en Handy, salvo
      //    permiso vigente del supervisor.
      const verificacion = await this.verificarLiquidacion(
        asignacion.rutaId,
        entrada.usuarioHandyId,
        ahora,
      );
      if (!verificacion.permitido) {
        return {
          exito: false,
          motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR',
          rutaHandyId: verificacion.rutaHandyId,
        };
      }
      datosLiquidacion = verificacion.datos;
    }

    // 5. Evento en BORRADOR. rutaId y plantillaId quedan como snapshot; hoy
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
        ...datosLiquidacion,
      });
    } catch (error) {
      // Otra solicitud gasto el permiso (o vencio) entre la consulta y el alta:
      // sin permiso, la ruta sin liquidar vuelve a bloquear.
      if (
        error instanceof PermisoCargaNoDisponibleError &&
        datosLiquidacion.permisoSinLiquidar !== undefined
      ) {
        return {
          exito: false,
          motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR',
          rutaHandyId: datosLiquidacion.permisoSinLiquidar.rutaHandyId,
        };
      }
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

    // 6. Sesion del primer conteo. En autoventa el primero siempre es el
    //    vendedor; el contador abrira la suya al verificar.
    const sesion = await this.cargas.crearSesion(
      evento.id,
      'VENDEDOR',
      entrada.usuarioAppId,
    );

    return { exito: true, evento, sesion };
  }

  /**
   * Sin ruta abierta en Handy: procede. Con ruta abierta: solo con un permiso
   * vigente de la ruta, que se consumira al crear el evento. Si Handy no
   * responde: procede, marcado como no verificado.
   */
  private async verificarLiquidacion(
    rutaId: string,
    usuarioHandyId: number,
    ahora: Date,
  ): Promise<VerificacionLiquidacion> {
    let rutaAbierta;
    try {
      rutaAbierta = await this.handy.consultarRutaAbierta(usuarioHandyId);
    } catch (error) {
      if (esFalloDeHandy(error)) {
        return { permitido: true, datos: { liquidacionNoVerificada: true } };
      }
      throw error;
    }
    if (rutaAbierta === null) {
      return { permitido: true, datos: {} };
    }

    const permiso = await this.permisos.buscarVigente(rutaId, ahora);
    if (permiso === null) {
      return { permitido: false, rutaHandyId: rutaAbierta.id };
    }
    return {
      permitido: true,
      datos: {
        permisoSinLiquidar: {
          permisoId: permiso.id,
          rutaHandyId: rutaAbierta.id,
        },
      },
    };
  }
}
