import type { RespuestaEvento } from '../api/cargas';

/**
 * Si la carga que quedó a medias en el teléfono se puede seguir contando.
 * - vigente: el servidor la tiene y la sesión sigue abierta.
 * - no-disponible: se canceló, se borró o la sesión ya se cerró; lo local ya no sirve.
 * - sin-verificar: no hubo respuesta clara (sin señal, error del servidor). Se
 *   deja continuar: contar sin señal es justo para lo que existe la copia local.
 */
export type VigenciaCarga = 'vigente' | 'no-disponible' | 'sin-verificar';

/** `GET /eventos-carga/:id` respondió: ¿sigue abierta la sesión de este teléfono? */
export function vigenciaDesdeEvento(respuesta: RespuestaEvento | null, sesionId: string): VigenciaCarga {
  if (!respuesta?.evento || !Array.isArray(respuesta.sesiones)) return 'sin-verificar';
  // Al cancelar, el servidor cierra las sesiones abiertas; esto cubre igual el caso aunque alguna quedara abierta.
  if (respuesta.evento.estado === 'CANCELADA') return 'no-disponible';
  const sesion = respuesta.sesiones.find((s) => s.id === sesionId);
  return sesion?.estado === 'ABIERTA' ? 'vigente' : 'no-disponible';
}

/**
 * El servidor respondió con error. 404: el evento ya no existe. 403: al
 * vendedor solo se le niega si ya no tiene sesión en él (se la quitaron).
 */
export function vigenciaDesdeEstadoHttp(estado: number): VigenciaCarga {
  return estado === 404 || estado === 403 ? 'no-disponible' : 'sin-verificar';
}
