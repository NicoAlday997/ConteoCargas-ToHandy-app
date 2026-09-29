import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Sistema de diseño "Instrumento Azul" (DESIGN.md).
 *
 * Handy Conteo es la báscula de bodega hecha instrumento digital: un cromo
 * azul noche con luz, piezas blancas que flotan encima con sombra suave, y la
 * lectura de cada producto como un visor que se enciende en azul. Se usa de
 * pie, con una mano, a pleno sol o en bodega en penumbra: por eso alto
 * contraste, toques grandes, cifras grandes y tabulares, y ningún estado que
 * dependa solo del color.
 *
 * CAPAS DE COLOR, CADA UNA CON SU TRABAJO.
 *   - AZUL NOCHE (`marca`): el cromo. Héroes, encabezados, el teclado del PIN,
 *     la fila que se teclea y el visor del teclado. Siempre en degradado con
 *     un halo de luz (DEGRADADOS.marca).
 *   - AZUL SEÑAL (`accion`): lo que se toca para avanzar. Una acción principal
 *     por pantalla, la tecla de avance, lo seleccionado y la lectura de lo ya
 *     contado. Es la identidad de la app.
 *   - ESTADOS: verde (listo / coincide, con palomita), ámbar (aviso, con
 *     rombo), rojo (error, con octágono), gris pizarra (no lleva). Un color,
 *     un estado, siempre con forma y texto.
 *   El color de FAMILIA (colores-familia.ts) solo identifica la banda de su
 *   encabezado en el conteo.
 *
 * LO QUE FALTA CONTAR ES EL ESTADO NORMAL, NO UN AVISO: va en blanco, con el
 * visor hueco. El ámbar es solo para avisos reales.
 *
 * Todo texto cumple 4.5:1 sobre el fondo en que aparece (contraste.spec.ts).
 */

/**
 * Tipografía: Manrope en toda la app. Una grotesca moderna de aperturas
 * abiertas y terminales suaves: humana en el texto corrido, firme en los
 * títulos y con cifras muy legibles (el 1, el 4 y el 7 no se confunden a
 * distancia). Cambiar de fuente es tocar solo esto y la carga en
 * app/_layout.tsx. Con fuente propia React Native NO aplica `fontWeight`: el
 * peso se elige con la variante.
 */
export const FUENTE = {
  regular: 'Manrope_400Regular',
  medio: 'Manrope_500Medium',
  semiNegrita: 'Manrope_600SemiBold',
  negrita: 'Manrope_700Bold',
  /** Rótulos de un dato y leyendas de estado. */
  rotulo: 'Manrope_600SemiBold',
  /** Títulos, encabezados y botones. */
  titular: 'Manrope_700Bold',
  /** Solo las lecturas: el total de una fila, la cifra que domina una pantalla, las teclas. */
  extraNegrita: 'Manrope_800ExtraBold',
} as const;

export type PesoFuente = keyof typeof FUENTE;

/**
 * Paleta. Ningún texto baja de 4.5:1 sobre el fondo en que aparece, ningún
 * contorno de control baja de 3:1, y lo blanco se separa del fondo por algo
 * más que el tinte (sombra y contorno fino).
 */
