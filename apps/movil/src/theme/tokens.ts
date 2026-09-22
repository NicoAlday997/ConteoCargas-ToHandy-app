/**
 * Sistema de diseño de la app.
 *
 * Contexto operativo: el contador usa tablet en bodega con poca luz, de pie,
 * con las manos ocupadas. Alto contraste siempre; nunca gris sobre gris.
 * El color comunica estado (ver docs/06), nunca decora.
 */

export const COLORES = {
  fondo: '#FFFFFF',
  superficie: '#EEF2F6',
  texto: '#0F172A',
  textoSecundario: '#334155',
  textoSobreColor: '#FFFFFF',
  borde: '#94A3B8',

  // Estados semánticos
  capturado: '#15803D',
  pendiente: '#475569',
  discrepancia: '#D97706',
  exito: '#16A34A',
  error: '#DC2626',
} as const;

export type ClaveColor = keyof typeof COLORES;

export const ESPACIADO = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type ClaveEspaciado = keyof typeof ESPACIADO;

export const TIPOGRAFIA = {
  tamanos: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
  },
  pesos: {
    regular: '400',
    medio: '500',
    semiNegrita: '600',
    negrita: '700',
  },
} as const satisfies {
  tamanos: Record<string, number>;
  pesos: Record<string, TextoPeso>;
};

type TextoPeso = '400' | '500' | '600' | '700';

export const RADIOS = {
  sm: 4,
  md: 8,
  lg: 12,
  completo: 999,
} as const;

export type ClaveRadio = keyof typeof RADIOS;

/**
 * Altura mínima de toque. 56 y no 44: el usuario toca rápido, de pie,
 * con las manos ocupadas contando cajas — no hay margen para fallar el tap.
 */
export const TOQUE_MINIMO = 56;
