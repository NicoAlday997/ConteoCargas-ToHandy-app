import { randomInt } from 'node:crypto';

/**
 * Reglas puras del PIN temporal. No conoce Prisma, HTTP ni argon2.
 * Ver RF-07 y RF-09 en docs/01-definicion-y-requisitos.md.
 */

/** Un PIN temporal tiene la misma forma que el PIN de acceso: 4 digitos. */
export const LONGITUD_PIN_TEMPORAL = 4;

/**
 * Genera un PIN temporal de 4 digitos aleatorios (RF-07 alta / RF-09
 * restablecimiento). No depende de infraestructura: solo de la fuente de
 * aleatoriedad de Node.
 *
 * Usa `crypto.randomInt` (CSPRNG), nunca `Math.random`. El rango 0..9999 se
 * rellena con ceros a la izquierda para que el resultado sea SIEMPRE una cadena
 * de exactamente 4 caracteres ("0007", "1234", ...).
 */
export function generarPinTemporal(): string {
  const maximoExclusivo = 10 ** LONGITUD_PIN_TEMPORAL;
  return randomInt(0, maximoExclusivo)
    .toString()
    .padStart(LONGITUD_PIN_TEMPORAL, '0');
}