export const COLORES = {
  /** Niebla azulada: fondo de toda pantalla clara. Lo blanco se lee como pieza encima. */
  fondo: '#EEF2F9',
  /** Blanco: tarjetas, hojas, filas. */
  superficie: '#FFFFFF',
  /** Campos en reposo, pastillas neutras, bloques planos dentro de una tarjeta. */
  superficieHonda: '#E3E9F4',
  /** Azul suave: lo seleccionado, lo contado, el resplandor de lo activo sobre claro. */
  azulSuave: '#EAF1FF',
  /** Tinta azul marino. */
  texto: '#0B1733',
  textoSecundario: '#45526B',
  /** Rótulos de un dato. Cumple AA sobre blanco y sobre el fondo. */
  textoTerciario: '#56627A',
  textoSobreColor: '#FFFFFF',
  divisor: '#DCE3EE',
  /** Contorno de 1 px de una pieza blanca: la dibuja aun con reflejo de sol. */
  contornoTarjeta: '#D5DDEA',
  /** Contorno de controles (campos, teclas, opciones): ≥ 3:1 sobre blanco y sobre el fondo. */
  borde: '#74819A',
  /** Borde de la fila SIN CONTAR y del visor hueco. */
  bordeSinContar: '#A6B2C7',
  /** Borde de la fila NO LLEVA: apenas más hondo que su fondo. */
  bordeNoLleva: '#C9D1DE',
  /** Oscurece lo de atrás de una hoja: azul noche, no negro. */
  velo: 'rgba(6, 18, 51, 0.62)',

  // AZUL NOCHE: el cromo (héroes, encabezados, teclado del PIN, lo que se teclea).
  marca: '#0A2463',
  /** Piezas sobre el cromo (paneles, teclas, campos inactivos de la fila que se teclea). */
  marcaHonda: '#17337F',
  /** Lo más hondo del degradado y el canal de la barra de avance. */
  marcaProfunda: '#061233',
  /** Texto que se retira sobre el cromo (≥ 6.5:1 sobre marca y marcaHonda). */
  marcaTenue: '#AFC4F0',
  /** Presionado o seleccionado sobre claro. */
  marcaTinte: '#E4ECFF',
  /** Botón de volver y teclas sobre el cromo: un tono arriba, para que se vea tocable. */
  marcaClara: '#24479C',
  /** Lo que falta de la barra de avance sobre el cromo. */
  carril: '#2C4C95',

  // AZUL SEÑAL: avanzar, seleccionar, lo contado.
  accion: '#1652F0',
  accionHonda: '#0E3DBF',
  /** Azul luminoso sobre el cromo: relleno de la barra de avance, subrayados activos. */
  accionViva: '#5B9BFF',
  /** Cian de luz: solo el extremo de un degradado o un halo, nunca texto. */
  cian: '#7FD8FF',

  // LISTO / COINCIDE: verde, siempre con palomita.
  capturado: '#1A9A64',
  capturadoHondo: '#0B7A4E',
  capturadoFondo: '#DDF4E9',
  capturadoTexto: '#07482F',

  // AVISO: ámbar, siempre con rombo; nunca lo que falta contar.
  discrepancia: '#FFB61F',
  discrepanciaHonda: '#C98600',
  discrepanciaFondo: '#FFF2D1',
  discrepanciaTexto: '#6B4500',

  // NO LLEVA / inactivo: gris pizarra.
  pendiente: '#586379',
  pendienteFondo: '#E3E8F0',

  // ERROR: rojo, siempre con octágono o texto.
  error: '#D12A3C',
  errorFondo: '#FDE8EB',
  errorTexto: '#8E1224',
} as const;

export type ClaveColor = keyof typeof COLORES;

/**
 * Degradados. Dan profundidad e identidad, no decoran: solo el cromo azul
 * noche (héroes, encabezados, teclado del PIN), la acción principal y el
 * relleno del avance. Nunca en una tarjeta de contenido ni en un texto.
 * `angulo` en grados como en CSS (180 = de arriba hacia abajo).
 */
export interface Degradado {
  colores: readonly string[];
  /** Posición de cada color (0–1); por omisión, repartidos. */
  paradas?: readonly number[];
  angulo: number;
}

export const DEGRADADOS = {
  /** Cromo azul noche: de un azul con luz arriba a la noche profunda abajo. */
  marca: { colores: ['#133A9A', '#0A2463', '#061233'], paradas: [0, 0.55, 1], angulo: 165 },
  /** Acción principal: azul brillante que baja a azul señal. */
  accion: { colores: ['#2B63F6', '#1446DB'], angulo: 180 },
  /** Acción presionada: un tono más hondo. */
  accionPresionada: { colores: ['#1446DB', '#0E3DBF'], angulo: 180 },
  /** Relleno de la barra de avance: azul que se enciende en cian. */
  avance: { colores: ['#3F86FF', '#7FD8FF'], angulo: 90 },
  /** Visor de lo contado: la lectura encendida. */
  visor: { colores: ['#2159F2', '#0E3DBF'], angulo: 180 },
} as const satisfies Record<string, Degradado>;

