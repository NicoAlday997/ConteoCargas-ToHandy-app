/**
 * Cantidades en la unidad en que se cuenta en bodega: paquetes, y las piezas
 * que no completan uno. Siempre en palabras: "3.1 paquetes" se leería como
 * decimal (¿3 y una pieza, o 3 y un décimo?). Por lo mismo la captura usa dos
 * campos separados en vez de un número con punto.
 *
 * Solo para mostrar al usuario: a Handy se envía siempre en piezas.
 */

function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

/**
 * "3 paquetes y 1 pieza". Sin factor (o con uno inválido) solo piezas:
 * "18 piezas". Menos de un paquete se dice en piezas: "5 piezas".
 */
export function formatearEnPaquetes(piezas: number, piezasPorPaquete: number | null): string {
  const factor = piezasPorPaquete !== null && Number.isInteger(piezasPorPaquete) && piezasPorPaquete >= 1 ? piezasPorPaquete : null;
  if (factor === null) return plural(piezas, 'pieza', 'piezas');

  const paquetes = Math.floor(piezas / factor);
  const sueltas = piezas % factor;
  if (paquetes === 0 && sueltas > 0) return plural(sueltas, 'pieza', 'piezas');
  if (sueltas === 0) return plural(paquetes, 'paquete', 'paquetes');
  return `${plural(paquetes, 'paquete', 'paquetes')} y ${plural(sueltas, 'pieza', 'piezas')}`;
}

/** "(18 piezas)": el total como dato secundario, junto a la cantidad en paquetes. */
export function formatearTotalPiezas(piezas: number): string {
  return `(${plural(piezas, 'pieza', 'piezas')})`;
}
