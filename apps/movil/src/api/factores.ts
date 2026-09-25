import { peticion } from './cliente';

/**
 * Confirmación del empaque de cada producto (docs/04 §1.3). Solo Supervisor.
 * Decide cómo se convierte lo contado en lo que se envía a Handy: por eso
 * nunca se confirma solo con lo que la sincronización leyó del nombre.
 */

export type ModalidadVentaApi = 'COMPLETO' | 'POR_PIEZA';

/** Fila de `GET /admin/sincronizacion/factores-pendientes`. */
export interface FactorPendienteApi {
  code: string | null;
  nombre: string | null;
  familia: string | null;
  /** La guardada hoy, sin confirmar: no se usa para preseleccionar nada. */
  modalidadVenta: ModalidadVentaApi | null;
  /** Leído del nombre (`C/12`); `null` si no trae número. Solo vale si se vende por pieza. */
  piezasPorPaqueteSugerido: number | null;
}

export type ConfirmacionFactor =
  | { modalidadVenta: 'COMPLETO' }
  | { modalidadVenta: 'POR_PIEZA'; piezasPorPaquete: number };

export interface FactorConfirmadoApi {
  code: string | null;
  nombre: string | null;
  modalidadVenta: ModalidadVentaApi | null;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
  /** Cargas aún no enviadas con conteos del producto: quedaron con el empaque anterior. */
  cargasEnCurso: number | null;
}

/** Fila de `GET /admin/sincronizacion/factores`: todo el catálogo activo, confirmado o no. */
export interface FactorCatalogoApi {
  code: string | null;
  nombre: string | null;
  familia: string | null;
  modalidadVenta: ModalidadVentaApi | null;
  /** Confirmado: el que rige (`null` si se vende completo). Sin confirmar: solo la propuesta. */
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
  /** Nombre de quien hizo la última confirmación. */
  confirmadoPor: string | null;
  fechaConfirmacionFactor: string | null;
}

export function listarFactoresPendientes(): Promise<FactorPendienteApi[] | null> {
  return peticion<FactorPendienteApi[] | null>('/admin/sincronizacion/factores-pendientes');
}

export function listarFactores(): Promise<FactorCatalogoApi[] | null> {
  return peticion<FactorCatalogoApi[] | null>('/admin/sincronizacion/factores');
}

/** Cuántas cargas aún no enviadas a Handy tienen conteos del producto. */
export function contarCargasEnCurso(code: string): Promise<{ cargasEnCurso: number | null } | null> {
  return peticion<{ cargasEnCurso: number | null } | null>(
    `/admin/sincronizacion/productos/${encodeURIComponent(code)}/factor/cargas-en-curso`,
  );
}

export function confirmarFactor(code: string, confirmacion: ConfirmacionFactor): Promise<FactorConfirmadoApi | null> {
  return peticion<FactorConfirmadoApi | null>(`/admin/sincronizacion/productos/${encodeURIComponent(code)}/factor`, {
    method: 'PATCH',
    cuerpo: confirmacion,
  });
}
