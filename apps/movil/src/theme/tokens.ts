import type { TextStyle } from 'react-native';

/**
 * Sistema de diseño de la app (docs/06 §1).
 *
 * Contexto operativo: el contador usa tablet en bodega con poca luz, de pie,
 * con las manos ocupadas. Los colores de estado comunican estado, nunca
 * decoran: un color, un estado.
 *
 * DOS SISTEMAS DE COLOR QUE NUNCA SE PISAN.
 *   - El ESTADO de una fila (sin contar, contado, no lleva, tecleando) tiñe la
 *     fila completa: fondo, borde, total y pastilla del factor.
 *   - El color de FAMILIA (lo asigna el supervisor, ver colores-familia.ts)
 *     solo identifica: la banda del encabezado de familia, y nada más.
 *
 * LO QUE FALTA CONTAR ES EL ESTADO NORMAL, NO UN AVISO: va neutro (blanco con
 * borde gris claro) y el color aparece conforme se avanza. El ÁMBAR
 * (`discrepancia`) es para avisos reales (empaque sin confirmar, sueltas que
 * completan un paquete, diferencias): si lo que falta fuera ámbar, al abrir
 * una carga la pantalla entera sería alarma y el ámbar dejaría de significar.
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
  /** Solo las lecturas de la báscula: el total de una fila, la cifra que domina una pantalla. */
  extraNegrita: 'Archivo_800ExtraBold',
} as const;

export type PesoFuente = keyof typeof FUENTE;

/**
 * Paleta de grado exterior. Se usa en bodega con poca luz, pero también en la
 * calle, bajo sol directo y con reflejos: ningún texto baja de 4.5:1 sobre el
 * fondo en que aparece, ningún contorno de control baja de 3:1, y lo blanco se
 * separa del fondo por algo más que el tinte (contorno o forma).
 */
