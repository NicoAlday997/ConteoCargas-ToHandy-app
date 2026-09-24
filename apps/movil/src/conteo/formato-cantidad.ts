/**
 * Cantidades en la unidad en que se cuenta en bodega: paquetes, y las piezas
 * que no completan uno. Siempre en palabras: "3.1 paquetes" se leería como
 * decimal (¿3 y una pieza, o 3 y un décimo?). Por lo mismo la captura usa dos
 * campos separados en vez de un número con punto.
 *
 * Solo para mostrar al usuario: a Handy se envía siempre en piezas.
 *
 * Lo que se vende COMPLETO (dulces) no tiene paquetes ni piezas: se dice en su
 * unidad de Handy, "5 cajas". Nunca "350 piezas": el "c/70" del nombre no es
 * factor.
 */

function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

/** "Caja" → "caja", "Cajetilla" → "cajetilla". Sin nombre en Handy: "unidad". */
export function unidadEnSingular(descripcion: string): string {
  return descripcion.trim().toLowerCase() || 'unidad';
}

/**
 * Plural en español del nombre de una unidad de Handy: "Caja" → "cajas",
 * "Paquete" → "paquetes", "Rollo" → "rollos", "Cruz" → "cruces",
 * "Display" → "displays". Una abreviatura ("Cajet.") se deja igual.
 */
export function unidadEnPlural(descripcion: string): string {
  const palabra = unidadEnSingular(descripcion);
  if (palabra === 'unidad') return 'unidades';
  if (/[.s]$/.test(palabra)) return palabra;
  if (/[aeiouáéíóúy]$/.test(palabra)) return `${palabra}s`;
  if (palabra.endsWith('z')) return `${palabra.slice(0, -1)}ces`;
  return `${palabra}es`;
}

/**
 * "3 paquetes y 1 pieza". Sin factor (o con uno inválido) solo piezas:
 * "18 piezas". Menos de un paquete se dice en piezas: "5 piezas".
 *
 * `unidadCompleta` es el nombre de la unidad en Handy de un producto que se
 * vende completo: entonces la cantidad ya ESTÁ en esa unidad y el factor no
 * aplica. `formatearEnPaquetes(5, null, 'Caja')` → "5 cajas".
 */
export function formatearEnPaquetes(piezas: number, piezasPorPaquete: number | null, unidadCompleta: string | null = null): string {
  if (unidadCompleta !== null) {
    return plural(piezas, unidadEnSingular(unidadCompleta), unidadEnPlural(unidadCompleta));
  }
  const factor = piezasPorPaquete !== null && Number.isInteger(piezasPorPaquete) && piezasPorPaquete >= 1 ? piezasPorPaquete : null;
  if (factor === null) return plural(piezas, 'pieza', 'piezas');

  const paquetes = Math.floor(piezas / factor);
  const sueltas = piezas % factor;
  if (paquetes === 0 && sueltas > 0) return plural(sueltas, 'pieza', 'piezas');
  if (sueltas === 0) return plural(paquetes, 'paquete', 'paquetes');
  return `${plural(paquetes, 'paquete', 'paquetes')} y ${plural(sueltas, 'pieza', 'piezas')}`;
}

/** "18 piezas", "1 pieza": toda cantidad en piezas se escribe así en la app, sin abreviar. */
export function formatearPiezas(piezas: number): string {
  return plural(piezas, 'pieza', 'piezas');
}

/** "(18 piezas)": el total como dato secundario, junto a la cantidad en paquetes. */
export function formatearTotalPiezas(piezas: number): string {
  return `(${formatearPiezas(piezas)})`;
}

/** "1,240": separador de miles para las cifras grandes que se leen de un vistazo. */
export function formatearCifra(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
