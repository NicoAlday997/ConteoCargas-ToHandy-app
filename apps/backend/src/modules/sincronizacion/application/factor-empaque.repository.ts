import type { ModalidadVenta } from '../domain/factor-empaque';

/**
 * Puerto de persistencia del factor de empaque (piezas por paquete) de cada
 * producto. Ver `domain/factor-empaque.ts` para el porque del factor y de su
 * confirmacion obligatoria. El adaptador Prisma vive en `infrastructure/`.
 */

/** Estado del factor guardado para un producto que ya existe en el cache. */
export interface FactorGuardado {
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
}

/** Producto activo cuyo factor aun no confirma un supervisor. */
export interface FactorPendiente {
  code: string;
  nombre: string;
  familia: string | null;
  /** Modalidad guardada hoy (sin confirmar: solo el default o la anterior). */
  modalidadVenta: ModalidadVenta;
  /**
   * Valor propuesto por la sincronizacion; `null` si el nombre no lo trae.
   * Solo aplica si el supervisor responde que se vende POR_PIEZA.
   */
  piezasPorPaqueteSugerido: number | null;
}

/** Factor de un producto tal como queda tras confirmarlo. */
export interface FactorProducto {
  code: string;
  nombre: string;
  modalidadVenta: ModalidadVenta;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
  factorConfirmadoPorId: string | null;
  fechaConfirmacionFactor: Date | null;
}

export interface DatosConfirmarFactor {
  productoCode: string;
  modalidadVenta: ModalidadVenta;
  /** `null` si se vende COMPLETO: ahi el paquete no tiene factor. */
  piezasPorPaquete: number | null;
  confirmadoPorId: string;
  fecha: Date;
}

export abstract class FactorEmpaqueRepository {
  /**
   * Estado del factor de los productos indicados. Los codigos que aun no
   * existen en el cache no aparecen en el mapa.
   */
  abstract buscarFactores(
    codes: string[],
  ): Promise<Map<string, FactorGuardado>>;

  /** Productos activos sin factor confirmado, ordenados por nombre. */
  abstract listarPendientes(): Promise<FactorPendiente[]>;

  /** Cuantos productos activos no tienen el factor confirmado. */
  abstract contarPendientes(): Promise<number>;

  /** Factor actual del producto, o `null` si el producto no existe. */
  abstract buscarPorCode(code: string): Promise<FactorProducto | null>;

  /** Guarda el factor como confirmado, con quien y cuando lo confirmo. */
  abstract confirmar(datos: DatosConfirmarFactor): Promise<FactorProducto>;
}
