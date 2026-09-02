/**
 * Reglas puras de acceso. No conoce Prisma, HTTP ni bcrypt/argon2.
 * Ver RF-02, RF-03, RF-08 en docs/01-definicion-y-requisitos.md
 */

export const MAX_INTENTOS_FALLIDOS = 5;
export const MINUTOS_BLOQUEO = 15;
export const LONGITUD_PIN = 4;

export interface EstadoAcceso {
  activo: boolean;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

/** Un PIN valido son exactamente 4 digitos numericos. */
export function esPinValido(pin: string): boolean {
  return new RegExp(`^\\d{${LONGITUD_PIN}}$`).test(pin);
}

/** El bloqueo sigue vigente si la fecha de desbloqueo aun no llega. */
export function estaBloqueado(estado: EstadoAcceso, ahora: Date): boolean {
  if (estado.bloqueadoHasta === null) return false;
  return estado.bloqueadoHasta.getTime() > ahora.getTime();
}

/** Un usuario inactivo nunca puede entrar, tenga o no bloqueo. */
export function puedeIntentarLogin(
  estado: EstadoAcceso,
  ahora: Date,
): boolean {
  if (!estado.activo) return false;
  return !estaBloqueado(estado, ahora);
}

/** Calcula el estado tras un intento fallido. Al llegar al maximo, bloquea. */
export function registrarIntentoFallido(
  estado: EstadoAcceso,
  ahora: Date,
): EstadoAcceso {
  const intentos = estado.intentosFallidos + 1;

  if (intentos >= MAX_INTENTOS_FALLIDOS) {
    return {
      ...estado,
      intentosFallidos: intentos,
      bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60 * 1000),
    };
  }

  return { ...estado, intentosFallidos: intentos, bloqueadoHasta: null };
}

/** Un login exitoso limpia el contador y cualquier bloqueo previo. */
export function registrarIntentoExitoso(estado: EstadoAcceso): EstadoAcceso {
  return { ...estado, intentosFallidos: 0, bloqueadoHasta: null };
}
