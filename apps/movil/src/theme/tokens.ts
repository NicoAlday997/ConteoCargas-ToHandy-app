import type { TextStyle } from 'react-native';

/**
 * Sistema de diseño "Señalamiento de Ruta" (docs/06 §1, DESIGN.md).
 *
 * La app se lee como un letrero de carretera: de un vistazo, con prisa y a
 * cualquier luz (sol directo, bodega en penumbra, cabina de noche). Por eso
 * alto contraste, pocas formas, letra de señalamiento y cifras grandes.
 *
 * TRES CAPAS DE COLOR, CADA UNA CON UN SOLO TRABAJO.
 *   - ASFALTO (`marca`): el cromo y la mano. Encabezados, teclados, la fila
 *     que se está tecleando y lo seleccionado. Es casi negro; nunca un estado.
 *   - VERDE RUTA (`accion`, `capturado`): avanzar y "ya quedó". La acción
 *     principal (una por pantalla), la tecla de avance, el carril de avance y
 *     lo contado. Verde es camino libre, como en el señalamiento.
 *   - SEÑALES DE ESTADO: amarillo preventivo (aviso, siempre con rombo), rojo
 *     alto (error, siempre con su glifo) y gris (no lleva). Un color, un estado.
 *   El color de FAMILIA (colores-familia.ts) solo identifica la banda de su
 *   encabezado en el conteo.
 *
 * LO QUE FALTA CONTAR ES EL ESTADO NORMAL, NO UN AVISO: va en blanco, con el
 * visor hueco. El amarillo es solo para avisos reales.
 *
 * Todo texto cumple 4.5:1 sobre el fondo en que aparece salvo las
 * excepciones documentadas par por par en contraste.spec.ts.
 */

/**
 * La tipografía entera sale de aquí: cambiar de fuente es tocar solo esto (y
 * la carga en app/_layout.tsx). Con fuente propia React Native NO aplica
 * `fontWeight`: el peso se elige con la variante.
 *
 * Dos cortes de una misma familia de señalamiento:
 * - Barlow: texto, botones y datos. Grotesca de trazo firme y terminales
 *   suaves, dibujada a partir del señalamiento vial; no se deshace al sol.
 * - Barlow Semi Condensed: la voz del letrero. Títulos, rótulos en mayúsculas
 *   y toda lectura numérica: cabe "1440" en el visor sin encoger la cifra.
 */
export const FUENTE = {
  regular: 'Barlow_400Regular',
  medio: 'Barlow_500Medium',
  semiNegrita: 'Barlow_600SemiBold',
  negrita: 'Barlow_700Bold',
  /** Rótulos en mayúsculas y placas de estado (condensada). */
  rotulo: 'BarlowSemiCondensed_600SemiBold',
  /** Títulos y encabezados (condensada). */
  titular: 'BarlowSemiCondensed_700Bold',
  /** Solo las lecturas: el total de una fila, la cifra que domina una pantalla, las teclas. */
  extraNegrita: 'BarlowSemiCondensed_800ExtraBold',
} as const;

export type PesoFuente = keyof typeof FUENTE;

/**
 * Paleta de grado exterior. Ningún texto baja de 4.5:1 sobre el fondo en que
 * aparece, ningún contorno de control baja de 3:1, y lo blanco se separa del
 * fondo por algo más que el tinte (contorno o forma).
 */