/** El halo de luz del cromo: un resplandor azul arriba a la derecha, como la luz sobre la báscula. */
export const HALO = {
  color: '#4C8DFF',
  opacidad: 0.42,
} as const;

/**
 * Sombras (boxShadow de React Native, ambas plataformas). Siempre con
 * desplazamiento y difusión suave, teñidas de azul noche: nunca un halo de
 * color sin dirección ni una sombra gigante.
 */
export const SOMBRAS = {
  /** Tarjeta o fila sobre el fondo claro. */
  tarjeta: '0px 1px 2px rgba(11, 23, 51, 0.06), 0px 6px 16px rgba(16, 42, 110, 0.07)',
  /** Una pieza que flota: la hoja que monta el héroe, un bloque destacado. */
  elevada: '0px 2px 6px rgba(11, 23, 51, 0.06), 0px 14px 32px rgba(10, 36, 99, 0.14)',
  /** La acción principal: la sombra toma el azul del botón. */
  accion: '0px 6px 16px rgba(22, 82, 240, 0.30)',
  /** Teclado acoplado abajo y hojas: la sombra sube. */
  panel: '0px -6px 24px rgba(10, 36, 99, 0.12)',
  /** Una tecla sobre el panel claro. */
  tecla: '0px 1px 2px rgba(11, 23, 51, 0.10)',
} as const;

/**
 * Onda de Android al tocar (`android_ripple`). Translúcida a propósito: se
 * pinta ENCIMA del control y deja ver su fondo. En iOS no hay onda.
 */
export const ONDA = {
  /** Sobre blanco o gris: tinta al 12 %. */
  sobreClaro: 'rgba(11, 23, 51, 0.12)',
  /** Sobre un relleno de color (azul): blanco al 24 %. */
  sobreColor: 'rgba(255, 255, 255, 0.24)',
  /** Sobre una tarjeta tocable: azul al 10 %. */
  marca: 'rgba(22, 82, 240, 0.10)',
  /** Acción destructiva sobre blanco. */
  peligro: 'rgba(209, 42, 60, 0.16)',
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
  marca: { solido: COLORES.accion, fondo: COLORES.azulSuave, texto: COLORES.accionHonda },
  accion: { solido: COLORES.accion, fondo: COLORES.azulSuave, texto: COLORES.accionHonda },
  capturado: { solido: COLORES.capturadoHondo, fondo: COLORES.capturadoFondo, texto: COLORES.capturadoTexto },
  pendiente: { solido: COLORES.pendiente, fondo: COLORES.pendienteFondo, texto: COLORES.textoSecundario },
  discrepancia: { solido: COLORES.discrepanciaTexto, fondo: COLORES.discrepanciaFondo, texto: COLORES.discrepanciaTexto },
  error: { solido: COLORES.error, fondo: COLORES.errorFondo, texto: COLORES.errorTexto },
};

/**
 * Las tareas del menú. Se reconocen por su ícono, en un círculo azul suave:
 * el color de estado queda para los estados.
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
  letterSpacing?: number;
}

/**
 * Escala tipográfica. Los tamaños grandes cierran un poco el espaciado (la
 * cifra se lee como un solo bloque); el texto corrido va en Medium, que a
 * pleno sol no se deshace como el Regular.
 *
 * - numero: la cifra que domina la pantalla (lo que falta por resolver).
 * - display: el nombre de quien está en sesión; el nombre en el PIN.
 * - titulo: título de una hoja, de un paso; el texto de un botón grande.
 * - total: la lectura de una fila de conteo; no es tocable.
 * - avance: el "6" del avance en el encabezado de conteo.
 * - campo: el número dentro de un campo de captura.
 * - tecla: el dígito de una tecla de los teclados propios.
 * - tituloBarra: título de un encabezado.
 * - tituloVacio: título de un estado vacío.
 * - subtitulo: el dato bajo su rótulo, el texto de un botón, el nombre de un producto.
 * - cuerpo: texto corrido e instrucciones.
 * - familia: nombre de la familia en su banda.
 * - etiqueta: texto de notas y avisos.
 * - micro: rótulos de un dato y líneas de contexto.
 * - rotulo: rótulo de un campo de captura o de una unidad ("Paquetes", "piezas").
 */
