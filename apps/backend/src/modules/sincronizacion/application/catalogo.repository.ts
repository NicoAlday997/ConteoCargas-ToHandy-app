/**
 * Puerto de persistencia del cache local de Handy (productos y usuarios
 * vendedores). Ver modelo de datos en docs/02-documento-tecnico-y-diseno.md
 * seccion 3.
 *
 * La capa de aplicacion entrega los datos YA CONVERTIDOS al formato local
 * (precios en centavos, fechas como `Date`, campos renombrados); este puerto no
 * sabe nada de la forma de Handy. El adaptador Prisma vive en `infrastructure/`.
 */

/**
 * Producto listo para el cache local (`Producto` en el esquema). `code` es la
 * llave primaria y se trata como inmutable.
 */
export interface ProductoLocal {
  code: string;
  nombre: string;
  /** Siempre en centavos (entero); nunca decimal. */
  precioCentavos: number;
  unidadCode: string;
  unidadDescripcion: string;
  familia: string | null;
  /**
   * `false` cuando el producto esta deshabilitado en Handy. El adaptador NO
   * borra el registro: solo actualiza esta bandera para preservar las
   * referencias del historial (docs/02 seccion 3.2).
   */
  activo: boolean;
  /** `lastUpdated` de Handy ya interpretado como instante, o `null`. */
  lastUpdatedHandy: Date | null;
  /**
   * Factor de empaque propuesto desde el nombre, que se guarda SIN confirmar.
   * `null` significa "no proponer nada": el adaptador no toca el factor
   * guardado. El caso de uso solo lo llena cuando el producto aun no tiene
   * factor; aun asi, el adaptador nunca lo aplica sobre un factor ya guardado
   * o confirmado (p. ej. si un supervisor confirmo durante la sincronizacion).
   */
  piezasPorPaquetePropuesto: number | null;
}

/**
 * Usuario vendedor de Handy listo para el cache local (`UsuarioHandy` en el
 * esquema). El `role` de Handy es un objeto `{id, authority}`: se guardan ambos.
 */
export interface VendedorHandyLocal {
  idHandy: number;
  nombre: string;
  email: string | null;
  rolHandyId: number;
  rolHandyAuthority: string;
  activo: boolean;
  /**
   * Foto real del vendedor o `null` si no tiene (la silueta generica de Handy
   * se guarda como `null`). `undefined`: Handy no mando el campo y se conserva
   * la foto que ya estaba guardada.
   */
  fotoUrl?: string | null;
}

/**
 * Lo que el cache ya tiene de un producto: los campos que la sincronizacion
 * compara para saber si Handy trajo un cambio real. El factor de empaque no
 * esta aqui a proposito: la sincronizacion no lo compara ni lo sobrescribe.
 */
export type ProductoGuardado = Pick<
  ProductoLocal,
  | 'code'
  | 'nombre'
  | 'precioCentavos'
  | 'unidadCode'
  | 'unidadDescripcion'
  | 'familia'
  | 'activo'
>;

/** Lo que el cache ya tiene de un vendedor, para comparar. */
export interface VendedorGuardado {
  idHandy: number;
  nombre: string;
  email: string | null;
  rolHandyId: number;
  rolHandyAuthority: string;
  activo: boolean;
  fotoUrl: string | null;
}

/** Cifras del cache para el estado de la sincronizacion (docs/04 §1.3). */
export interface ResumenCache {
  /**
   * La marca mas reciente entre productos y vendedores. `null` si el cache
   * esta vacio (nunca se ha sincronizado).
   */
  ultimaSincronizacion: Date | null;
  productosActivos: number;
  vendedoresActivos: number;
}

/**
 * Puerto: que necesita la sincronizacion de la persistencia, no como se hace.
 */
export abstract class CatalogoRepository {
  /**
   * Inserta o actualiza (upsert por `code`) los productos recibidos. No elimina
   * los que ya no vengan: los deshabilitados se marcan con
   * `desactivarProductos`. NUNCA toca `modalidadVenta` ni `piezasPorPaquete`
   * de un producto con el factor confirmado.
   */
  abstract upsertProductos(productos: ProductoLocal[]): Promise<void>;

  /**
   * Inserta o actualiza (upsert por `idHandy`) los vendedores recibidos.
   */
  abstract upsertVendedores(vendedores: VendedorHandyLocal[]): Promise<void>;

  /** Los productos del cache con esos codigos; los que no existen no aparecen. */
  abstract buscarProductos(
    codes: string[],
  ): Promise<Map<string, ProductoGuardado>>;

  /** Los vendedores del cache con esos ids; los que no existen no aparecen. */
  abstract buscarVendedores(
    ids: number[],
  ): Promise<Map<number, VendedorGuardado>>;

  /** Codigos de los productos activos en el cache. */
  abstract listarCodesProductosActivos(): Promise<string[]>;

  /** Ids de los vendedores activos en el cache. */
  abstract listarIdsVendedoresActivos(): Promise<number[]>;

  /**
   * Marca `activo = false` (nunca borra: el historial los referencia). Solo
   * cambia esa bandera y la marca de sincronizacion; el factor de empaque no
   * se toca.
   */
  abstract desactivarProductos(codes: string[]): Promise<void>;

  /** Marca `activo = false` a esos vendedores; nunca los borra. */
  abstract desactivarVendedores(ids: number[]): Promise<void>;

  abstract resumen(): Promise<ResumenCache>;
}
