/**
 * Estado del conteo físico, sin React. Todas las funciones son puras y el
 * estado es inmutable: cada cambio devuelve un objeto nuevo, lo que deja a
 * las filas memoizadas re-renderizar solo cuando cambia su producto.
 */

/** Producto ya validado para contarse (ver `normalizarProductos` en hooks-cargas). */
export interface ProductoConteo {
  code: string;
  nombre: string;
  familia: string | null;
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
 * Factor con el que se convierte a piezas. Igual que el backend: un factor sin
 * confirmar por el supervisor nunca se usa, ni para convertir ni para avisar.
 */
export function factorEfectivo(producto: ProductoConteo): number | null {
  const { piezasPorPaquete, factorConfirmado } = producto;
  if (!factorConfirmado || piezasPorPaquete === null) return null;
  return Number.isInteger(piezasPorPaquete) && piezasPorPaquete >= 1 ? piezasPorPaquete : null;
}

/** Sin factor efectivo el producto solo se cuenta en piezas sueltas. */
export function admitePaquetes(producto: ProductoConteo): boolean {
  return factorEfectivo(producto) !== null;
}

export function estaCapturado(captura: CapturaProducto): boolean {
  return captura.paquetes !== null || captura.sueltas !== null;
}

/**
 * Misma fórmula que `aPiezas` del backend: `paquetes * piezasPorPaquete + sueltas`.
 * Un campo sin capturar cuenta como 0 si el otro ya tiene valor.
 *
 * `null` si el producto no está capturado, o si trae paquetes sin factor
 * (el backend lo rechaza: no hay forma honesta de convertirlos).
 */
export function totalPiezas(captura: CapturaProducto, piezasPorPaquete: number | null): number | null {
  if (!estaCapturado(captura)) return null;
  const paquetes = captura.paquetes ?? 0;
  const sueltas = captura.sueltas ?? 0;
  if (piezasPorPaquete === null) return paquetes > 0 ? null : sueltas;
  return paquetes * piezasPorPaquete + sueltas;
}

export function estadoFila(captura: CapturaProducto, piezasPorPaquete: number | null): EstadoFila {
  if (!estaCapturado(captura)) return 'sin-capturar';
  const total = totalPiezas(captura, piezasPorPaquete);
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
  const cero: CapturaProducto = { paquetes: admitePaquetes(producto) ? 0 : null, sueltas: 0 };
  const actual = capturaDe(estado, producto.code);
  if (actual.paquetes === cero.paquetes && actual.sueltas === cero.sueltas) return estado;
  return { ...estado, [producto.code]: cero };
}
