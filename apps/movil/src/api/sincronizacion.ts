import { peticion } from './cliente';

/**
 * Sincronización con Handy (docs/04 §1.3). Solo Supervisor. La app nunca habla
 * con Handy: pide al backend que sincronice y le pregunta cómo quedó.
 */

/** Qué cambió, no cuántos se procesaron. */
export interface CambiosApi {
  nuevos: number | null;
  actualizados: number | null;
  desactivados: number | null;
}

/** Respuesta de `POST /admin/sincronizacion`. */
export interface ResultadoSincronizacionApi {
  productos: (CambiosApi & { sinConfirmarEmpaque: number | null }) | null;
  /** `null` si los productos pasaron pero los vendedores fallaron. */
  vendedores: CambiosApi | null;
  /** Solo cuando `vendedores` es `null`: el motivo, en palabras. */
  errorVendedores?: string | null;
  sincronizadoEn: string | null;
}

/** Respuesta de `GET /admin/sincronizacion/estado`. */
export interface EstadoSincronizacionApi {
  /** ISO 8601; `null` si nunca se ha sincronizado. */
  ultimaSincronizacion: string | null;
  productosActivos: number | null;
  vendedoresActivos: number | null;
  sinConfirmarEmpaque: number | null;
}

/** Puede tardar varios segundos (varias páginas contra Handy): sin tiempo límite corto. */
export function sincronizarConHandy(): Promise<ResultadoSincronizacionApi | null> {
  return peticion<ResultadoSincronizacionApi | null>('/admin/sincronizacion', { method: 'POST' });
}

export function consultarEstadoSincronizacion(): Promise<EstadoSincronizacionApi | null> {
  return peticion<EstadoSincronizacionApi | null>('/admin/sincronizacion/estado');
}
