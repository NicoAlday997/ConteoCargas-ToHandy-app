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
  | 'ENVIO_INCIERTO';

/**
 * La carga inicial arrancó con la ruta anterior del vendedor sin liquidar en
 * Handy, con permiso del supervisor.
 */
export interface InicioSinLiquidarApi {
  rutaHandyId: string | null;
  permisoOtorgadoPorNombre: string | null;
  permisoMotivo: string | null;
}

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
  inicioSinLiquidar?: InicioSinLiquidarApi | null;
  liquidacionNoVerificada?: boolean | null;
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
  familia: string | null;
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
  inicioSinLiquidar?: InicioSinLiquidarApi | null;
  liquidacionNoVerificada?: boolean | null;
}

export interface FamiliaConsolidadaApi {
  familia: string | null;
  productos: ProductoConsolidadoApi[] | null;
}

export interface DetalleHistorialApi {
  evento: EventoConsolidadoApi | null;
  familias: FamiliaConsolidadaApi[] | null;
}

export interface FiltrosHistorialApp {
  /** Solo las cargas iniciadas con la ruta anterior sin liquidar. */
  sinLiquidar?: boolean;
  /** `aaaa-mm-dd`, sobre la fecha operativa. Para el vendedor y el contador el servidor recorta a 2 semanas. */
  fechaInicio?: string;
}

export function listarHistorial(
  page: number,
  pageSize: number,
  filtros: FiltrosHistorialApp = {},
): Promise<PaginaHistorialApi | null> {
  const query = [`page=${page}`, `pageSize=${pageSize}`];
  if (filtros.sinLiquidar) query.push('sinLiquidar=true');
  if (filtros.fechaInicio) query.push(`fechaInicio=${encodeURIComponent(filtros.fechaInicio)}`);
  return peticion<PaginaHistorialApi | null>(`/historial?${query.join('&')}`);
}

export function obtenerDetalleHistorial(eventoId: string): Promise<DetalleHistorialApi | null> {
  return peticion<DetalleHistorialApi | null>(`/historial/${encodeURIComponent(eventoId)}`);
}
