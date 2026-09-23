/**
 * Factor de empaque (piezas por paquete). Funciones puras.
 *
 * En bodega se cuentan PAQUETES; Handy registra y vende en PIEZAS. Handy no
 * guarda cuantas piezas trae un paquete (verificado con soporte), pero el dato
 * ya viene escrito en el nombre del producto: "PEPSI 1.5 LT C/12",
 * "BARRILITOS .750 ml C/24", "CANELS. c/70".
 *
 * Lo que se extrae aqui es solo una PROPUESTA: un factor equivocado corrompe
 * en silencio todos los conteos del producto, y el doble conteo no lo detecta
 * porque vendedor y contador usarian el mismo factor malo. Nunca se usa sin
 * confirmacion de un supervisor.
 */

export const PIEZAS_POR_PAQUETE_MINIMO = 1;
export const PIEZAS_POR_PAQUETE_MAXIMO = 500;

/**
 * Patrones del catalogo real, en orden de prioridad. Todos sin distinguir
 * mayusculas y tolerando espacios alrededor de los separadores.
 */
const PATRONES_FACTOR: readonly RegExp[] = [
  // "C/12", "C / 6", "c/70", "C /6". La C no puede ir pegada a otra letra.
  /(?<![A-Z])C\s*\/\s*(\d+)/i,
  // "X 12", "x12". La X no puede ir pegada a otra letra (evita "MAX 12").
  /(?<![A-Z])X\s*(\d+)(?![\d.])/i,
  // "6 pack", "12PACK". El numero no puede ser parte de un decimal ("1.5").
  /(?<![\d.])(\d+)\s*PACK\b/i,
];

/** `true` si `piezas` es un entero dentro del rango razonable. */
export function esPiezasPorPaqueteValido(piezas: number): boolean {
  return (
    Number.isInteger(piezas) &&
    piezas >= PIEZAS_POR_PAQUETE_MINIMO &&
    piezas <= PIEZAS_POR_PAQUETE_MAXIMO
  );
}

/**
 * Extrae del nombre del producto cuantas piezas trae un paquete.
 *
 * Devuelve `null` si el nombre no trae ningun patron conocido, o si el numero
 * encontrado no es razonable (fuera de 1..500): en ese caso el supervisor debe
 * capturarlo a mano.
 *
 * @example extraerFactorDeNombre('PEPSI 1.5 LT C/12') // 12
 * @example extraerFactorDeNombre('BLUE RIVERS')       // null
 */
export function extraerFactorDeNombre(nombre: string): number | null {
  for (const patron of PATRONES_FACTOR) {
    const coincidencia = patron.exec(nombre);
    if (coincidencia !== null) {
      const piezas = Number.parseInt(coincidencia[1], 10);
      return esPiezasPorPaqueteValido(piezas) ? piezas : null;
    }
  }
  return null;
}