export const TIPOGRAFIA = {
  numero: { fontFamily: FUENTE.extraNegrita, fontSize: 52, lineHeight: 58, letterSpacing: -1.2 },
  display: { fontFamily: FUENTE.extraNegrita, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  total: { fontFamily: FUENTE.extraNegrita, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  titulo: { fontFamily: FUENTE.extraNegrita, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  avance: { fontFamily: FUENTE.extraNegrita, fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  campo: { fontFamily: FUENTE.extraNegrita, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  tecla: { fontFamily: FUENTE.semiNegrita, fontSize: 26, lineHeight: 32 },
  tituloBarra: { fontFamily: FUENTE.extraNegrita, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  tituloVacio: { fontFamily: FUENTE.extraNegrita, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  subtitulo: { fontFamily: FUENTE.negrita, fontSize: 16, lineHeight: 22 },
  cuerpo: { fontFamily: FUENTE.medio, fontSize: 16, lineHeight: 24 },
  familia: { fontFamily: FUENTE.extraNegrita, fontSize: 15, lineHeight: 20 },
  etiqueta: { fontFamily: FUENTE.semiNegrita, fontSize: 14, lineHeight: 20 },
  micro: { fontFamily: FUENTE.medio, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: FUENTE.rotulo, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, EstiloTexto>;

export type NivelTipografia = keyof typeof TIPOGRAFIA;

/**
 * Rótulo de un campo de captura ("Paquetes", "Sueltas") y la unidad de un
 * total ("piezas"). Sin mayúsculas: la palabra completa se lee más rápido que
 * una sigla gritada, y el peso la separa del número.
 */
export const ROTULO = {
  ...TIPOGRAFIA.rotulo,
  color: COLORES.textoSecundario,
  letterSpacing: 0.1,
} as const satisfies TextStyle;

/** El nombre de una familia en su banda ("Refrescos", "Aguas"). */
export const FAMILIA = {
  ...TIPOGRAFIA.familia,
  letterSpacing: 0,
} as const satisfies TextStyle;

/**
 * La leyenda de una pastilla de estado ("Esperando contador", "Ruta 3"):
 * negrita compacta, se lee de reojo aun a pleno sol.
 */
export const PLACA = {
  fontFamily: FUENTE.negrita,
  fontSize: 13,
  lineHeight: 18,
  letterSpacing: 0.1,
} as const satisfies TextStyle;

/**
 * Rótulo de un dato ("Contó", "Verificó", "Productos"): pequeño, en
 * terciario; se retira frente al dato y lo encabeza como una ficha técnica.
 */
export const ETIQUETA_DATO = {
  fontFamily: FUENTE.semiNegrita,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.1,
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
  fontFamily: FUENTE.medio,
  color: COLORES.textoSecundario,
} as const satisfies TextStyle;

/**
 * Para toda cifra que se compara con otra (cantidades, totales, progreso):
 * dígitos del mismo ancho, así las columnas quedan alineadas al recorrer la lista.
 */
export const CIFRAS: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

/**
 * Geometría. Variada a propósito: no todo es cápsula ni todo es rectángulo.
 * - Rectángulos suaves (control, pieza, grande) para lo que contiene.
 * - Hoja (28) para la superficie blanca que monta el héroe azul.
 * - Cápsula (completo) para estados, selectores y la barra de avance.
 * - Círculo (completo con lados iguales) para PIN, avatares, íconos y teclas del PIN.
 */
export const RADIOS = {
  /** Avisos internos, bloques pequeños, la pastilla del empaque. */
  chico: 8,
  /** Campos, teclas del teclado de cantidad, el botón 0. */
  medio: 12,
  /** Cuadro de un ícono que no es círculo. */
  icono: 12,
  /** Botones y paneles dentro de un encabezado. */
  control: 16,
  panel: 18,
  /** Filas de conteo. */
  pieza: 20,
  /** Tarjetas y diálogos. */
  grande: 22,
  /** Esquinas superiores de una hoja y de la superficie que monta el héroe. */
  encabezado: 28,
  completo: 999,
} as const;

export type ClaveRadio = keyof typeof RADIOS;

export const BORDES = {
  fino: 1,
  medio: 2,
  grueso: 3,
} as const;

/**
 * Elevación: fondo, contorno fino y sombra suave azulada.
 * - 0: plano, un bloque dentro de otro (resúmenes, tablas).
 * - 1: una tarjeta blanca sobre el fondo de pantalla.
 * - 2: una pieza que flota (la tarjeta principal de un inicio, un diálogo).
 */
export const ELEVACION = {
  0: {
    backgroundColor: COLORES.superficieHonda,
    borderWidth: 0,
  },
  // El contorno fino sigue: a pleno sol la sombra desaparece y el contorno dibuja la pieza.
  1: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.contornoTarjeta,
    boxShadow: SOMBRAS.tarjeta,
  },
  2: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.contornoTarjeta,
    boxShadow: SOMBRAS.elevada,
  },
} as const satisfies Record<number, ViewStyle>;

export type NivelElevacion = keyof typeof ELEVACION;

/**
 * La barra de acciones fija abajo (Finalizar, Autorizar, Guardar): una pieza
 * blanca de esquinas altas redondeadas con sombra que sube. Una sola forma
 * para toda la app: `BarraAccion` y cualquier bandeja inferior propia.
 */
export const BARRA_INFERIOR = {
  paddingHorizontal: RITMO.margen,
  paddingTop: ESPACIADO.lg,
  backgroundColor: COLORES.superficie,
  borderTopLeftRadius: RADIOS.encabezado,
  borderTopRightRadius: RADIOS.encabezado,
  boxShadow: SOMBRAS.panel,
} as const satisfies ViewStyle;

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
 * (ease-out exponencial) o con un resorte amortiguado sin rebote visible; con
 * "Reducir movimiento" se corta en seco.
 */
export const MOVIMIENTO = {
  /** Respuesta al toque (escala, tinte). */
  toque: 90,
  /** Un cambio pequeño: una pastilla, un aviso que entra. */
  rapido: 160,
  /** Entrada de una hoja o un diálogo. */
  hoja: 260,
  /** Destello que confirma una captura en la fila. */
  destello: 280,
  /** La barra de avance crece hasta su nuevo largo. */
  carril: 420,
  /** Entrada de una pantalla: su contenido sube y aparece. */
  entrada: 320,
  /** Escalonado entre bloques que entran juntos. */
  escalon: 45,
} as const;

/** Curva ease-out exponencial (0.16, 1, 0.3, 1). */
export const CURVA_SALIDA = [0.16, 1, 0.3, 1] as const;

/**
 * Resortes (Reanimated `withSpring`). Amortiguados: se sienten físicos sin
 * rebotar a la vista.
 * - presion: hundirse al tocar y volver.
 * - seleccion: un círculo del PIN que se llena, una opción que se elige.
 * - entrada: una pieza que llega a su lugar.
 */
export const RESORTES = {
  presion: { damping: 20, stiffness: 420, mass: 0.6 },
  seleccion: { damping: 14, stiffness: 320, mass: 0.7 },
  entrada: { damping: 22, stiffness: 200, mass: 0.9 },
} as const;

/** Escala al presionar algo grande (tarjeta, fila de menú): se hunde, no rebota. */
export const ESCALA_PRESIONADO = 0.98;

/** Escala al presionar un control compacto (botón, tecla). */
export const ESCALA_PRESIONADO_CONTROL = 0.96;

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
