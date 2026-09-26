import type { TextStyle } from 'react-native';

/**
 * Sistema de diseño de la app (docs/06 §1).
 *
 * Contexto operativo: el contador usa tablet en bodega con poca luz, de pie,
 * con las manos ocupadas. Los colores de estado comunican estado, nunca
 * decoran: un color, un estado.
 *
 * DOS SISTEMAS DE COLOR QUE NUNCA SE PISAN.
 *   - El ESTADO de una fila (falta, contado, no lleva, tecleando) tiñe la fila
 *     completa: fondo, borde, total y pastilla del factor.
 *   - El color de FAMILIA (lo asigna el supervisor, ver colores-familia.ts)
 *     solo identifica: el punto y la pastilla del encabezado de familia, y
 *     nada más.
 *
 * EL AZUL (`marca`) es el encabezado de las pantallas de trabajo, la acción
 * principal (un botón por pantalla) y lo que se está tecleando. Nunca un
 * estado.
 *
 * Todo texto cumple 4.5:1 sobre el fondo en que aparece salvo las
 * excepciones documentadas par por par en contraste.spec.ts.
 */

/**
 * La tipografía entera sale de aquí: cambiar de fuente es tocar solo esto (y
 * la carga en app/_layout.tsx). Con fuente propia React Native NO aplica
 * `fontWeight`: el peso se elige con la variante. Nunca se usa `fontWeight`
 * en un estilo; se usa `fontFamily: FUENTE.x`.
 */
export const FUENTE = {
  regular: 'Archivo_400Regular',
  medio: 'Archivo_500Medium',
  semiNegrita: 'Archivo_600SemiBold',
  negrita: 'Archivo_700Bold',
} as const;

export type PesoFuente = keyof typeof FUENTE;

export const COLORES = {
  /** Fondo de pantalla. */
  fondo: '#EDF0F7',
  /** Tarjetas, modales, filas. */
  superficie: '#FFFFFF',
  /** Campos en reposo, pastillas neutras, bloques planos dentro de una tarjeta. */
  superficieHonda: '#E3E7F2',
  texto: '#13172A',
  textoSecundario: '#5A6076',
  /** Rótulos de un dato ("Contó", "Productos"). Solo sobre `superficie`. */
  textoTerciario: '#8B92A8',
  textoSobreColor: '#FFFFFF',
  divisor: '#DDE2EE',
  /** Contorno de controles que no son campos (opciones, botón de contorno): 3:1 sobre blanco. */
  borde: '#8B92A8',
  /** Oscurece lo de atrás de un modal. */
  velo: 'rgba(19, 23, 42, 0.6)',

  // MARCA: encabezado de trabajo y lo que se está tecleando.
  marca: '#1E4FE0',
  /** Bloques dentro del encabezado azul; campo inactivo de la fila que se teclea; presionado de `marca`. */
  marcaHonda: '#1638B0',
  /** Canal de la barra de progreso. */
  marcaProfunda: '#102A86',
  /** Texto que se retira sobre azul. */
  marcaTenue: '#C9D7FF',
  marcaTinte: '#E7EDFF',

  // CONTADO
  capturado: '#14B8A6',
  capturadoHondo: '#0E7E72',
  capturadoFondo: '#D6F5F0',
  capturadoTexto: '#0B3B37',

  // FALTA
  discrepancia: '#F59E0B',
  discrepanciaHonda: '#D97706',
  discrepanciaFondo: '#FEF3C7',
  discrepanciaTexto: '#92400E',

  // NO LLEVA / inactivo
  pendiente: '#6B7185',
  pendienteFondo: '#E4E6EE',

  // ERROR
  error: '#DC2626',
  errorFondo: '#FEE7E7',
  errorTexto: '#911B1B',
} as const;

export type ClaveColor = keyof typeof COLORES;

/** Colores que comunican un estado; los únicos que admiten Etiqueta y tarjeta tintada. */
export type ColorEstado = 'capturado' | 'pendiente' | 'discrepancia' | 'error';

/** Estados más la marca: lo que admite una pastilla tintada. */
export type ColorTono = ColorEstado | 'marca';

/**
 * Los tres tonos de un color:
 * - solido: relleno con texto blanco encima (≥ 4.5:1);
 * - fondo: tinte del estado;
 * - texto: texto oscuro sobre ese tinte (≥ 4.5:1).
 * Las pastillas de estado son siempre `fondo` + `texto`.
 */
