/**
 * Conversion de lo contado en bodega (paquetes + piezas sueltas) a piezas, que
 * es la unidad que se compara entre conteos y la que recibe Handy. Funciones
 * puras: sin Prisma, sin HTTP, sin NestJS.
 *
 * El factor (`piezasPorPaquete`) solo debe llegar aca si un supervisor ya lo
 * confirmo: un factor equivocado corrompe el conteo en silencio, porque
 * vendedor y contador usarian el mismo factor malo y el doble conteo no lo
 * detecta. Esa verificacion es responsabilidad del caso de uso; aca `null`
 * significa "el producto solo admite piezas sueltas".
 */

function exigirEnteroNoNegativo(nombre: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(
      `${nombre} debe ser un entero >= 0 (recibido: ${valor})`,
    );
  }
}

/**
 * Total en piezas de un conteo.
 *
 * - Con `piezasPorPaquete === null` el producto no tiene paquete: devuelve
 *   `sueltas` y rechaza (lanza `RangeError`) cualquier `paquetes > 0`, porque
 *   no hay forma honesta de convertirlos.
 * - Con factor: `paquetes * piezasPorPaquete + sueltas`.
 *
 * Lanza `RangeError` si algun valor no es entero >= 0 o si el factor no es
 * entero >= 1.
 */
export function aPiezas(
  paquetes: number,
  sueltas: number,
  piezasPorPaquete: number | null,
): number {
  exigirEnteroNoNegativo('paquetes', paquetes);
  exigirEnteroNoNegativo('sueltas', sueltas);

  if (piezasPorPaquete === null) {
    if (paquetes > 0) {
      throw new RangeError(
        'El producto no tiene piezas por paquete: solo admite piezas sueltas',
      );
    }
    return sueltas;
  }

  if (!Number.isInteger(piezasPorPaquete) || piezasPorPaquete < 1) {
    throw new RangeError(
      `piezasPorPaquete debe ser un entero >= 1 (recibido: ${piezasPorPaquete})`,
    );
  }
  return paquetes * piezasPorPaquete + sueltas;
}

/**
 * `true` cuando las sueltas ya alcanzan (o pasan) un paquete completo. No es un
 * error —el total en piezas sigue siendo correcto—, pero la app debe avisar:
 * suele indicar que un paquete se conto como sueltas. Sin factor nunca aplica.
 */
export function sueltasExcedenPaquete(
  sueltas: number,
  piezasPorPaquete: number | null,
): boolean {
  return piezasPorPaquete !== null && sueltas >= piezasPorPaquete;
}
