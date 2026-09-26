import {
  COLORES_FAMILIA,
  TONOS_COLOR_FAMILIA,
  esColorFamiliaValido,
} from './colores-familia';

/** Fondo de pantalla de la app (COLORES.fondo en apps/movil/src/theme/tokens.ts). */
const FONDO_PANTALLA = '#EDF0F7';

function canales(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminancia(hex: string): number {
  const [r, g, b] = canales(hex).map((canal) => {
    const v = canal / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe('colores de familia', () => {
  it('son exactamente los 10 de la paleta, todos con tonos', () => {
    expect(COLORES_FAMILIA).toHaveLength(10);
    expect(Object.keys(TONOS_COLOR_FAMILIA).sort()).toEqual(
      [...COLORES_FAMILIA].sort(),
    );
  });

  for (const color of COLORES_FAMILIA) {
    const { solido, tinte, texto } = TONOS_COLOR_FAMILIA[color];

    it(`${color}: el texto sobre el tinte llega a 4.5:1`, () => {
      expect(contraste(texto, tinte)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${color}: el punto se distingue del fondo de pantalla (3:1)`, () => {
      expect(contraste(solido, FONDO_PANTALLA)).toBeGreaterThanOrEqual(3);
    });

    it(`${color}: el tinte es el solido al 15 % sobre el fondo de pantalla`, () => {
      const esperado = canales(solido).map((c, i) =>
        Math.round(c * 0.15 + canales(FONDO_PANTALLA)[i] * 0.85),
      );
      expect(canales(tinte)).toEqual(esperado);
    });
  }

  it('esColorFamiliaValido acepta solo claves de la paleta', () => {
    expect(esColorFamiliaValido('turquesa')).toBe(true);
    expect(esColorFamiliaValido('amarillo')).toBe(false);
    expect(esColorFamiliaValido('#FF0000')).toBe(false);
    expect(esColorFamiliaValido('ROJO')).toBe(false);
    expect(esColorFamiliaValido(null)).toBe(false);
  });
});
