/**
 * Puerto: verificar el PIN de un usuario de la app en el momento de una accion
 * sensible (hoy, la confirmacion cruzada de una discrepancia, RF-15).
 *
 * El JWT solo dice quien abrio sesion en el dispositivo; la confirmacion exige
 * ademas que esa persona teclee SU PIN en ese momento (CLAUDE.md: "una persona
 * distinta la confirme con su propio PIN"). Sin esta verificacion, cualquiera
 * que tome un dispositivo con sesion abierta confirmaria en nombre de otro.
 *
 * Los intentos fallidos cuentan para el mismo bloqueo temporal del login
 * (RF-03): confirmar no es una puerta lateral para adivinar PINs.
 *
 * Capa de aplicacion: el adaptador vive en `infrastructure/`.
 */

export type ResultadoVerificacionPin =
  | { valido: true }
  | {
      valido: false;
      motivo: 'PIN_INCORRECTO';
      /** `null` si el PIN ni siquiera tenia forma de PIN (no cuenta intento). */
      intentosRestantes: number | null;
    }
  | { valido: false; motivo: 'BLOQUEADO'; bloqueadoHasta: Date }
  | { valido: false; motivo: 'INACTIVO' };

export abstract class VerificadorPin {
  abstract verificar(
    usuarioAppId: string,
    pin: string,
    ahora: Date,
  ): Promise<ResultadoVerificacionPin>;
}