export const COLORES = {
  /** Concreto: fondo de toda pantalla. Gris cálido y mate; el blanco se lee como pieza encima. */
  fondo: '#E7E8E3',
  /** Blanco reflectivo: tarjetas, modales, filas. */
  superficie: '#FFFFFF',
  /** Campos en reposo, placas neutras, bloques planos dentro de una tarjeta. */
  superficieHonda: '#DBDDD6',
  /** Tinta asfalto. */
  texto: '#14181B',
  textoSecundario: '#474D51',
  /** Rótulos de un dato. Cumple AA sobre blanco y sobre el concreto. */
  textoTerciario: '#585E62',
  textoSobreColor: '#FFFFFF',
  divisor: '#D0D3CB',
  /** Contorno de 1 px de una pieza blanca: la dibuja sobre el concreto aun con reflejo. */
  contornoTarjeta: '#C4C8C0',
  /** Contorno de controles (campos, teclas, opciones): ≥ 3:1 sobre blanco y sobre el fondo. */
  borde: '#747A74',
  /** Borde de la fila SIN CONTAR: visible a pleno sol sin parecer un aviso. */
  bordeSinContar: '#A9ADA5',
  /** Borde de la fila NO LLEVA: apenas más hondo que su fondo. */
  bordeNoLleva: '#C2C5BD',
  /** Oscurece lo de atrás de un modal. */
  velo: 'rgba(12, 15, 18, 0.66)',

  // ASFALTO: el cromo y la mano (encabezados, teclados, lo que se teclea).
  marca: '#171B1F',
  /** Piezas sobre asfalto (paneles, teclas, campos inactivos de la fila que se teclea). */
  marcaHonda: '#262C32',
  /** Canal del carril de avance. */
  marcaProfunda: '#0C0F12',
  /** Texto que se retira sobre asfalto (≥ 7:1 sobre marca y marcaHonda). */
  marcaTenue: '#B8C0C6',
  /** Presionado o seleccionado sobre claro: un gris frío que no es un estado. */
  marcaTinte: '#E2E5E1',
  /** Botón de volver sobre asfalto: un tono arriba, para que se vea como botón. */
  marcaClara: '#394148',
  /** Marcas de carril (lo que falta del avance) sobre asfalto. */
  carril: '#6A737B',

  // VERDE RUTA: avanzar y "ya quedó".
  accion: '#0A6B4E',
  accionHonda: '#07523C',
  /** Verde vivo sobre asfalto: relleno del carril de avance. */
  accionViva: '#35C77E',

  // CONTADO (la misma familia verde)
  capturado: '#2E9A69',
  capturadoHondo: '#0A6B4E',
  capturadoFondo: '#DCEFE5',
  capturadoTexto: '#063E2D',

  // AVISO: amarillo preventivo. Siempre con rombo; nunca lo que falta contar.
  discrepancia: '#FFC21A',
  discrepanciaHonda: '#C98F00',
  discrepanciaFondo: '#FFF1C4',
  discrepanciaTexto: '#6A4700',

  // NO LLEVA / inactivo
  pendiente: '#555B5F',
  pendienteFondo: '#DDDFDA',

  // ERROR: rojo alto
  error: '#C4132C',
  errorFondo: '#FCE4E6',
  errorTexto: '#8C0D20',
} as const;

export type ClaveColor = keyof typeof COLORES;

/**
 * Onda de Android al tocar (`android_ripple`). Translúcida a propósito: se
 * pinta ENCIMA del control y deja ver su fondo. En iOS no hay onda.
 */
export const ONDA = {
  /** Sobre blanco o gris: tinta al 12 %. */
  sobreClaro: 'rgba(20, 24, 27, 0.12)',
  /** Sobre un relleno de color (azul, turquesa): blanco al 24 %. */
  sobreColor: 'rgba(255, 255, 255, 0.24)',
  /** Sobre una tarjeta tocable: asfalto al 10 %. */
  marca: 'rgba(23, 27, 31, 0.10)',
  /** Acción destructiva sobre blanco. */
  peligro: 'rgba(196, 19, 44, 0.16)',
} as const;

/** Colores que comunican un estado; los únicos que admiten Etiqueta y tarjeta tintada. */
export type ColorEstado = 'capturado' | 'pendiente' | 'discrepancia' | 'error';

/** Estados más la marca: lo que admite una pastilla tintada. */
export type ColorTono = ColorEstado | 'marca' | 'accion';

/**
 * Los tres tonos de un color:
 * - solido: relleno con texto blanco encima (≥ 4.5:1);
 * - fondo: tinte del estado;
 * - texto: texto oscuro sobre ese tinte (≥ 4.5:1).
 * Las pastillas de estado son siempre `fondo` + `texto`.
 */
