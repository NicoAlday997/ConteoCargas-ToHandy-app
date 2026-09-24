/**
 * Conversion de lo contado en bodega (paquetes + piezas sueltas) a la unidad
 * de venta, que es la que se compara entre conteos y la que recibe Handy.
 * Funciones puras: sin Prisma, sin HTTP, sin NestJS.
 *
 * No todo paquete se rompe para vender (`ModalidadVenta`):
 * - `COMPLETO`: el paquete ES la unidad de venta. Una bolsa de "CANELS. c/70"
 *   se vende entera y Handy la cobra como 1; el "c/70" del nombre solo
 *   distingue productos, no es un factor. Cuenta 1 a 1 y no admite sueltas.
 * - `POR_PIEZA`: el paquete se rompe (cajetillas, refrescos por pieza) y
 *   `piezasPorPaquete` es el factor real.
 *
 * El factor (`piezasPorPaquete`) solo debe llegar aca si un supervisor ya lo
 * confirmo: un factor equivocado corrompe el conteo en silencio, porque
 * vendedor y contador usarian el mismo factor malo y el doble conteo no lo
 * detecta. Esa verificacion es responsabilidad del caso de uso; aca `null`
 * significa "el producto solo admite piezas sueltas".
 */

/** Como se vende un producto. Mismos valores que el enum de la base. */
export type ModalidadVenta = 'COMPLETO' | 'POR_PIEZA';

function exigirEnteroNoNegativo(nombre: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(
      `${nombre} debe ser un entero >= 0 (recibido: ${valor})`,
    );
  }
}

/**
 * Total en unidades de venta de un conteo.
 *
 * - `COMPLETO`: devuelve `paquetes` tal cual; `piezasPorPaquete` se ignora y
 *   cualquier `sueltas > 0` se rechaza (`RangeError`): no existen.
 * - `POR_PIEZA` sin factor (`piezasPorPaquete === null`): devuelve `sueltas`
 *   y rechaza (lanza `RangeError`) cualquier `paquetes > 0`, porque no hay
 *   forma honesta de convertirlos.
 * - `POR_PIEZA` con factor: `paquetes * piezasPorPaquete + sueltas`.
 *
 * Lanza `RangeError` si algun valor no es entero >= 0 o si el factor no es
 * entero >= 1.
 */
export function aPiezas(
  paquetes: number,
  sueltas: number,
  piezasPorPaquete: number | null,
  modalidad: ModalidadVenta,
): number {
  exigirEnteroNoNegativo('paquetes', paquetes);
  exigirEnteroNoNegativo('sueltas', sueltas);

  if (modalidad === 'COMPLETO') {
    if (sueltas > 0) {
      throw new RangeError(
        'El producto se vende completo: no admite piezas sueltas',
      );
    }
    return paquetes;
  }

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
 * suele indicar que un paquete se conto como sueltas. Sin factor, o en un
 * producto que se vende completo, nunca aplica.
 */
export function sueltasExcedenPaquete(
  sueltas: number,
  piezasPorPaquete: number | null,
  modalidad: ModalidadVenta,
): boolean {
  return (
    modalidad === 'POR_PIEZA' &&
    piezasPorPaquete !== null &&
    sueltas >= piezasPorPaquete
  );
}
