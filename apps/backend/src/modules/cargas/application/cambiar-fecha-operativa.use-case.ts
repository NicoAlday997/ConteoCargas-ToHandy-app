import type { RolApp } from '@prisma/client';

import { HandyGateway } from '../../sincronizacion/application/handy.gateway';
import { esFechaPermitidaPorCalendario } from '../domain/calendario-laboral';
import {
  permiteCambioFechaDelSupervisor,
  permiteCambioFechaDelVendedor,
} from '../domain/estados-carga';
import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import {
  MOTIVO_MINIMO_SUPERVISOR,
  normalizarMotivo,
} from './cancelar-carga.use-case';
import { diasNoLaborablesDesde } from './calendario';
import {
  CargaInicialDuplicadaError,
  type CargaRepository,
  type EventoCarga,
} from './carga.repository';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';
import { sigueAbiertaEnHandy } from './sigue-abierta-en-handy';

/**
 * Caso de uso: mover una carga a otra fecha operativa sin perder lo contado
 * (docs/04 `PATCH /eventos-carga/:id/fecha-operativa`). Si el vendedor se
 * equivoco de dia, cancelar le haria perder todo el conteo, y no hace falta:
 * los items cuelgan de la sesion de conteo, no de la fecha. Aqui solo cambia
 * `fechaOperativa` y queda un renglon en la bitacora de cambios de fecha.
 *
 * Reglas por rol:
 * - VENDEDOR: solo su propia carga (el `usuarioHandyId` del evento contra el
 *   del JWT) y solo en BORRADOR (`permiteCambioFechaDelVendedor`). Motivo
 *   opcional. Si pudiera mover la fecha despues de que el contador conto,
 *   tendria una escapatoria cuando el conteo no le cuadra; es la misma razon
 *   por la que solo puede cancelar en BORRADOR.
 * - SUPERVISOR: cualquier estado salvo ENVIADA, CANCELADA y ENVIO_INCIERTO
 *   (`permiteCambioFechaDelSupervisor`). Motivo OBLIGATORIO (minimo
 *   `MOTIVO_MINIMO_SUPERVISOR` caracteres), mismo criterio que al cancelar.
 * - CONTADOR: nunca.
 *
 * Reglas de la fecha nueva (las mismas que al iniciar la carga):
 * - Nunca un dia pasado (`esFechaOperativaValida`), y distinta de la actual.
 * - Calendario laboral (`esFechaPermitidaPorCalendario`): el VENDEDOR solo a
 *   hoy (si se trabaja) o a la siguiente salida; el SUPERVISOR a cualquier dia
 *   HABIL, para recorrer cargas cuando no se trabajo un dia. Nunca a un
 *   domingo ni a un dia marcado como no laborable.
 * - INICIAL: no puede haber otra INICIAL no cancelada de la ruta ese dia. El
 *   indice parcial lo impediria de todos modos; se revisa antes para responder
 *   con un motivo claro (y la carrera se atrapa igual que en
 *   `IniciarCargaUseCase`).
 * - RECARGA: el dia nuevo debe tener una INICIAL ENVIADA de la ruta, y esa
 *   debe ser la ruta que Handy tiene abierta (si Handy no responde se pasa con
 *   la regla local, igual que al iniciar).
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaCambiarFechaOperativa {
  eventoId: string;
  usuarioAppId: string;
  rolApp: RolApp;
  /** Del JWT; solo el vendedor lo tiene. Decide si la carga es suya. */
  usuarioHandyId: number | null;
  fechaOperativa: Date;
  motivo?: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * Motivos de rechazo:
 * - `NO_ENCONTRADA`: el evento no existe.
 * - `NO_PERMITIDO`: contador, o vendedor sobre una carga que no es suya.
 * - `ESTADO_INVALIDO`: el estado no admite cambio de fecha para ese rol.
 * - `MOTIVO_REQUERIDO`: supervisor sin motivo o con uno demasiado corto.
 * - `FECHA_OPERATIVA_INVALIDA`: la fecha nueva es un dia pasado.
 * - `FECHA_NO_DISPONIBLE`: el calendario laboral no la permite para ese rol.
 * - `MISMA_FECHA`: la fecha nueva es la que ya tiene.
 * - `YA_TIENE_CARGA_ABIERTA`: es INICIAL y la ruta ya tiene otra INICIAL ese
 *   dia; trae su `eventoId`.
 * - `SIN_SALIDA_ENVIADA` / `SIN_RUTA_ABIERTA_EN_HANDY`: es RECARGA y el dia
 *   nuevo no cumple la regla de recargas (mismos motivos que al iniciar).
 */
