/**
 * Qué tanto de la barra de avance se enciende: de 0 a 1. Sin total no hay
 * avance; lo capturado de más no desborda la barra.
 */
export function fraccionAvance(actual: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(actual)) return 0;
  return Math.min(1, Math.max(0, actual / total));
}
