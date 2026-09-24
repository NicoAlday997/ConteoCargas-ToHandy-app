/**
 * Estado del conteo físico, sin React. Todas las funciones son puras y el
 * estado es inmutable: cada cambio devuelve un objeto nuevo, lo que deja a
 * las filas memoizadas re-renderizar solo cuando cambia su producto.
 */

/**
 * Cómo se vende. `COMPLETO`: el paquete es la unidad de venta (los dulces:
 * Handy cobra la bolsa y el "c/70" del nombre no es factor); se cuenta 1 a 1
 * en un solo campo. `POR_PIEZA`: el paquete se rompe y `piezasPorPaquete` es
 * el factor real.
 */
export type ModalidadVenta = 'COMPLETO' | 'POR_PIEZA';

/**
 * Lo que no llegue como `COMPLETO` se trata como por pieza: es lo que hace el
 * backend con las filas previas a la modalidad, y sin confirmar da igual.
 */
export function modalidadDesdeApi(valor: unknown): ModalidadVenta {
  return valor === 'COMPLETO' ? 'COMPLETO' : 'POR_PIEZA';
}

/** Producto ya validado para contarse (ver `normalizarProductos` en hooks-cargas). */
export interface ProductoConteo {
  code: string;
  nombre: string;
  familia: string | null;
  /** Nombre de la unidad en Handy ("Caja"): rotula lo que se vende completo. */
  unidadDescripcion: string;
  modalidadVenta: ModalidadVenta;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
}

export interface FamiliaConteo {
  familia: string | null;
  productos: readonly ProductoConteo[];
}

/**
 * `null` es SIN CAPTURAR: todavía nadie lo revisó. `0` es "ya lo revisé y no
 * llevan". La diferencia es la que impide finalizar con productos olvidados.
 */
export interface CapturaProducto {
  readonly paquetes: number | null;
  readonly sueltas: number | null;
}

export type EstadoConteo = Readonly<Record<string, CapturaProducto>>;

export type CampoCaptura = 'paquetes' | 'sueltas';

export type EstadoFila = 'sin-capturar' | 'con-cantidad' | 'en-cero';

export const SIN_CAPTURA: CapturaProducto = { paquetes: null, sueltas: null };

export function capturaDe(estado: EstadoConteo, code: string): CapturaProducto {
  return estado[code] ?? SIN_CAPTURA;
}

/**
 * Se vende completo y el supervisor ya lo confirmó. Igual que el backend: sin
 * confirmar, la modalidad no es confiable y el producto solo admite sueltas.
 */
export function seVendeCompleto(producto: ProductoConteo): boolean {
  return producto.factorConfirmado && producto.modalidadVenta === 'COMPLETO';
}

/**
 * Factor con el que se convierte a piezas. Igual que el backend: un factor sin
 * confirmar por el supervisor nunca se usa, ni para convertir ni para avisar.
 * Lo que se vende completo no tiene factor.
 */
export function factorEfectivo(producto: ProductoConteo): number | null {
  const { piezasPorPaquete, factorConfirmado } = producto;
  if (!factorConfirmado || seVendeCompleto(producto) || piezasPorPaquete === null) return null;
  return Number.isInteger(piezasPorPaquete) && piezasPorPaquete >= 1 ? piezasPorPaquete : null;
}

/**
 * Nombre de la unidad en Handy si el producto se vende completo; `null` si
 * se vende por pieza. Es lo que recibe `formatearEnPaquetes`.
 */
export function unidadCompleta(producto: ProductoConteo): string | null {
  return seVendeCompleto(producto) ? producto.unidadDescripcion : null;
}

/**
 * Lo completo se captura en el campo `paquetes` (su unidad: bolsas, cajas);
 * lo que se vende por pieza, solo con factor efectivo.
 */
export function admitePaquetes(producto: ProductoConteo): boolean {
  return seVendeCompleto(producto) || factorEfectivo(producto) !== null;
}

/** Lo completo no se rompe: no tiene piezas sueltas. */
export function admiteSueltas(producto: ProductoConteo): boolean {
  return !seVendeCompleto(producto);
}

/** El primer campo que se captura de un producto al llegar a él. */
export function primerCampo(producto: ProductoConteo): CampoCaptura {
  return admitePaquetes(producto) ? 'paquetes' : 'sueltas';
}

export function estaCapturado(captura: CapturaProducto): boolean {
  return captura.paquetes !== null || captura.sueltas !== null;
}

/**
 * Misma fórmula que `aPiezas` del backend: `paquetes * piezasPorPaquete + sueltas`
 * si se vende por pieza; `paquetes` tal cual si se vende completo. Un campo
 * sin capturar cuenta como 0 si el otro ya tiene valor.
 *
 * `null` si el producto no está capturado, si trae paquetes sin factor, o
 * sueltas de algo que se vende completo (el backend rechaza ambos).
 */
export function totalPiezas(captura: CapturaProducto, producto: ProductoConteo): number | null {
  if (!estaCapturado(captura)) return null;
  const paquetes = captura.paquetes ?? 0;
  const sueltas = captura.sueltas ?? 0;
  if (seVendeCompleto(producto)) return sueltas > 0 ? null : paquetes;
  const factor = factorEfectivo(producto);
  if (factor === null) return paquetes > 0 ? null : sueltas;
  return paquetes * factor + sueltas;
}

export function estadoFila(captura: CapturaProducto, producto: ProductoConteo): EstadoFila {
  if (!estaCapturado(captura)) return 'sin-capturar';
  const total = totalPiezas(captura, producto);
  // Un total incalculable no es "cero": algo se capturó y hay que revisarlo.
  return total === 0 ? 'en-cero' : 'con-cantidad';
}

export function productosPendientes(
  productos: readonly ProductoConteo[],
  estado: EstadoConteo,
): ProductoConteo[] {
  return productos.filter((p) => !estaCapturado(capturaDe(estado, p.code)));
}

export function progreso(
  productos: readonly ProductoConteo[],
  estado: EstadoConteo,
): { capturados: number; total: number } {
  const capturados = productos.reduce((n, p) => (estaCapturado(capturaDe(estado, p.code)) ? n + 1 : n), 0);
  return { capturados, total: productos.length };
}

/**
 * `true` cuando las sueltas ya completan un paquete. No es un error (a veces
 * el paquete viene abierto), solo un aviso. Sin factor nunca aplica.
 */
export function sueltasExcedenPaquete(sueltas: number | null, piezasPorPaquete: number | null): boolean {
  return sueltas !== null && piezasPorPaquete !== null && sueltas >= piezasPorPaquete;
}

export function fijarCampo(
  estado: EstadoConteo,
  code: string,
  campo: CampoCaptura,
  valor: number | null,
): EstadoConteo {
  const actual = capturaDe(estado, code);
  if (actual[campo] === valor) return estado;
  const siguiente: CapturaProducto = { ...actual, [campo]: valor };
  if (!estaCapturado(siguiente)) {
    const { [code]: _eliminado, ...resto } = estado;
    return resto;
  }
  return { ...estado, [code]: siguiente };
}

/** El gesto más repetido del día: "revisado, no lleva". */
export function fijarCero(estado: EstadoConteo, producto: ProductoConteo): EstadoConteo {
  const cero: CapturaProducto = {
    paquetes: admitePaquetes(producto) ? 0 : null,
    sueltas: admiteSueltas(producto) ? 0 : null,
  };
  const actual = capturaDe(estado, producto.code);
  if (actual.paquetes === cero.paquetes && actual.sueltas === cero.sueltas) return estado;
  return { ...estado, [producto.code]: cero };
}
