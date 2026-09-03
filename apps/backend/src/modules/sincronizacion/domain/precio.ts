/**
 * Conversion de precios a centavos (enteros) y de vuelta. Funciones puras.
 *
 * Handy envia `price` como `number` con decimales (p. ej. `77.5`, `16.25`).
 * Guardar y operar ese valor como flotante arrastra errores de representacion
 * binaria (`0.1 + 0.2 === 0.30000000000000004`). La convencion del proyecto es
 * mantener el dinero como entero de centavos y convertir solo en los bordes.
 *
 * `Math.round(precio * 100)` es seguro para montos con a lo sumo 2 decimales:
 * el error de `precio * 100` siempre es menor a 0.5, asi que el redondeo cae en
 * el centavo correcto. No lo es para valores con un tercer decimal "5" exacto
 * (p. ej. `1.005`), caso que no ocurre con precios de 2 decimales.
 */

const CENTAVOS_POR_UNIDAD = 100;

/**
 * Convierte un precio decimal a centavos enteros.
 *
 * @example aCentavos(77.5)   // 7750
 * @example aCentavos(16.25)  // 1625
 * @example aCentavos(0.1 + 0.2) // 30
 */
export function aCentavos(precio: number): number {
  if (!Number.isFinite(precio)) {
    throw new TypeError(`aCentavos: se esperaba un numero finito, se recibio ${precio}`);
  }
  return Math.round(precio * CENTAVOS_POR_UNIDAD);
}

/**
 * Convierte centavos enteros de vuelta a un precio decimal.
 *
 * @example desdeCentavos(7750) // 77.5
 */
export function desdeCentavos(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new TypeError(`desdeCentavos: se esperaba un entero de centavos, se recibio ${centavos}`);
  }
  return centavos / CENTAVOS_POR_UNIDAD;
}
