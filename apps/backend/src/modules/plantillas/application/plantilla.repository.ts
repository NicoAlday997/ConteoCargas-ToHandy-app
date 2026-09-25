/**
 * Puerto de persistencia de la administracion de plantillas de carga
 * (`PlantillaCarga`, `PlantillaProducto` y la `plantillaId` de
 * `AsignacionRutaVendedor` en el esquema).
 *
 * "Asignacion vigente" = `vigenteHasta` en `null`. Una ruta puede tener mas de
 * una (varios vendedores comparten ruta); la plantilla de la ruta es la de sus
 * asignaciones vigentes.
 *
 * Capa de aplicacion: describe QUE se necesita, no COMO. El adaptador Prisma
 * vive en `infrastructure/`.
 */

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  creadaEn: Date;
  actualizadaEn: Date;
}

export interface RutaDePlantilla {
  id: string;
  nombre: string;
  codigo: string;
}

/** Fila de la lista de plantillas. */
export interface ResumenPlantilla extends Plantilla {
  totalProductos: number;
  /** Rutas con alguna asignacion vigente que usa la plantilla, sin repetir. */
  rutas: RutaDePlantilla[];
}

export type ModalidadVentaPlantilla = 'COMPLETO' | 'POR_PIEZA';

/** Un producto de la plantilla con lo que el supervisor necesita para decidir si va. */
export interface ProductoDePlantilla {
  code: string;
  nombre: string;
  familia: string | null;
  modalidadVenta: ModalidadVentaPlantilla;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
  /** Desactivado en Handy: sigue en la plantilla pero el grid de conteo no lo muestra. */
  activo: boolean;
}

/** Una ruta activa con lo que tiene asignado hoy, para reasignar plantillas. */
export interface RutaConPlantilla extends RutaDePlantilla {
  /** Vendedores con asignacion vigente; vacio = la ruta no tiene a quien asignarle plantilla. */
  vendedores: string[];
  /** Plantillas de sus asignaciones vigentes (normalmente una), sin repetir. */
  plantillas: Array<{ id: string; nombre: string }>;
  /** Alguna asignacion vigente sin plantilla: ese vendedor ve el catalogo completo. */
  sinPlantilla: boolean;
}

export interface DatosCrearPlantilla {
  nombre: string;
  descripcion: string | null;
}

/** Campos editables; `undefined` = no tocar. `descripcion: null` la borra. */
export interface DatosActualizarPlantilla {
  nombre?: string;
  descripcion?: string | null;
  activa?: boolean;
}

export abstract class PlantillaRepository {
  /** Con `incluirInactivas` en `false`, solo las activas. Orden por nombre. */
  abstract listar(incluirInactivas: boolean): Promise<ResumenPlantilla[]>;
  abstract buscarPorId(id: string): Promise<Plantilla | null>;
  /** Todos los nombres, para detectar duplicados (activas e inactivas). */
  abstract listarNombres(): Promise<Array<{ id: string; nombre: string }>>;
  /** Productos de la plantilla, activos o no. Sin orden garantizado. */
  abstract listarProductos(plantillaId: string): Promise<ProductoDePlantilla[]>;
  abstract listarRutasVigentes(plantillaId: string): Promise<RutaDePlantilla[]>;
  abstract crear(datos: DatosCrearPlantilla): Promise<Plantilla>;
  abstract actualizar(
    id: string,
    datos: DatosActualizarPlantilla,
  ): Promise<Plantilla>;

  /** De los codigos dados, los que existen en el catalogo. */
  abstract buscarCodigosExistentes(codes: string[]): Promise<Set<string>>;
  /** Agrega los que falten; los que ya estaban se ignoran. Devuelve cuantos se agregaron. */
  abstract agregarProductos(
    plantillaId: string,
    codes: string[],
  ): Promise<number>;
  /** Quita los que esten; los demas se ignoran. Devuelve cuantos se quitaron. */
  abstract quitarProductos(
    plantillaId: string,
    codes: string[],
  ): Promise<number>;

  /** Rutas activas con sus asignaciones vigentes. Orden por nombre. */
  abstract listarRutas(): Promise<RutaConPlantilla[]>;
  abstract buscarRuta(
    rutaId: string,
  ): Promise<{ id: string; activa: boolean } | null>;
  /**
   * Pone `plantillaId` en TODAS las asignaciones vigentes de la ruta. Devuelve
   * cuantas se actualizaron (0 = la ruta no tiene asignacion vigente).
   */
  abstract asignarARuta(rutaId: string, plantillaId: string): Promise<number>;
}
