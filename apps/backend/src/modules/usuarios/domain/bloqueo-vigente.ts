/**
 * Regla pura: si un usuario esta bloqueado por intentos fallidos AHORA, y
 * desde cuando. No conoce Prisma ni HTTP. Ver RF-03 y `politica-acceso.ts`.
 */

import { MINUTOS_BLOQUEO } from '../../auth/domain/politica-acceso';

/** Un bloqueo que sigue corriendo: cuando empezo y cuando se levanta solo. */
export interface BloqueoVigente {
  desde: Date;
  hasta: Date;
}

/**
 * `null` si no hay bloqueo o ya vencio (un `bloqueadoHasta` pasado se queda
 * en la base hasta el siguiente login: no cuenta).
 *
 * `desde` se deduce: el login fija `bloqueadoHasta = momento del bloqueo +
 * MINUTOS_BLOQUEO` y los intentos durante el bloqueo no lo alargan. Si algun
 * dia cambia `MINUTOS_BLOQUEO`, los bloqueos que ya estaban corriendo
 * mostrarian un inicio corrido por la diferencia, nada mas.
 */
export function bloqueoVigente(
  bloqueadoHasta: Date | null,
  ahora: Date,
): BloqueoVigente | null {
  if (bloqueadoHasta === null) return null;
  if (bloqueadoHasta.getTime() <= ahora.getTime()) return null;
  return {
    desde: new Date(bloqueadoHasta.getTime() - MINUTOS_BLOQUEO * 60 * 1000),
    hasta: bloqueadoHasta,
  };
}