export const COLORES = {
  /** Gris Andén: fondo de toda pantalla. Lo bastante hondo para que el blanco se lea como pieza. */
  fondo: '#E3E7EF',
  /** Tarjetas, modales, filas. */
  superficie: '#FFFFFF',
  /** Campos en reposo, pastillas neutras, bloques planos dentro de una tarjeta. */
  superficieHonda: '#D8DDE8',
  texto: '#0D1120',
  textoSecundario: '#495068',
  /** Rótulos de un dato ("Contó", "Productos"). Cumple AA sobre blanco y sobre el fondo. */
  textoTerciario: '#5B6279',
  textoSobreColor: '#FFFFFF',
  divisor: '#D3D9E4',
  /** Contorno de 1 px de una tarjeta blanca: la dibuja sobre el fondo aun con reflejo. */
  contornoTarjeta: '#C9D0DC',
  /** Contorno de controles (campos, teclas, opciones): 4:1 sobre blanco, 3.3:1 sobre el fondo. */
  borde: '#767E94',
  /** Borde de la fila SIN CONTAR: visible a pleno sol (2:1 sobre blanco) sin parecer un aviso. */
  bordeSinContar: '#AEB6C7',
  /** Borde de la fila NO LLEVA: un gris apenas más hondo que su fondo. */
  bordeNoLleva: '#C3C8D4',
  /** Oscurece lo de atrás de un modal. */
  velo: 'rgba(13, 17, 32, 0.62)',

  // MARCA: encabezado de trabajo y lo que se está tecleando.
  marca: '#1E4FE0',
  /** Bloques dentro del encabezado azul; campo inactivo de la fila que se teclea; presionado de `marca`. */
  marcaHonda: '#1638B0',
  /** Canal de la barra de progreso. */
  marcaProfunda: '#102A86',
  /** Texto que se retira sobre azul (5:1 sobre marca, 7.5:1 sobre marcaHonda). */
  marcaTenue: '#DCE5FF',
  marcaTinte: '#E7EDFF',
  /** Botón de volver sobre azul: un tono más claro que la marca, para que se vea como botón. */
  marcaClara: '#3A62EF',

  // CONTADO
  capturado: '#14B8A6',
  capturadoHondo: '#0B6E64',
  capturadoFondo: '#CFF0E9',
  capturadoTexto: '#0A3A35',

  // AVISO (ámbar): solo lo que pide atención, nunca lo que falta contar
  discrepancia: '#F59E0B',
  discrepanciaHonda: '#D97706',
  discrepanciaFondo: '#FEF3C7',
  discrepanciaTexto: '#92400E',

  // NO LLEVA / inactivo
  pendiente: '#545B70',
  pendienteFondo: '#DCDFE8',

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

/**
 * Las tareas del menú. Se reconocen por su ícono, NO por un color: el color es
 * de los estados (Regla de Un Color, Un Estado). En el menú todos los íconos
 * van en tinta sobre gris hundido.
 */
export type Tarea =
  | 'autorizar'
  | 'empaques'
  | 'plantillas'
  | 'historial'
  | 'personas'
  | 'diasNoLaborables'
  | 'coloresFamilia';

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
 * - total: la lectura de una fila de conteo (32 px ExtraBold); no es tocable.
 * - avance: el "4" del avance en el encabezado de conteo.
 * - campo: el número dentro de un campo de captura.
 * - tituloBarra: título del encabezado azul.
 * - tituloVacio: título de un estado vacío.
 * - subtitulo: el dato bajo su rótulo, el texto de un botón, el nombre de un producto.
 * - cuerpo: texto corrido e instrucciones.
 * - familia: nombre de la familia en su encabezado de la lista de conteo.
 * - etiqueta: texto de pastillas y notas.
 * - micro: rótulos de un dato y líneas de contexto (13 px, Medium: a pleno sol el Regular se deshace).
 * - rotulo: rótulo en mayúsculas de un campo de captura (12 px negrita). Nunca más
 *   chico: "PAQUETES" contra "SUELTAS" es la diferencia entre 12 y 144 piezas.
 */
export const TIPOGRAFIA = {
  numero: { fontFamily: FUENTE.extraNegrita, fontSize: 48, lineHeight: 54 },
  display: { fontFamily: FUENTE.negrita, fontSize: 34, lineHeight: 40 },
  total: { fontFamily: FUENTE.extraNegrita, fontSize: 32, lineHeight: 36 },
  titulo: { fontFamily: FUENTE.negrita, fontSize: 26, lineHeight: 32 },
  avance: { fontFamily: FUENTE.extraNegrita, fontSize: 28, lineHeight: 32 },
  campo: { fontFamily: FUENTE.negrita, fontSize: 22, lineHeight: 26 },
  tituloBarra: { fontFamily: FUENTE.negrita, fontSize: 20, lineHeight: 24 },
  tituloVacio: { fontFamily: FUENTE.semiNegrita, fontSize: 20, lineHeight: 26 },
  subtitulo: { fontFamily: FUENTE.semiNegrita, fontSize: 17, lineHeight: 22 },
  cuerpo: { fontFamily: FUENTE.regular, fontSize: 16, lineHeight: 22 },
  familia: { fontFamily: FUENTE.negrita, fontSize: 15, lineHeight: 20 },
  etiqueta: { fontFamily: FUENTE.semiNegrita, fontSize: 14, lineHeight: 18 },
  micro: { fontFamily: FUENTE.medio, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: FUENTE.negrita, fontSize: 12, lineHeight: 14 },
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
  letterSpacing: 0.6,
} as const satisfies TextStyle;

/**
 * Rótulo de un dato ("Contó", "Verificó", "Productos"): mayúscula inicial,
 * 13 px, en terciario. Cumple AA sobre tarjeta y sobre el fondo.
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
  /** Cuadro del ícono de una fila de menú. */
  icono: 11,
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
  // Contorno de 1: a pleno sol, blanco sobre gris claro se funde; el contorno
  // dibuja la pieza. No es un divisor: rodea, no separa.
  1: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.contornoTarjeta,
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

/** Alto de botones y campos de captura: el mismo toque mínimo, una sola medida. */
export const ALTO_CONTROL = TOQUE_MINIMO;

/** Ancho máximo de un modal en tablet: una columna que se lee de un vistazo. */
export const ANCHO_MODAL = 480;

/**
 * Movimiento. Todo es corto: la animación explica un cambio de estado y nunca
 * hace esperar la siguiente captura. Sale ya visible y frena al final
 * (ease-out exponencial); con "Reducir movimiento" se corta en seco.
 */
export const MOVIMIENTO = {
  /** Respuesta al toque (escala, tinte). */
  toque: 90,
  /** Un cambio pequeño: una pastilla, un aviso que entra. */
  rapido: 160,
  /** Entrada de una hoja o un diálogo. */
  hoja: 240,
  /** Destello que confirma una captura en la fila. */
  destello: 280,
} as const;

/** Curva ease-out exponencial (0.16, 1, 0.3, 1). */
export const CURVA_SALIDA = [0.16, 1, 0.3, 1] as const;

/** Escala al presionar algo grande (tarjeta, fila de menú): se hunde, no rebota. */
export const ESCALA_PRESIONADO = 0.98;

/**
 * Tope de escalado del texto del sistema (Dynamic Type / tamaño de fuente de
 * Android). El texto corrido crece libre; lo que vive en cajas de alto fijo
 * (teclas, campos de captura, lecturas de la fila) crece hasta un tope para que
 * la caja no reviente y el número siga leyéndose completo.
 */
export const ESCALA_TEXTO = {
  /** Teclas de los teclados propios, campos y totales de la fila de conteo. */
  control: 1.3,
  /** Encabezados, pastillas y barras de una sola línea. */
  compacto: 1.5,
} as const;

/** Teclas en tablet: sobra alto y el pulgar no alcanza a ver la tecla que toca. */
export const ALTO_TECLA_GRANDE = TOQUE_MINIMO + ESPACIADO.lg;
