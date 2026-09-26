/**
 * Nombres de producto para mostrar. Handy los manda en MAYÚSCULAS
 * ("ENCENDEDOR ECONOMICOS C/50"), y las mayúsculas sostenidas se leen más
 * lento: borran la silueta de la palabra. En la lista de conteo, donde la
 * velocidad importa más, eso cuesta.
 *
 * Solo para mostrar al usuario. La búsqueda y todo lo que viaja al servidor
 * usa `producto.nombre` tal cual llegó.
 */

const LETRA = /[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/;
const TRAMO_LETRAS = /[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+/g;
const VOCAL = /[AEIOUÁÉÍÓÚÜ]/;

/**
 * Mayúscula inicial por palabra, dejando intacto lo que se lee como código:
 * - lo que lleva números: empaques (C/50), unidades (2L, 600ML, 14G), cifras;
 * - siglas cortas: 2 o 3 letras sin vocales (LT, ML) o repetidas (AA, AAA);
 *   las de una letra (D, S.) quedan igual por definición;
 * - la palabra que ya trae minúsculas: alguien la escribió así a propósito.
 */
export function formatearNombreProducto(nombre: string): string {
  return nombre.replace(/\S+/g, formatearPalabra);
}

function formatearPalabra(palabra: string): string {
  if (/\d/.test(palabra)) return palabra;
  const letras = [...palabra].filter((c) => LETRA.test(c)).join('');
  if (letras === '' || letras !== letras.toUpperCase() || esSigla(letras)) return palabra;
  // Por tramo de letras: "COCA-COLA" → "Coca-Cola".
  return palabra.replace(TRAMO_LETRAS, (tramo) => tramo.charAt(0) + tramo.slice(1).toLowerCase());
}

function esSigla(letras: string): boolean {
  if (letras.length > 3) return false;
  return !VOCAL.test(letras) || [...letras].every((l) => l === letras[0]);
}

/**
 * Nombre de familia para mostrar: solo la primera letra en mayúscula
 * ("BOTANAS Y DULCES" → "Botanas y dulces"). Conserva lo que
 * `formatearNombreProducto` conserva (siglas, códigos, números).
 */
export function formatearNombreFamilia(nombre: string): string {
  let primera = true;
  return nombre.replace(/\S+/g, (palabra) => {
    const formateada = formatearPalabra(palabra);
    if (primera) {
      primera = false;
      return formateada;
    }
    // Conjunciones y preposiciones de una letra ("Y", "A"): no son siglas.
    if (/^[YEOUA]$/.test(palabra)) return palabra.toLowerCase();
    // Solo se baja lo que esta función subió a mayúscula inicial.
    return formateada !== palabra ? formateada.toLowerCase() : formateada;
  });
}
