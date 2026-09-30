/**
 * Iniciales del avatar: nombre y primer apellido. "María López Ruiz" → "ML",
 * "Irvin Alday" → "IA", una sola palabra → su primera letra. Sin nombre, "?".
 */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}
