/**
 * Paleta CERRADA de colores de familia. El supervisor le da a cada familia
 * del catalogo uno de estos colores para ubicarse mas rapido en el grid de
 * conteo; por omision ninguna tiene color.
 *
 * Cerrada y no un selector libre: un color libre permite elegir un amarillo
 * claro donde el texto deja de leerse en bodega. Aqui cada color trae sus
 * tonos ya calculados y probados (colores-familia.spec.ts):
 * - solido: el punto de la familia; al menos 3:1 sobre el fondo de pantalla.
 * - tinte: fondo de la pastilla de avance, el solido al 15 % sobre el fondo
 *   de pantalla de la app (#E3E7EF).
 * - texto: el texto de esa pastilla; al menos 4.5:1 sobre el tinte.
 *
 * La app movil tiene un espejo (`apps/movil/src/theme/colores-familia.ts`):
 * si cambia uno, cambia el otro.
 *
 * Capa de dominio: sin dependencias.
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
  rojo: { solido: '#DC2626', tinte: '#E2CAD1', texto: '#991B1B' },
  naranja: { solido: '#C2410C', tinte: '#DECECD', texto: '#9A3412' },
  ambar: { solido: '#B45309', tinte: '#DCD1CD', texto: '#78350F' },
  verde: { solido: '#15803D', tinte: '#C4D8D4', texto: '#14532D' },
  turquesa: { solido: '#0D9488', tinte: '#C3DBE0', texto: '#115E59' },
  azul: { solido: '#2563EB', tinte: '#C7D3EE', texto: '#1E40AF' },
  indigo: { solido: '#4F46E5', tinte: '#CDCFEE', texto: '#3730A3' },
  violeta: { solido: '#7C3AED', tinte: '#D4CDEF', texto: '#5B21B6' },
  rosa: { solido: '#DB2777', tinte: '#E2CADD', texto: '#9D174D' },
  cafe: { solido: '#92613A', tinte: '#D7D3D4', texto: '#5C3A1E' },
};

export function esColorFamiliaValido(valor: unknown): valor is ColorFamilia {
  return (
    typeof valor === 'string' &&
    (COLORES_FAMILIA as readonly string[]).includes(valor)
  );
}
