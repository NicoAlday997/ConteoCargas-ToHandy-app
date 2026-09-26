import type { RolApp } from '@prisma/client';

import {
  permiteCancelacionDelSupervisor,
  permiteCancelacionDelVendedor,
  puedeTransicionar,
} from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: cancelar una carga que no se envio a Handy (fecha o ruta
 * equivocada, abierta sin querer). Nunca se borra el evento: queda en
 * `CANCELADA` con quien, cuando y por que, y sigue visible en el historial.
 *
 * Reglas por rol:
 * - VENDEDOR: solo su propia carga (el `usuarioHandyId` del evento contra el
 *   del JWT) y solo en BORRADOR (`permiteCancelacionDelVendedor`). Motivo
 *   opcional. Despues de BORRADOR el contador puede estar contando: dejarlo
 *   cancelar ahi le daria una salida cuando el conteo no le cuadra.
 * - SUPERVISOR: cualquier carga, si `permiteCancelacionDelSupervisor`. Motivo
 *   OBLIGATORIO (minimo `MOTIVO_MINIMO_SUPERVISOR` caracteres): si cancela
 *   trabajo de otros, tiene que quedar escrito por que.
 * - CONTADOR: nunca.
 *
 * Una carga ENVIADA no se cancela por aqui: primero hay que cancelarla en
 * Handy (`CancelarRutaHandyUseCase`).
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Largo minimo del motivo cuando cancela un supervisor. */
export const MOTIVO_MINIMO_SUPERVISOR = 5;

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaCancelarCarga {
  eventoId: string;
  usuarioAppId: string;
  rolApp: RolApp;
  /** Del JWT; solo el vendedor lo tiene. Decide si la carga es suya. */
  usuarioHandyId: number | null;
  motivo?: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * Motivos de rechazo:
 * - `NO_ENCONTRADA`: el evento no existe.
 * - `NO_PERMITIDO`: contador, o vendedor sobre una carga que no es suya.
 * - `ESTADO_INVALIDO`: el estado no admite cancelacion para ese rol.
 * - `MOTIVO_REQUERIDO`: supervisor sin motivo o con uno demasiado corto.
 */
export type ResultadoCancelarCarga =
  | { exito: true; evento: EventoCarga }
  | {
      exito: false;
      motivo:
        | 'NO_ENCONTRADA'
        | 'NO_PERMITIDO'
        | 'ESTADO_INVALIDO'
        | 'MOTIVO_REQUERIDO';
    };

/** Motivo sin espacios sobrantes; `null` si viene vacio. */
export function normalizarMotivo(motivo: string | undefined): string | null {
  const limpio = motivo?.trim() ?? '';
  return limpio === '' ? null : limpio;
}

export class CancelarCargaUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    entrada: EntradaCancelarCarga,
    ahora: Date,
  ): Promise<ResultadoCancelarCarga> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'NO_ENCONTRADA' };
    }

    const motivo = normalizarMotivo(entrada.motivo);

    switch (entrada.rolApp) {
      case 'VENDEDOR':
        if (
          entrada.usuarioHandyId === null ||
          evento.usuarioHandyId !== entrada.usuarioHandyId
        ) {
          return { exito: false, motivo: 'NO_PERMITIDO' };
        }
        if (!permiteCancelacionDelVendedor(evento.estado)) {
          return { exito: false, motivo: 'ESTADO_INVALIDO' };
        }
        break;
      case 'SUPERVISOR':
        if (!permiteCancelacionDelSupervisor(evento.estado)) {
          return { exito: false, motivo: 'ESTADO_INVALIDO' };
        }
        if (motivo === null || motivo.length < MOTIVO_MINIMO_SUPERVISOR) {
          return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
        }
        break;
      default:
        // CONTADOR (y cualquier rol futuro): no cancela.
        return { exito: false, motivo: 'NO_PERMITIDO' };
    }

    // La transicion siempre se valida contra la maquina de estados del
    // dominio antes de persistir, mismo criterio que el resto del modulo.
    if (!puedeTransicionar(evento.estado, 'CANCELADA')) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    const cancelado = await this.cargas.cancelarEvento(
      entrada.eventoId,
      entrada.usuarioAppId,
      motivo,
      ahora,
    );
    return { exito: true, evento: cancelado };
  }
}