export type ResultadoCambiarFechaOperativa =
  | { exito: true; evento: EventoCarga }
  | {
      exito: false;
      motivo:
        | 'NO_ENCONTRADA'
        | 'NO_PERMITIDO'
        | 'ESTADO_INVALIDO'
        | 'MOTIVO_REQUERIDO'
        | 'FECHA_OPERATIVA_INVALIDA'
        | 'FECHA_NO_DISPONIBLE'
        | 'MISMA_FECHA'
        | 'SIN_SALIDA_ENVIADA'
        | 'SIN_RUTA_ABIERTA_EN_HANDY';
    }
  | { exito: false; motivo: 'YA_TIENE_CARGA_ABIERTA'; eventoId: string };

export class CambiarFechaOperativaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly handy: HandyGateway,
    private readonly diasNoLaborables: DiaNoLaborableRepository,
  ) {}

  async ejecutar(
    entrada: EntradaCambiarFechaOperativa,
    ahora: Date,
  ): Promise<ResultadoCambiarFechaOperativa> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'NO_ENCONTRADA' };
    }

    const motivo = normalizarMotivo(entrada.motivo);

    // 1. Quien puede y en que estado.
    switch (entrada.rolApp) {
      case 'VENDEDOR':
        if (
          entrada.usuarioHandyId === null ||
          evento.usuarioHandyId !== entrada.usuarioHandyId
        ) {
          return { exito: false, motivo: 'NO_PERMITIDO' };
        }
        if (!permiteCambioFechaDelVendedor(evento.estado)) {
          return { exito: false, motivo: 'ESTADO_INVALIDO' };
        }
        break;
      case 'SUPERVISOR':
        if (!permiteCambioFechaDelSupervisor(evento.estado)) {
          return { exito: false, motivo: 'ESTADO_INVALIDO' };
        }
        if (motivo === null || motivo.length < MOTIVO_MINIMO_SUPERVISOR) {
          return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
        }
        break;
      default:
        // CONTADOR (y cualquier rol futuro): no cambia fechas.
        return { exito: false, motivo: 'NO_PERMITIDO' };
    }

    // 2. La fecha nueva: nunca un dia pasado, y distinta de la actual.
    if (!esFechaOperativaValida(entrada.fechaOperativa, ahora)) {
      return { exito: false, motivo: 'FECHA_OPERATIVA_INVALIDA' };
    }
    const fechaNueva = normalizarFechaOperativa(entrada.fechaOperativa);
    if (
      fechaNueva.getTime() ===
      normalizarFechaOperativa(evento.fechaOperativa).getTime()
    ) {
      return { exito: false, motivo: 'MISMA_FECHA' };
    }

    // 2b. Calendario laboral: hasta aqui solo llegan VENDEDOR y SUPERVISOR.
    const noLaborables = await diasNoLaborablesDesde(
      this.diasNoLaborables,
      ahora,
      fechaNueva,
    );
    if (
      !esFechaPermitidaPorCalendario(
        fechaNueva,
        entrada.rolApp === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR',
        ahora,
        noLaborables,
      )
    ) {
      return { exito: false, motivo: 'FECHA_NO_DISPONIBLE' };
    }

    // 3. Las reglas del dia nuevo segun el tipo, las mismas que al iniciar.
    const inicialDelDia = await this.cargas.buscarCargaInicialDeFecha(
      evento.rutaId,
      fechaNueva,
    );
    if (evento.tipo === 'INICIAL' && inicialDelDia !== null) {
      return {
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: inicialDelDia.id,
      };
    }
    if (evento.tipo === 'RECARGA') {
      if (inicialDelDia?.estado !== 'ENVIADA') {
        return { exito: false, motivo: 'SIN_SALIDA_ENVIADA' };
      }
      if (
        !(await sigueAbiertaEnHandy(
          this.handy,
          evento.usuarioHandyId,
          inicialDelDia.idHandy,
        ))
      ) {
        return { exito: false, motivo: 'SIN_RUTA_ABIERTA_EN_HANDY' };
      }
    }

    // 4. Evento + bitacora en una transaccion. Sesiones e items no se tocan.
    try {
      const actualizado = await this.cargas.cambiarFechaOperativa({
        eventoId: evento.id,
        fechaAnterior: evento.fechaOperativa,
        fechaNueva,
        cambiadaPorId: entrada.usuarioAppId,
        motivo,
      });
      return { exito: true, evento: actualizado };
    } catch (error) {
      // Carrera: otra INICIAL se creo ese dia entre la consulta y el cambio.
      if (error instanceof CargaInicialDuplicadaError) {
        const existente = await this.cargas.buscarCargaInicialDeFecha(
          evento.rutaId,
          fechaNueva,
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
  }
}
