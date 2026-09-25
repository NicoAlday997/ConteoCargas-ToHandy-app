/**
 * Puerto de lectura del catalogo de productos desde el modulo de cargas: lo
 * que el conteo necesita saber de cada producto (factor de empaque y datos
 * para el grid de captura). Solo lectura; el catalogo lo escribe la
 * sincronizacion.
 *
 * Capa de aplicacion: no importa Prisma, HTTP ni NestJS. El adaptador Prisma
 * vive en `infrastructure/`.
 */

import type { ModalidadVenta } from '../domain/conversion-empaque';

/**
 * Factor de empaque de un producto tal como lo necesita el conteo. La
 * modalidad se confirma junto con el factor: sin confirmar no es confiable.
 */
export interface FactorDeConteo {
  modalidadVenta: ModalidadVenta;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
}

/** Producto que la app muestra en el grid de conteo. */
export interface ProductoDeConteo {
  code: string;
  nombre: string;
  unidadCode: string;
  /** Nombre de la unidad en Handy ("Caja", "Cajetilla"): rotula lo que se vende completo. */
  unidadDescripcion: string;
  familia: string | null;
  modalidadVenta: ModalidadVenta;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
}

export abstract class ProductoConteoRepository {
  /**
   * Factor de empaque de los productos indicados. Los codigos que no existen
   * en el catalogo no aparecen en el mapa.
   */
  abstract buscarFactores(
    codes: string[],
  ): Promise<Map<string, FactorDeConteo>>;

  /**
   * Productos ACTIVOS de la plantilla indicada; con `plantillaId === null`,
   * todo el catalogo activo. Sin orden garantizado: ordenar es decision del
   * caso de uso.
   */
  abstract listarActivos(
    plantillaId: string | null,
  ): Promise<ProductoDeConteo[]>;

  /**
   * Productos ACTIVOS con algun conteo en cualquier sesion del evento, esten
   * o no en su plantilla hoy. Sin orden garantizado.
   */
  abstract listarContadosEnEvento(
    eventoId: string,
  ): Promise<ProductoDeConteo[]>;
}