export const TONOS: Record<ColorTono, { solido: string; fondo: string; texto: string }> = {
  marca: { solido: COLORES.marca, fondo: COLORES.marcaTinte, texto: COLORES.marcaHonda },
  capturado: { solido: COLORES.capturadoHondo, fondo: COLORES.capturadoFondo, texto: COLORES.capturadoTexto },
  pendiente: { solido: COLORES.pendiente, fondo: COLORES.pendienteFondo, texto: COLORES.textoSecundario },
  discrepancia: { solido: COLORES.discrepanciaTexto, fondo: COLORES.discrepanciaFondo, texto: COLORES.discrepanciaTexto },
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
 * Ritmo. Lo que hace que el ojo agrupe solo es la PROPORCIÓN: poco aire dentro
 * de un grupo y mucho entre grupos, nunca divisores. Todo valor es múltiplo de
 * 4 y sale de aquí o de ESPACIADO; nada inventado caso por caso.
 */
export const RITMO = {
  /** Dentro de un grupo: título y detalle, datos de un mismo bloque. */
  interno: ESPACIADO.xs,
  /** Entre componentes hermanos: tarjetas de una lista, botones de un grupo. */
  relacionado: ESPACIADO.md,
  /** Entre grupos de datos dentro de una tarjeta o un panel (quién contó / cuánto). */
  grupo: ESPACIADO.xl,
  /** Entre secciones distintas de una pantalla. */
  seccion: ESPACIADO.xxxl,
  /** Margen lateral de la pantalla y relleno de los bloques. */
  margen: ESPACIADO.lg,
} as const;

interface EstiloTexto {
  fontFamily: (typeof FUENTE)[PesoFuente];
  fontSize: number;
  lineHeight: number;
}

/**
 * Escala tipográfica. Cada nivel lleva su variante de fuente.
 *
 * - numero: la cifra que domina la pantalla (total de piezas de una carga).
 * - display: el número que se busca con la mirada (dígitos del PIN).
 * - titulo: el nombre grande de login e inicio de rol, título de un modal.
 * - total: el total de una fila de conteo (33 px); no es tocable.
 * - avance: el "4" del avance en el encabezado de conteo.
 * - campo: el número dentro de un campo de captura.
 * - tituloBarra: título del encabezado azul.
 * - subtitulo: el dato bajo su rótulo, el texto de un botón, el nombre de un producto.
 * - cuerpo: texto corrido e instrucciones.
 * - familia: nombre de la familia en su encabezado de la lista de conteo.
 * - etiqueta: texto de pastillas y notas.
 * - micro: rótulos de un dato y líneas de contexto (12 px).
 * - rotulo: rótulo en mayúsculas de un campo de captura (9 px).
 */
export const TIPOGRAFIA = {
  numero: { fontFamily: FUENTE.negrita, fontSize: 48, lineHeight: 54 },
  display: { fontFamily: FUENTE.negrita, fontSize: 34, lineHeight: 40 },
  total: { fontFamily: FUENTE.negrita, fontSize: 33, lineHeight: 38 },
  titulo: { fontFamily: FUENTE.negrita, fontSize: 26, lineHeight: 32 },
  avance: { fontFamily: FUENTE.negrita, fontSize: 26, lineHeight: 30 },
  campo: { fontFamily: FUENTE.semiNegrita, fontSize: 21, lineHeight: 26 },
  tituloBarra: { fontFamily: FUENTE.semiNegrita, fontSize: 19, lineHeight: 24 },
  subtitulo: { fontFamily: FUENTE.semiNegrita, fontSize: 17, lineHeight: 22 },
  cuerpo: { fontFamily: FUENTE.regular, fontSize: 16, lineHeight: 22 },
  familia: { fontFamily: FUENTE.semiNegrita, fontSize: 15, lineHeight: 20 },
  etiqueta: { fontFamily: FUENTE.semiNegrita, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: FUENTE.regular, fontSize: 12, lineHeight: 16 },
  rotulo: { fontFamily: FUENTE.semiNegrita, fontSize: 9, lineHeight: 12 },
} as const satisfies Record<string, EstiloTexto>;

export type NivelTipografia = keyof typeof TIPOGRAFIA;

/**
 * Rótulo en MAYÚSCULAS: solo los campos de captura ("PAQUETES", "SUELTAS") y
 * la unidad de un total ("PIEZAS"). Cualquier otro rótulo usa ETIQUETA_DATO.
 */
export const ROTULO = {
  ...TIPOGRAFIA.rotulo,
  color: COLORES.textoSecundario,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
} as const satisfies TextStyle;

/**
 * Rótulo de un dato ("Contó", "Verificó", "Productos"): mayúscula inicial,
 * 12 px, en terciario. Va sobre tarjeta blanca (ver contraste.spec.ts).
 */
export const ETIQUETA_DATO = {
  ...TIPOGRAFIA.micro,
  color: COLORES.textoTerciario,
} as const satisfies TextStyle;

/** El dato bajo su rótulo ("Irvin Alday"): fuerte y en el color principal. */
export const DATO = {
  ...TIPOGRAFIA.subtitulo,
  fontFamily: FUENTE.negrita,
  color: COLORES.texto,
} as const satisfies TextStyle;

/** Un dato que todavía no existe ("Pendiente"): mismo tamaño que DATO, sin peso y en secundario. */
export const DATO_AUSENTE = {
  ...TIPOGRAFIA.subtitulo,
  fontFamily: FUENTE.regular,
  color: COLORES.textoSecundario,
} as const satisfies TextStyle;

/**
 * Para toda cifra que se compara con otra (cantidades, totales, progreso):
 * dígitos del mismo ancho, así las columnas quedan alineadas al recorrer la lista.
 */
export const CIFRAS: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const RADIOS = {
  /** Bloques internos y avisos. */
  chico: 6,
  /** Campos, teclas, botones, el botón 0. */
  medio: 12,
  /** Paneles dentro del encabezado azul. */
  panel: 14,
  /** Tarjetas, filas de conteo y modales. */
  grande: 18,
  /** Esquinas inferiores del encabezado azul. */
  encabezado: 22,
  completo: 999,
} as const;

export type ClaveRadio = keyof typeof RADIOS;

export const BORDES = {
  fino: 1,
  medio: 2,
  grueso: 3,
} as const;

/**
 * Elevación sin sombras: separan el cambio de fondo y el espacio.
 * - 0: plano, un bloque dentro de otro (resúmenes, tablas).
 * - 1: una tarjeta blanca sobre el fondo de pantalla.
 */
export const ELEVACION = {
  0: {
    backgroundColor: COLORES.superficieHonda,
    borderWidth: 0,
  },
  1: {
    backgroundColor: COLORES.superficie,
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

/** Alto del botón principal y de los campos de captura. */
export const ALTO_CONTROL = 54;

/** Ancho máximo de un modal en tablet: una columna que se lee de un vistazo. */
export const ANCHO_MODAL = 480;
