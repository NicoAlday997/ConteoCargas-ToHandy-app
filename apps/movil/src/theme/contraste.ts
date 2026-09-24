/** Razón de contraste WCAG 2.x entre dos colores `#RRGGBB` (de 1 a 21). */
export function razonContraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

function luminancia(hex: string): number {
  const coincide = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!coincide) throw new Error(`Color no soportado: ${hex}`);
  const [r, g, b] = coincide.slice(1).map((canal) => {
    const v = parseInt(canal, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
