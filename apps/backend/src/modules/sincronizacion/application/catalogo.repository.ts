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
}

/**
 * Puerto: que necesita la sincronizacion de la persistencia, no como se hace.
 */
export abstract class CatalogoRepository {
  /**
   * Inserta o actualiza (upsert por `code`) los productos recibidos. No elimina
   * los que ya no vengan: los deshabilitados llegan con `activo = false`.
   */
  abstract upsertProductos(productos: ProductoLocal[]): Promise<void>;

  /**
   * Inserta o actualiza (upsert por `idHandy`) los vendedores recibidos.
   */
  abstract upsertVendedores(vendedores: VendedorHandyLocal[]): Promise<void>;
}
