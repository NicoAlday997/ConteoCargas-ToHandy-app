import type { MovimientoAcceso } from './admin-usuario.repository';

/**
 * Del mas reciente al mas antiguo; a igual fecha, por id descendente para que
 * el orden sea estable entre paginas.
 */
function masRecientePrimero(a: MovimientoAcceso, b: MovimientoAcceso): number {
  const porFecha = b.fecha.getTime() - a.fecha.getTime();
  if (porFecha !== 0) return porFecha;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Intercala dos listas de movimientos y devuelve los de la pagina pedida.
 *
 * Paginar sobre dos tablas a la vez sin SQL a mano: cada lista debe traer los
 * `page * pageSize` mas recientes de su tabla, ya ordenados igual. Los
 * renglones de la pagina `page` estan forzosamente entre esos, asi que basta
 * mezclarlos y recortar.
 */
export function intercalarAccesos(
  restablecimientos: readonly MovimientoAcceso[],
  desbloqueos: readonly MovimientoAcceso[],
  page: number,
  pageSize: number,
): MovimientoAcceso[] {
  return [...restablecimientos, ...desbloqueos]
    .sort(masRecientePrimero)
    .slice((page - 1) * pageSize, page * pageSize);
}
