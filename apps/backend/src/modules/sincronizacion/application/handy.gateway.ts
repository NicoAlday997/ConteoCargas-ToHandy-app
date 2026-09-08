/**
 * Puerto hacia la API REST v2 de Handy para el modulo de sincronizacion
 * (catalogo de productos y usuarios vendedores). Ver
 * docs/02-documento-tecnico-y-diseno.md seccion 4.
 *
 * El dominio/aplicacion solo conoce este contrato; el adaptador HTTP real
 * (`HandyHttpGateway`) vive en `infrastructure/` y es el unico que sabe de la
 * base URL `https://hub.handy.la/api/v2`, del Bearer Token de compañia y de la
 * paginacion topada a `max=100` por pagina.
 *
 * Hechos verificados de la API que reflejan estos tipos:
 *  - El rol de vendedor es `role.id = 4` con `authority = 'ROLE_SALES'`.
 *  - `GET /product?enabled=true&max=100&page=N` responde
 *    `{ pagination: { totalCount, totalPages, nextPage }, products: [...] }`.
 *  - `GET /user?enabled=true&role=4&max=100&page=N` responde
 *    `{ pagination: { totalCount, totalPages, nextPage }, users: [...] }`.
 *  - Handy DEVUELVE fechas en ISO 8601 con `Z` (UTC); `lastUpdated` es un string.
 *  - Limite de tasa: 500 peticiones por minuto (lo administra el adaptador).
 */

/** `role.id` del vendedor en Handy. */
export const ROL_VENDEDOR_HANDY_ID = 4;

/** `authority` asociada al rol de vendedor en Handy. */
export const AUTHORITY_VENDEDOR_HANDY = 'ROLE_SALES';

/** Tope de registros por pagina que impone Handy (`max`). */
export const MAX_REGISTROS_POR_PAGINA_HANDY = 100;

/** Handy pagina desde 1. */
export const PRIMERA_PAGINA_HANDY = 1;

/**
 * Una pagina de resultados ya normalizada desde la forma de Handy
 * (`{ pagination, products | users }`) a algo estable para la aplicacion.
 */
export interface PaginaHandy<T> {
  items: T[];
  totalPaginas: number;
  totalRegistros: number;
}

/** Unidad de medida de un producto (`unit` en la respuesta de Handy). */
export interface UnidadProductoHandy {
  code: string;
  /**
   * Handy a veces devuelve `null` aqui (verificado con el producto MARUCHAN
   * codigo 805: `unit.description = null` mientras `unit.code = 'PIEZA'`). El
   * mapeo al cache local usa `code` como respaldo.
   */
  description: string | null;
}

/** Familia/categoria de un producto (`family` en la respuesta de Handy). */
export interface FamiliaProductoHandy {
  /** Handy puede devolver `null`; el cache local lo guarda como `null`. */
  description: string | null;
}

/**
 * Producto tal como lo devuelve `GET /product`. `code` es el identificador que
 * exige Handy en los payloads de carga y se trata como inmutable en el cache
 * local (ver modelo de datos, seccion 3).
 */
export interface ProductoHandy {
  code: string;
  description: string;
  /** Precio decimal (p. ej. `77.5`). Se guarda como centavos en el cache. */
  price: number;
  unit: UnidadProductoHandy;
  family: FamiliaProductoHandy;
  enabled: boolean;
  /** ISO 8601 con `Z` (UTC). */
  lastUpdated: string;
}

/** `role` embebido en un usuario de Handy. */
export interface RolUsuarioHandy {
  id: number;
  /** p. ej. `'ROLE_SALES'` para vendedor. */
  authority: string;
}

/**
 * Usuario tal como lo devuelve `GET /user`. Para el modulo de sincronizacion
 * solo interesan los vendedores (`role.id = 4`).
 */
export interface UsuarioHandyDto {
  id: number;
  name: string;
  /** Handy puede devolver `null`; el cache local lo guarda como `null`. */
  email: string | null;
  enabled: boolean;
  role: RolUsuarioHandy;
  /** ISO 8601 con `Z` (UTC). */
  lastUpdated: string;
}

/**
 * Puerto: que necesita la aplicacion de Handy, no como se obtiene. La
 * implementacion HTTP y el manejo de rate limit / reintentos son detalle de
 * `infrastructure/`.
 */
export abstract class HandyGateway {
  /**
   * Lee una pagina del catalogo de productos habilitados
   * (`GET /product?enabled=true&max=100&page=${pagina}`).
   *
   * @param pagina numero de pagina base 1.
   */
  abstract listarProductos(pagina: number): Promise<PaginaHandy<ProductoHandy>>;

  /**
   * Lee una pagina de usuarios vendedores habilitados
   * (`GET /user?enabled=true&role=4&max=100&page=${pagina}`).
   *
   * @param pagina numero de pagina base 1.
   */
  abstract listarVendedores(pagina: number): Promise<PaginaHandy<UsuarioHandyDto>>;
}
