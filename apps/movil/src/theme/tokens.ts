import type { TextStyle } from 'react-native';

/**
 * Sistema de diseño de la app.
 *
 * Contexto operativo: el contador usa tablet en bodega con poca luz, de pie,
 * con las manos ocupadas. Alto contraste siempre; nunca gris sobre gris.
 * Los colores de estado comunican estado (ver docs/06), nunca decoran: un
 * color, un estado. La identidad la pone la marca (azul), que nunca significa
 * un estado: acciones principales, encabezados y lo que se está editando.
 *
 * Todo texto cumple al menos 4.5:1 sobre el fondo en que aparece (ver
 * contraste.spec.ts, que lo comprueba par por par).
 */

export const COLORES = {
  // Marca: azul profundo. Es el lenguaje de logística y distribución, se lee
  // con poca luz y no se confunde con los verdes y ámbares que comunican
  // estado. Nunca verde: verde ya significa "capturado".
  /** Acción principal, encabezados de marca, lo que se está editando. Texto blanco encima. */
  marca: '#1D4ED8',
  /** Texto de marca sobre fondos claros; estado presionado de lo que es `marca`. */
  marcaOscuro: '#1E3A8A',
  /** Fondo tintado de marca (pastillas, bloques informativos); texto secundario sobre `marca`. */
  marcaClaro: '#DBEAFE',

  /** Fondo de las pantallas: tinte muy sutil hacia la marca. Las tarjetas van en blanco encima. */
  fondoPantalla: '#EEF2F9',
  /** Tarjetas, modales y controles (nivel 1). */
  fondo: '#FFFFFF',
  /** Bloques planos dentro de una tarjeta (nivel 0) y estado presionado. */
  superficie: '#E8EEF7',
  texto: '#0F172A',
  textoSecundario: '#334155',
  textoSobreColor: '#FFFFFF',
  /** Contorno de controles: 3:1 sobre fondo, superficie y los fondos de estado; se distingue con poca luz. */
  borde: '#74849B',
  /** Línea que cierra una tabla (el total bajo los sumandos); nunca delimita un control. */
  divisor: '#CBD5E1',
  /** Oscurece lo de atrás de un modal. */
  velo: 'rgba(15, 23, 42, 0.6)',

  // Estados semánticos. Cada uno tiene tres tonos:
  // - sólido: sirve igual como texto, borde o fondo con texto blanco;
  // - Fondo: bloque completo tintado del estado;
  // - Texto: texto oscuro sobre su Fondo (≥ 4.5:1).
  /** Verde: capturado, coincide, listo. */
  capturado: '#157A3A',
  capturadoFondo: '#DCFCE7',
  capturadoTexto: '#14532D',
  /** Gris: en espera, marcado en cero, inactivo. */
  pendiente: '#475569',
  pendienteFondo: '#E2E8F0',
  pendienteTexto: '#1E293B',
  /** Ámbar: atención, discrepancia. Oscurecido para leerse como texto (el ámbar claro no llega a 3.2:1). */
  discrepancia: '#A44B07',
  discrepanciaFondo: '#FEF3C7',
  discrepanciaTexto: '#78350F',
  /** Rojo: bloqueado, rechazado, error. */
  error: '#B91C1C',
  errorFondo: '#FEE2E2',
  errorTexto: '#7F1D1D',
} as const;

export type ClaveColor = keyof typeof COLORES;

/** Colores que comunican un estado; los únicos que admiten Etiqueta y acento de Tarjeta. */
export type ColorEstado = 'capturado' | 'pendiente' | 'discrepancia' | 'error';

/** Estados más la marca: lo que admite una banda de color o una pastilla tintada. */
export type ColorTono = ColorEstado | 'marca';

/** Los tres tonos de un color: sólido (con texto blanco), fondo tintado y texto sobre ese fondo. */
export const TONOS: Record<ColorTono, { solido: string; fondo: string; texto: string }> = {
  marca: { solido: COLORES.marca, fondo: COLORES.marcaClaro, texto: COLORES.marcaOscuro },
  capturado: { solido: COLORES.capturado, fondo: COLORES.capturadoFondo, texto: COLORES.capturadoTexto },
  pendiente: { solido: COLORES.pendiente, fondo: COLORES.pendienteFondo, texto: COLORES.pendienteTexto },
  discrepancia: { solido: COLORES.discrepancia, fondo: COLORES.discrepanciaFondo, texto: COLORES.discrepanciaTexto },
  error: { solido: COLORES.error, fondo: COLORES.errorFondo, texto: COLORES.errorTexto },
};

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

/**
 * Ritmo: los mismos tres saltos en toda la app. Todo valor de espaciado es
 * múltiplo de 4 y sale de aquí o de ESPACIADO; nada inventado caso por caso.
 * Cuanto más lejos en la jerarquía, más aire: un título de sección queda más
 * cerca de lo que agrupa que de la sección anterior.
 */
