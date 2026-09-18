/**
 * Reglas de proteccion del panel de administracion (RF-05 .. RF-11). Funciones
 * puras: sin Prisma, sin HTTP, sin NestJS. El unico contacto con
 * `@prisma/client` es el tipo `RolApp`, importado solo como tipo.
 *
 * Objetivo: nada debe poder dejar el sistema sin ningun supervisor activo. Sin
 * un supervisor con acceso, nadie puede volver a entrar al panel de
 * administracion y la unica salida seria una intervencion manual por SQL. Por
 * eso ambas reglas de aqui se aplican SIEMPRE, incluso cuando quien actua es
 * el propio supervisor objetivo (que tampoco puede autogestionarse su acceso).
 */

import type { RolApp } from '@prisma/client';

/** Datos del usuario sobre el que se aplica la accion. */
export interface UsuarioObjetivoPolitica {
  id: string;
  rolApp: RolApp;
  activo: boolean;
}

export type MotivoRechazoPolitica =
  | 'AUTODESACTIVACION_PROHIBIDA'
  | 'AUTOCAMBIO_ROL_PROHIBIDO'
  | 'ULTIMO_SUPERVISOR';

/** Union discriminada por `permitido`. */
export type ResultadoPolitica =
  | { permitido: true }
  | { permitido: false; motivo: MotivoRechazoPolitica };

const PERMITIDO: ResultadoPolitica = { permitido: true };

/**
 * `true` si `objetivo` es el unico supervisor activo del sistema segun el
 * conteo recibido. El conteo lo trae quien llama (viene de una consulta a la
 * base de datos); esta funcion no lo recalcula.
 */
function esUnicoSupervisorActivo(
  objetivo: UsuarioObjetivoPolitica,
  totalSupervisoresActivos: number,
): boolean {
  return (
    objetivo.rolApp === 'SUPERVISOR' &&
    objetivo.activo &&
    totalSupervisoresActivos === 1
  );
}

/**
 * Decide si `actorId` puede desactivar a `objetivo`.
 *
 * - `AUTODESACTIVACION_PROHIBIDA`: nadie se desactiva a si mismo, aunque no
 *   sea el ultimo supervisor (evita bloquearse el acceso por accidente).
 * - `ULTIMO_SUPERVISOR`: el objetivo es el unico supervisor activo. Sin este
 *   bloqueo, el sistema quedaria sin nadie que pueda volver a entrar al panel
 *   de administracion.
 */
export function puedeDesactivar(
  actorId: string,
  objetivo: UsuarioObjetivoPolitica,
  totalSupervisoresActivos: number,
): ResultadoPolitica {
  if (actorId === objetivo.id) {
    return { permitido: false, motivo: 'AUTODESACTIVACION_PROHIBIDA' };
  }
  if (esUnicoSupervisorActivo(objetivo, totalSupervisoresActivos)) {
    return { permitido: false, motivo: 'ULTIMO_SUPERVISOR' };
  }
  return PERMITIDO;
}

/**
 * Decide si `actorId` puede cambiar el rol de `objetivo` a `rolNuevo`.
 *
 * - `AUTOCAMBIO_ROL_PROHIBIDO`: nadie se cambia el rol a si mismo, aunque el
 *   destino siga siendo SUPERVISOR.
 * - `ULTIMO_SUPERVISOR`: el objetivo es el unico supervisor activo y
 *   `rolNuevo` lo saca de SUPERVISOR, dejando el sistema sin nadie con acceso
 *   administrativo.
 */
export function puedeCambiarRol(
  actorId: string,
  objetivo: UsuarioObjetivoPolitica,
  rolNuevo: RolApp,
  totalSupervisoresActivos: number,
): ResultadoPolitica {
  if (actorId === objetivo.id) {
    return { permitido: false, motivo: 'AUTOCAMBIO_ROL_PROHIBIDO' };
  }
  if (
    esUnicoSupervisorActivo(objetivo, totalSupervisoresActivos) &&
    rolNuevo !== 'SUPERVISOR'
  ) {
    return { permitido: false, motivo: 'ULTIMO_SUPERVISOR' };
  }
  return PERMITIDO;
}
