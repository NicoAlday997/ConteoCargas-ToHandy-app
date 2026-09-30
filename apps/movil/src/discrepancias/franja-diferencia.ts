import { formatearEnPaquetes, formatearTotalPiezas } from '../conteo/formato-cantidad.ts';

/**
 * Los dos renglones de la franja de diferencia, sin React:
 * - valor: la diferencia en la unidad en que se cuenta ("1 paquete y 2 piezas").
 * - detalle: quién contó más y, con factor, el total en piezas
 *   ("Vendedor: más · (8 piezas)"). `null` si no hay nada que decir.
 */
export function textoFranjaDiferencia(
  piezas: number,
  factor: number | null,
  unidadCompleta: string | null,
  quienContoMas: string | null,
): { valor: string; detalle: string | null } {
  const valor = formatearEnPaquetes(piezas, factor, unidadCompleta);
  // Sin factor el total en piezas repetiría el valor.
  const total = factor === null ? null : formatearTotalPiezas(piezas);
  const detalle = [quienContoMas, total].filter(Boolean).join(' · ');
  return { valor, detalle: detalle === '' ? null : detalle };
}