export const RITMO = {
  /** Dentro de un componente: título y detalle, icono y texto. */
  interno: ESPACIADO.sm,
  /** Entre componentes relacionados: tarjetas de una lista, botones de un grupo. */
  relacionado: ESPACIADO.md,
  /** Entre secciones distintas. */
  seccion: ESPACIADO.xxl,
  /** Margen lateral de la pantalla y relleno de los bloques. */
  margen: ESPACIADO.lg,
} as const;

type TextoPeso = '400' | '500' | '600' | '700' | '800';

/** Para resaltar una palabra dentro de un estilo de la escala, sin cambiar su tamaño. */
export const PESOS = {
  regular: '400',
  medio: '500',
  semiNegrita: '600',
  negrita: '700',
  extraNegrita: '800',
} as const satisfies Record<string, TextoPeso>;

interface EstiloTexto {
  fontSize: number;
  fontWeight: TextoPeso;
  lineHeight: number;
}

/**
 * Escala tipográfica. Cada nivel se lee claramente distinto del de al lado:
 * el dato principal se lee de lejos y lo secundario se retira.
 *
 * - numero: la cifra que domina la pantalla (total de piezas de una carga,
 *   progreso, cantidad final), como el total de un pedido.
 * - display: el número que se busca con la mirada (dígitos del PIN, el 0 de "no lleva").
 * - titulo: título de pantalla o de modal; valores capturados.
 * - subtitulo: lo principal de una tarjeta (ruta, producto, cantidad final).
 * - cuerpo: texto corrido e instrucciones.
 * - etiqueta: rótulos, datos secundarios, texto de etiquetas.
 * - micro: rótulos de campo en mayúsculas y unidades.
 */
export const TIPOGRAFIA = {
  numero: { fontSize: 48, fontWeight: PESOS.extraNegrita, lineHeight: 54 },
  display: { fontSize: 34, fontWeight: PESOS.negrita, lineHeight: 40 },
  titulo: { fontSize: 24, fontWeight: PESOS.negrita, lineHeight: 30 },
  subtitulo: { fontSize: 18, fontWeight: PESOS.semiNegrita, lineHeight: 24 },
  cuerpo: { fontSize: 16, fontWeight: PESOS.regular, lineHeight: 22 },
  etiqueta: { fontSize: 14, fontWeight: PESOS.semiNegrita, lineHeight: 18 },
  micro: { fontSize: 12, fontWeight: PESOS.semiNegrita, lineHeight: 16 },
} as const satisfies Record<string, EstiloTexto>;

export type NivelTipografia = keyof typeof TIPOGRAFIA;

/**
 * Para toda cifra que se compara con otra (cantidades, totales, progreso):
 * dígitos del mismo ancho, así 120 y 99 quedan alineados y nada baila al cambiar.
 */
export const CIFRAS: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const RADIOS = {
  /** Bloques internos y avisos. */
  chico: 6,
  /** Filas de la lista de conteo, campos, teclas y botones. */
  medio: 12,
  /** Tarjetas y modales. No más: más redondo roba espacio en las esquinas de listas largas. */
  grande: 16,
  completo: 999,
} as const;

export type ClaveRadio = keyof typeof RADIOS;

export const BORDES = {
  fino: 1,
  medio: 2,
  grueso: 3,
  /** Barra de estado a la izquierda de una tarjeta. */
  acento: 4,
} as const;

/**
 * Elevación sin sombras ni contornos: separan el cambio de fondo y el espacio.
 * El contorno se reserva para los controles (campos, teclas, opciones), donde
 * marca lo que se toca; un bloque de lectura nunca lo lleva.
 * - 0: plano, un bloque dentro de otro (resúmenes, tablas).
 * - 1: separado, un bloque independiente en una lista (tarjeta blanca sobre el fondo tintado).
 */
export const ELEVACION = {
  0: {
    backgroundColor: COLORES.superficie,
    borderWidth: 0,
  },
  1: {
    backgroundColor: COLORES.fondo,
    borderWidth: 0,
  },
} as const;

export type NivelElevacion = keyof typeof ELEVACION;

export const OPACIDAD = {
  /** Deshabilitado: se ve apagado pero se sigue leyendo. */
  deshabilitado: 0.5,
  /** Bloqueado a propósito (el 0 de una fila ya contada): más apagado que deshabilitado. */
  bloqueado: 0.3,
  /** Barras del esqueleto de carga. */
  esqueleto: 0.35,
  /** Punto bajo del pulso del esqueleto (sobre la opacidad de las barras). */
  pulsoEsqueleto: 0.5,
} as const;

/**
 * Altura mínima de toque. 56 y no 44: el usuario toca rápido, de pie,
 * con las manos ocupadas contando cajas — no hay margen para fallar el tap.
 */
export const TOQUE_MINIMO = 56;

/** Ancho máximo de un modal en tablet: una columna que se lee de un vistazo. */
export const ANCHO_MODAL = 480;
