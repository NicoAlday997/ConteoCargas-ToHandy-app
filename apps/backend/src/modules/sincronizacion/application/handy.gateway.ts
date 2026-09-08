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

// ---------------------------------------------------------------------------
// Errores del puerto
// ---------------------------------------------------------------------------
//
// Los mapea el adaptador HTTP (`HandyHttpGateway`) desde el estado/condicion de
// red cruda; los interpreta la aplicacion (p. ej. `EnviarCargaUseCase` decide,
// segun cual se lanzo, si el evento va a `ERROR_ENVIO` o a `ENVIO_INCIERTO`).
// Viven aca, en el puerto, porque forman parte de su contrato: quien depende de
// `HandyGateway` debe poder distinguirlos sin importar nada de `infrastructure/`.
// El mensaje jamas incluye el Bearer Token (docs/02 seccion 5).

/**
 * El token de Handy es invalido o expiro (HTTP 401). No lo puede resolver el
 * usuario operativo: debe generar una alerta de urgencia ALTA para el
 * administrador (docs/02 seccion 6).
 */
export class HandyTokenInvalidoError extends Error {
  constructor(ruta: string) {
    super(`Handy respondio 401 (token invalido o expirado) en ${ruta}`);
    this.name = 'HandyTokenInvalidoError';
  }
}

/**
 * Handy respondio con un error de servidor (HTTP 5xx). Es transitorio: la capa
 * que orquesta puede reintentar con backoff (docs/02 seccion 4.4).
 */
export class HandyErrorServidorError extends Error {
  constructor(
    ruta: string,
    readonly estado: number,
  ) {
    super(`Handy respondio ${estado} (error de servidor) en ${ruta}`);
    this.name = 'HandyErrorServidorError';
  }
}

/**
 * Handy respondio con un estado que el adaptador no sabe interpretar (un 4xx
 * distinto de 401/404/422). Se expone el codigo pero nunca el cuerpo ni el token.
 */
export class HandyRespuestaNoOkError extends Error {
  constructor(
    ruta: string,
    readonly estado: number,
  ) {
    super(`Handy respondio ${estado} (inesperado) en ${ruta}`);
    this.name = 'HandyRespuestaNoOkError';
  }
}

/**
 * La peticion a Handy no obtuvo respuesta: timeout, DNS, conexion cortada. A
 * diferencia de un 5xx (Handy contesto y sabemos que no proceso), aca NO se sabe
 * si la ruta llego a crearse. Un envio que termina asi debe pasar a
 * `ENVIO_INCIERTO` y verificar `route/current` antes de cualquier reintento
 * (docs/02 seccion 4.4 y riesgo tecnico 1 de la seccion 7).
 */
