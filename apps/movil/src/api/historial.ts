import type { TipoCarga } from './cargas';
import { peticion } from './cliente';

/**
 * Historial de cargas (docs/04 §1.5). El alcance lo decide el servidor con el
 * rol del JWT: el vendedor solo recibe las suyas y, con el contador, solo 2
 * semanas. Por eso aquí no hay parámetro de usuario ni de fechas: la app solo
 * pagina.
 */

export type EstadoCargaApi =
  | 'BORRADOR'
  | 'EN_ESPERA_CONTADOR'
  | 'BLOQUEADA_CORTE_PENDIENTE'
  | 'EN_COMPARACION'
  | 'CONFLICTOS_PENDIENTES'
  | 'EN_ESPERA_AUTORIZACION'
  | 'LISTA_PARA_ENVIAR'
  | 'ENVIADA'
  | 'ERROR_ENVIO'
  | 'ENVIO_INCIERTO'
  | 'CANCELADA';

/** Fila de `GET /historial`. */
export interface CargaHistorialApi {
  id: string | null;
  rutaNombre: string | null;
  tipo: TipoCarga | null;
  estado: EstadoCargaApi | null;
  /** Inicio del día para el que sale el camión, en hora de México (ISO 8601). */
  fechaOperativa: string | null;
  fechaConteo: string | null;
  vendedorNombre: string | null;
  contadorNombre: string | null;
  totalProductos: number | null;
  productosConDiscrepancia: number | null;
  autorizada: boolean | null;
  autorizadaPorNombre: string | null;
  /** Solo en CANCELADA: quién, cuándo y por qué. El historial sí muestra las canceladas. */
  canceladaPorNombre?: string | null;
  fechaCancelacion?: string | null;
  motivoCancelacion?: string | null;
}

export interface PaginaHistorialApi {
  items: CargaHistorialApi[] | null;
  total: number | null;
  page: number | null;
  pageSize: number | null;
}

/**
 * Producto de `GET /historial/:id`. Sin discrepancia, `cantidadFinal` es en la
 * que coincidieron ambos conteos y los campos de la discrepancia vienen `null`.
 * Cantidades en piezas.
 */
export interface ProductoConsolidadoApi {
  productoCode: string | null;
  nombre: string | null;
  unidadCode: string | null;
  unidadDescripcion: string | null;
  familia: string | null;
  modalidadVenta: string | null;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
  cantidadFinal: number | null;
  tuvoDiscrepancia: boolean | null;
  cantidadVendedor: number | null;
  cantidadContador: number | null;
  capturadaPorNombre: string | null;
  confirmadaPorNombre: string | null;
}

export interface EventoConsolidadoApi {
  id: string | null;
  rutaNombre: string | null;
  tipo: TipoCarga | null;
  estado: EstadoCargaApi | null;
  fechaOperativa: string | null;
  fechaConteo: string | null;
  vendedorNombre: string | null;
  contadorNombre: string | null;
  autorizada: boolean | null;
  autorizadaPorNombre: string | null;
  canceladaPorNombre?: string | null;
  fechaCancelacion?: string | null;
  motivoCancelacion?: string | null;
}

export interface FamiliaConsolidadaApi {
  familia: string | null;
  productos: ProductoConsolidadoApi[] | null;
}

export interface DetalleHistorialApi {
  evento: EventoConsolidadoApi | null;
  familias: FamiliaConsolidadaApi[] | null;
}

export function listarHistorial(page: number, pageSize: number): Promise<PaginaHistorialApi | null> {
  return peticion<PaginaHistorialApi | null>(`/historial?page=${page}&pageSize=${pageSize}`);
}

export function obtenerDetalleHistorial(eventoId: string): Promise<DetalleHistorialApi | null> {
  return peticion<DetalleHistorialApi | null>(`/historial/${encodeURIComponent(eventoId)}`);
}
