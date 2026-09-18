/**
 * Puerto de lectura del modulo de historial: listado filtrable de cargas ya
 * pasadas por el doble conteo y su vista de detalle consolidada (docs/04
 * seccion 1.5; RF-23, RF-24).
 *
 * Capa de aplicacion: describe QUE se necesita de la persistencia, no COMO. No
 * importa Prisma, HTTP ni NestJS. El adaptador Prisma vive en `infrastructure/`.
 *
 * Los enums de `@prisma/client` se importan SOLO como tipo (mismo criterio que
 * `modules/cargas/application/carga.repository`).
 */

import type { EstadoCarga, TipoCarga } from '@prisma/client';

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

/** Fila del listado de historial: una carga con sus metricas ya calculadas. */
export interface CargaHistorial {
  id: string;
  rutaNombre: string;
  tipo: TipoCarga;
  estado: EstadoCarga;
  fechaConteo: Date | null;
  /** `null` si esa sesion (vendedor o contador) aun no existe para el evento. */
  vendedorNombre: string | null;
  contadorNombre: string | null;
  /** Union de productos capturados entre el conteo del vendedor y el del contador. */
  totalProductos: number;
  /** Cantidad de productos que tuvieron discrepancia (resuelta o no). */
  productosConDiscrepancia: number;
  autorizada: boolean;
  /** Nombre del supervisor que autorizo el envio; `null` si aun no se autoriza. */
  autorizadaPorNombre: string | null;
}

/**
 * Filtros ya normalizados (`page`/`pageSize` siempre resueltos) que el caso de
 * uso `ConsultarHistorialUseCase` pasa al puerto. Un campo `undefined` significa
 * "no filtrar por esto".
 */
export interface FiltrosHistorial {
  rutaId?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  estado?: EstadoCarga;
  conDiscrepancia?: boolean;
  tipo?: TipoCarga;
  page: number;
  pageSize: number;
}

export interface PaginaCargas {
  items: CargaHistorial[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Vista de detalle (carga consolidada)
// ---------------------------------------------------------------------------

/**
 * Un producto dentro de la vista de detalle. Cuando `tuvoDiscrepancia` es
 * `false`, `cantidadFinal` es la cantidad en la que coincidieron ambos conteos
 * y `cantidadVendedor`/`cantidadContador`/`capturadaPorNombre`/
 * `confirmadaPorNombre` quedan en `null` (no aplica, no hubo conflicto que
 * capturar ni confirmar).
 */
export interface ProductoConsolidado {
  productoCode: string;
  nombre: string;
  unidadCode: string;
  familia: string | null;
  /**
   * `null` solo es posible cuando `tuvoDiscrepancia` es `true` y todavia nadie
   * capturo la cantidad final acordada.
   */
  cantidadFinal: number | null;
  tuvoDiscrepancia: boolean;
  cantidadVendedor: number | null;
  cantidadContador: number | null;
  capturadaPorNombre: string | null;
  confirmadaPorNombre: string | null;
}

export interface EventoConsolidado {
  id: string;
  rutaNombre: string;
  tipo: TipoCarga;
  estado: EstadoCarga;
  fechaConteo: Date | null;
  vendedorNombre: string | null;
  contadorNombre: string | null;
  autorizada: boolean;
  autorizadaPorNombre: string | null;
}

/**
 * Vista de detalle SIN agrupar: la agrupacion por familia es responsabilidad
 * de `VerCargaConsolidadaUseCase`, no del puerto de persistencia.
 */
export interface CargaConsolidada {
  evento: EventoConsolidado;
  productos: ProductoConsolidado[];
}

// ---------------------------------------------------------------------------
// Puerto
// ---------------------------------------------------------------------------

export abstract class HistorialRepository {
  abstract listarCargas(filtros: FiltrosHistorial): Promise<PaginaCargas>;

  /** `null` si no existe un `EventoCarga` con ese id. */
  abstract obtenerCargaConsolidada(
    eventoId: string,
  ): Promise<CargaConsolidada | null>;
}
