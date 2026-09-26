/**
 * Paleta CERRADA de colores de familia: espejo de
 * `apps/backend/src/modules/catalogo/domain/colores-familia.ts` (una prueba
 * comprueba que coincidan). El supervisor le da a cada familia uno de estos
 * colores; por omisión ninguna tiene y se ven neutras.
 *
 * El color de familia IDENTIFICA: solo el punto y la pastilla del encabezado
 * de familia en el conteo. El estado de una fila lo COMUNICA otro sistema
 * (ver tokens.ts); nunca se pisan.
 *
 * - solido: el punto; al menos 3:1 sobre el fondo de pantalla.
 * - tinte: fondo de la pastilla, el sólido al 15 % sobre el fondo de pantalla.
 * - texto: texto de la pastilla; al menos 4.5:1 sobre el tinte.
 */

export const COLORES_FAMILIA = [
  'rojo',
  'naranja',
  'ambar',
  'verde',
  'turquesa',
  'azul',
  'indigo',
  'violeta',
  'rosa',
  'cafe',
] as const;

export type ColorFamilia = (typeof COLORES_FAMILIA)[number];

export interface TonosColorFamilia {
  solido: string;
  tinte: string;
  texto: string;
}

export const TONOS_COLOR_FAMILIA: Record<ColorFamilia, TonosColorFamilia> = {
  rojo: { solido: '#DC2626', tinte: '#EAD2D8', texto: '#991B1B' },
  naranja: { solido: '#EA580C', tinte: '#EDD9D4', texto: '#9A3412' },
  ambar: { solido: '#B45309', tinte: '#E4D8D3', texto: '#78350F' },
  verde: { solido: '#15803D', tinte: '#CDDFDB', texto: '#14532D' },
  turquesa: { solido: '#0D9488', tinte: '#CBE2E6', texto: '#115E59' },
  azul: { solido: '#2563EB', tinte: '#CFDBF5', texto: '#1E40AF' },
  indigo: { solido: '#4F46E5', tinte: '#D5D7F4', texto: '#3730A3' },
  violeta: { solido: '#7C3AED', tinte: '#DCD5F6', texto: '#5B21B6' },
  rosa: { solido: '#DB2777', tinte: '#EAD2E4', texto: '#9D174D' },
  cafe: { solido: '#92613A', tinte: '#DFDBDB', texto: '#5C3A1E' },
};

/** Nombre que ve el supervisor al elegir. */
export const NOMBRES_COLOR_FAMILIA: Record<ColorFamilia, string> = {
  rojo: 'Rojo',
  naranja: 'Naranja',
  ambar: 'Ámbar',
  verde: 'Verde',
  turquesa: 'Turquesa',
  azul: 'Azul',
  indigo: 'Índigo',
  violeta: 'Violeta',
  rosa: 'Rosa',
  cafe: 'Café',
};

export function esColorFamiliaValido(valor: unknown): valor is ColorFamilia {
  return typeof valor === 'string' && (COLORES_FAMILIA as readonly string[]).includes(valor);
}

/** Lo que llega del servidor: un color que ya no esté en la paleta se ve neutro. */
export function colorFamiliaDesdeApi(valor: unknown): ColorFamilia | null {
  return esColorFamiliaValido(valor) ? valor : null;
}