export class HandySinRespuestaError extends Error {
  constructor(
    ruta: string,
    readonly causa: unknown,
  ) {
    super(`Handy no respondio en ${ruta} (timeout o error de red)`);
    this.name = 'HandySinRespuestaError';
  }
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

// ---------------------------------------------------------------------------
// Rutas de venta: carga inicial, recarga y consulta de ruta abierta
// (docs/02-documento-tecnico-y-diseno.md seccion 4)
// ---------------------------------------------------------------------------

/**
 * Ruta abierta actual de un vendedor, normalizada desde
 * `GET /user/{userId}/route/current`. Para el flujo de envio solo interesa el
 * identificador: se guarda en `EventoCarga.idHandy` y sirve para descartar un
 * duplicado tras un envio incierto.
 */
export interface RutaHandy {
  /** Id de la ruta en Handy (`EventoCarga.idHandy`). */
  id: string;
}

/**
 * Linea de producto de un payload de ruta. `product` es el `code` del producto
 * en Handy (la PK del cache local, ver seccion 3), `quantity` la cantidad final
 * ya conciliada por el doble conteo.
 */
export interface ItemRutaHandy {
  product: string;
  quantity: number;
}

/**
 * Pedido de preventa (`salesOrders`). Hoy la operacion es autoventa pura y este
 * arreglo siempre va vacio; el tipo existe desde ahora para cuando el negocio
 * migre a preventa y `crearRuta` deba enviar los pedidos levantados. La forma
 * exacta se definira al implementar esa fase.
 */
export type PedidoPreventaHandy = Record<string, unknown>;

/**
 * Cuerpo de `POST /user/{userId}/route`. Campos verificados contra la API real:
 *  - `products`: obligatorio.
 *  - `salesOrders`: la API lo marca requerido aunque hoy vaya `[]` (autoventa).
 *  - `initialAmount`: NO se incluye a proposito — los movimientos de efectivo
 *    estan fuera de alcance (docs/01 seccion 2.2).
 *  - `skipInventoryValidation`: opcional; solo se usa para forzar una recarga
 *    con inventario insuficiente (docs/02 seccion 4.3).
 *  - `dateForDelivery`: opcional; solo obligatorio si `salesOrders` no esta
 *    vacio (preventa). En autoventa no se envia (docs/02 seccion 4.2).
 */
export interface PayloadCrearRuta {
  products: ItemRutaHandy[];
  salesOrders: PedidoPreventaHandy[];
  skipInventoryValidation?: boolean;
  dateForDelivery?: string;
}

/**
 * Desenlace de negocio de `crearRuta` / `recargarRuta`. Los fallos de
 * infraestructura (401, 5xx, sin respuesta) NO viajan aca: se lanzan como
 * excepcion (`HandyTokenInvalidoError`, `HandyErrorServidorError`,
 * `HandySinRespuestaError`), igual que en el resto del puerto.
 *
 *  - `CREADA`: la ruta quedo creada; `idHandy` es su identificador.
 *  - `INVENTARIO_INSUFICIENTE`: Handy respondio 422 rechazando uno o mas
 *    productos por stock/codigo. `productosRechazados` lista sus `code` (aislados
 *    via `prettyMessages=true`); el resto puede reenviarse sin ellos
 *    (docs/02 seccion 4.3 y 4.4).
 */
export type RespuestaCrearRuta =
  | { estado: 'CREADA'; idHandy: string }
  | { estado: 'INVENTARIO_INSUFICIENTE'; productosRechazados: string[] };

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

  /**
   * Consulta la ruta abierta actual del vendedor
   * (`GET /user/{userId}/route/current`).
   *
   * VERIFICADO contra la API real: cuando el vendedor no tiene ninguna ruta
   * abierta, Handy responde `404`. Eso NO es un error — significa "sin ruta" —
   * y este metodo devuelve `null` en ese caso.
   *
   * Es la consulta que exige el riesgo tecnico 1 (docs/02 seccion 7): antes de
   * reintentar un envio incierto hay que descartar que la ruta ya se haya
   * creado.
   *
   * Lanza `HandyTokenInvalidoError` (401) o `HandyErrorServidorError` (5xx).
   */
  abstract consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null>;

  /**
   * Crea la carga inicial de una ruta
   * (`POST /user/{userId}/route?prettyMessages=true`).
   *
   * Lanza `HandyTokenInvalidoError` (401), `HandyErrorServidorError` (5xx) o
   * `HandySinRespuestaError` (timeout / red). Un 422 por inventario NO se lanza:
   * vuelve como `{ estado: 'INVENTARIO_INSUFICIENTE', ... }`.
   */
  abstract crearRuta(
    usuarioHandyId: number,
    payload: PayloadCrearRuta,
  ): Promise<RespuestaCrearRuta>;

  /**
   * Recarga una ruta ya abierta
   * (`POST /user/{userId}/route/recharge?prettyMessages=true`).
   *
   * Mismo contrato de errores que `crearRuta`.
   */
  abstract recargarRuta(
    usuarioHandyId: number,
    items: ItemRutaHandy[],
  ): Promise<RespuestaCrearRuta>;

  /**
   * Cancela una ruta creada (`DELETE /route/{routeId}`). Handy solo lo permite
   * mientras el vendedor no haya aceptado la ruta desde la app oficial
   * (docs/02 seccion 4.2); sirve para deshacer un duplicado detectado tras un
   * envio incierto.
   *
   * Devuelve `true` si la ruta quedo cancelada, `false` si Handy la rechazo
   * porque ya no se puede cancelar (p. ej. ya aceptada) o no existe.
   *
   * Lanza `HandyTokenInvalidoError` (401) o `HandyErrorServidorError` (5xx).
   */
  abstract cancelarRuta(rutaId: string): Promise<boolean>;
}