export const TONOS: Record<ColorTono, { solido: string; fondo: string; texto: string }> = {
  marca: { solido: COLORES.marca, fondo: COLORES.marcaTinte, texto: COLORES.marcaHonda },
  accion: { solido: COLORES.accion, fondo: COLORES.capturadoFondo, texto: COLORES.capturadoTexto },
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
 * Escala tipográfica. Cada nivel lleva su variante de fuente. Los niveles de
 * letrero (títulos, lecturas, rótulos) van en la condensada; el texto que se
 * lee corrido, en Barlow.
 *
 * - numero: la cifra que domina la pantalla (lo que falta por resolver).
 * - display: el nombre de quien está en sesión; los dígitos del PIN.
 * - titulo: título de un modal, de un paso; el texto de un botón grande.
 * - total: la lectura de una fila de conteo; no es tocable.
 * - avance: el "4" del avance en el encabezado de conteo.
 * - campo: el número dentro de un campo de captura.
 * - tecla: el dígito de una tecla de los teclados propios.
 * - tituloBarra: título de un encabezado.
 * - tituloVacio: título de un estado vacío.
 * - subtitulo: el dato bajo su rótulo, el texto de un botón, el nombre de un producto.
 * - cuerpo: texto corrido e instrucciones.
 * - familia: nombre de la familia en su banda (mayúsculas, como un letrero de salida).
 * - etiqueta: texto de notas y avisos.
 * - micro: rótulos de un dato y líneas de contexto (Medium: a pleno sol el Regular se deshace).
 * - rotulo: rótulo en MAYÚSCULAS de un campo de captura o de una placa. Nunca
 *   más chico: "PAQUETES" contra "SUELTAS" es la diferencia entre 12 y 144 piezas.
 */
export const TIPOGRAFIA = {
  numero: { fontFamily: FUENTE.extraNegrita, fontSize: 60, lineHeight: 62 },
  display: { fontFamily: FUENTE.titular, fontSize: 36, lineHeight: 40 },
  total: { fontFamily: FUENTE.extraNegrita, fontSize: 34, lineHeight: 36 },
  titulo: { fontFamily: FUENTE.titular, fontSize: 28, lineHeight: 32 },
  avance: { fontFamily: FUENTE.extraNegrita, fontSize: 40, lineHeight: 42 },
  campo: { fontFamily: FUENTE.titular, fontSize: 24, lineHeight: 28 },
  tecla: { fontFamily: FUENTE.titular, fontSize: 30, lineHeight: 34 },
  tituloBarra: { fontFamily: FUENTE.titular, fontSize: 22, lineHeight: 26 },
  tituloVacio: { fontFamily: FUENTE.titular, fontSize: 22, lineHeight: 26 },
  subtitulo: { fontFamily: FUENTE.semiNegrita, fontSize: 17, lineHeight: 22 },
  cuerpo: { fontFamily: FUENTE.regular, fontSize: 16, lineHeight: 23 },
  familia: { fontFamily: FUENTE.titular, fontSize: 16, lineHeight: 20 },
  etiqueta: { fontFamily: FUENTE.semiNegrita, fontSize: 14, lineHeight: 19 },
  micro: { fontFamily: FUENTE.medio, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: FUENTE.rotulo, fontSize: 12, lineHeight: 14 },
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
  letterSpacing: 1,
} as const satisfies TextStyle;

/**
 * El nombre de una familia en su banda: mayúsculas condensadas, como la
 * leyenda de un letrero de salida ("REFRESCOS", "AGUAS").
 */
export const FAMILIA = {
  ...TIPOGRAFIA.familia,
  textTransform: 'uppercase',
  letterSpacing: 1,
} as const satisfies TextStyle;

/**
 * Placa: el texto de una placa de estado o de un letrero pequeño ("ESPERANDO
 * CONTADOR", "RUTA 3"). Mayúsculas condensadas con aire entre letras, como
 * la leyenda de un letrero; se lee de reojo aun a pleno sol.
 */
export const PLACA = {
  fontFamily: FUENTE.titular,
  fontSize: 14,
  lineHeight: 18,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
} as const satisfies TextStyle;

/**
 * Rótulo de un dato ("CONTÓ", "VERIFICÓ", "PRODUCTOS"): la leyenda de un
 * letrero, en mayúsculas condensadas con aire entre letras, en terciario.
 * Se retira frente al dato y lo encabeza como una ficha técnica.
 */
export const ETIQUETA_DATO = {
  fontFamily: FUENTE.rotulo,
  fontSize: 13,
  lineHeight: 17,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
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

/**
 * Esquinas de letrero: cortas y firmes. Un letrero no es una burbuja; el
 * radio crece poco con el tamaño de la pieza.
 */
export const RADIOS = {
  /** Placas de estado, avisos internos, bloques pequeños. */
  chico: 4,
  /** Campos, teclas, botones, el botón 0. */
  medio: 8,
  /** Cuadro del ícono de una fila de menú. */
  icono: 8,
  /** Paneles dentro de un encabezado de asfalto. */
  panel: 10,
  /** Tarjetas, filas de conteo y modales. */
  grande: 12,
  /** Esquinas superiores de una hoja. */
  encabezado: 16,
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

/** Ancho máximo de una lista en tablet: el ojo no viaja de más de un borde al otro. */
export const ANCHO_MAXIMO_LISTA = 720;

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
  /** El carril de avance se traza hasta su nuevo largo. */
  carril: 360,
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
