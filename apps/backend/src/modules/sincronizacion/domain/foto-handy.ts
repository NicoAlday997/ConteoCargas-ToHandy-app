/**
 * Foto de perfil de un usuario de Handy (`users[].pictureUrl`). Funciones puras.
 *
 * Handy le pone a quien no ha subido foto una silueta generica:
 * `https://cdn.handy.la/web-app/sales/user-profile.png`. Guardarla seria peor
 * que no guardar nada: es identica para todos y no identifica a nadie, y la
 * app sin foto muestra las iniciales con color, que si.
 *
 * Se reconoce por host + ruta, no por la cadena exacta: Handy podria cambiarle
 * la version o agregarle query params (`?v=2`).
 */

const HOST_PLACEHOLDER = 'cdn.handy.la';
const RUTA_PLACEHOLDER = '/web-app/sales/user-profile.png';

/** `true` si no hay foto (null o vacia) o si es la silueta generica de Handy. */
export function esFotoGenericaDeHandy(url: string | null): boolean {
  const limpia = url?.trim() ?? '';
  if (limpia === '') return true;
  let parseada: URL;
  try {
    parseada = new URL(limpia);
  } catch {
    // No es una URL: tampoco sirve como foto.
    return true;
  }
  return (
    parseada.hostname.toLowerCase() === HOST_PLACEHOLDER &&
    parseada.pathname.replace(/\/+$/, '') === RUTA_PLACEHOLDER
  );
}

/** La URL de la foto real, recortada; `null` si no hay o es la generica. */
export function normalizarFotoHandy(url: string | null): string | null {
  return esFotoGenericaDeHandy(url) ? null : (url as string).trim();
}
