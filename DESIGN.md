---
name: Conteo de Cargas
description: Señalamiento de ruta para contar, verificar y autorizar la carga de cada camión antes de que llegue a Handy.
colors:
  fondo: "#E7E8E3"
  superficie: "#FFFFFF"
  superficie-honda: "#DBDDD6"
  texto: "#14181B"
  texto-secundario: "#474D51"
  texto-terciario: "#585E62"
  texto-sobre-color: "#FFFFFF"
  divisor: "#D0D3CB"
  contorno-tarjeta: "#C4C8C0"
  borde: "#747A74"
  borde-sin-contar: "#A9ADA5"
  borde-no-lleva: "#C2C5BD"
  velo: "rgba(12, 15, 18, 0.66)"
  asfalto: "#171B1F"
  asfalto-alto: "#262C32"
  asfalto-profundo: "#0C0F12"
  asfalto-tenue: "#B8C0C6"
  asfalto-tinte: "#E2E5E1"
  asfalto-claro: "#394148"
  carril: "#6A737B"
  verde-ruta: "#0A6B4E"
  verde-ruta-hondo: "#07523C"
  verde-vivo: "#35C77E"
  capturado: "#2E9A69"
  capturado-fondo: "#DCEFE5"
  capturado-texto: "#063E2D"
  preventivo: "#FFC21A"
  preventivo-hondo: "#C98F00"
  preventivo-fondo: "#FFF1C4"
  preventivo-texto: "#6A4700"
  pendiente: "#555B5F"
  pendiente-fondo: "#DDDFDA"
  error: "#C4132C"
  error-fondo: "#FCE4E6"
  error-texto: "#8C0D20"
typography:
  numero:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "60px"
    fontWeight: 800
    lineHeight: "62px"
    fontFeature: "tnum"
  display:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "40px"
  avance:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: "42px"
    fontFeature: "tnum"
  total:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: "36px"
    fontFeature: "tnum"
  tecla:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "34px"
    fontFeature: "tnum"
  titulo:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
  campo:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "28px"
    fontFeature: "tnum"
  titulo-barra:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "26px"
  boton:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: "23px"
    letterSpacing: "0.2px"
  subtitulo:
    fontFamily: "Barlow"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
  cuerpo:
    fontFamily: "Barlow"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  familia:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "1px"
  placa:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "18px"
    letterSpacing: "0.8px"
  etiqueta:
    fontFamily: "Barlow"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "19px"
  etiqueta-dato:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "17px"
    letterSpacing: "0.8px"
  micro:
    fontFamily: "Barlow"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  rotulo:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "1px"
rounded:
  chico: "4px"
  medio: "8px"
  icono: "8px"
  panel: "10px"
  grande: "12px"
  hoja: "16px"
  completo: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  boton-primario:
    backgroundColor: "{colors.verde-ruta}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.boton}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-primario-presionado:
    backgroundColor: "{colors.verde-ruta-hondo}"
    textColor: "{colors.texto-sobre-color}"
  boton-letrero:
    backgroundColor: "{colors.verde-ruta}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo}"
    rounded: "{rounded.grande}"
    padding: "16px 24px"
    height: "112px"
  boton-secundario:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.boton}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-secundario-presionado:
    backgroundColor: "{colors.asfalto-tinte}"
    textColor: "{colors.texto}"
  boton-peligro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.error-texto}"
    typography: "{typography.boton}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-peligro-presionado:
    backgroundColor: "{colors.error-fondo}"
    textColor: "{colors.error-texto}"
  tarjeta:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.grande}"
    padding: "24px"
  tarjeta-compacta:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.grande}"
    padding: "16px"
  placa-contado:
    backgroundColor: "{colors.capturado-fondo}"
    textColor: "{colors.capturado-texto}"
    typography: "{typography.placa}"
    rounded: "{rounded.chico}"
    padding: "3px 10px"
  placa-aviso:
    backgroundColor: "{colors.preventivo-fondo}"
    textColor: "{colors.preventivo-texto}"
    typography: "{typography.placa}"
    rounded: "{rounded.chico}"
    padding: "3px 10px"
  placa-aviso-solida:
    backgroundColor: "{colors.preventivo}"
    textColor: "{colors.texto}"
    typography: "{typography.placa}"
    rounded: "{rounded.chico}"
    padding: "3px 10px"
  placa-error:
    backgroundColor: "{colors.error-fondo}"
    textColor: "{colors.error-texto}"
    typography: "{typography.placa}"
    rounded: "{rounded.chico}"
    padding: "3px 10px"
  placa-fuerte:
    backgroundColor: "{colors.texto}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.placa}"
    rounded: "{rounded.chico}"
    padding: "3px 10px"
  campo-texto:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.cuerpo}"
    rounded: "{rounded.medio}"
    padding: "8px 12px"
    height: "56px"
  encabezado-asfalto:
    backgroundColor: "{colors.asfalto}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo-barra}"
    padding: "12px 16px 16px"
  panel-encabezado:
    backgroundColor: "{colors.asfalto-alto}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.panel}"
    padding: "12px"
  fila-sin-contar:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.grande}"
    padding: "12px"
  fila-contado:
    backgroundColor: "{colors.capturado-fondo}"
    textColor: "{colors.texto}"
    rounded: "{rounded.grande}"
    padding: "12px"
  fila-no-lleva:
    backgroundColor: "{colors.pendiente-fondo}"
    textColor: "{colors.pendiente}"
    rounded: "{rounded.grande}"
    padding: "12px"
  fila-tecleando:
    backgroundColor: "{colors.asfalto}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.grande}"
    padding: "12px"
  visor-contado:
    backgroundColor: "{colors.verde-ruta}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.total}"
    rounded: "{rounded.medio}"
    height: "56px"
  visor-no-lleva:
    backgroundColor: "{colors.pendiente}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.total}"
    rounded: "{rounded.medio}"
    height: "56px"
  tablero-teclado:
    backgroundColor: "{colors.asfalto}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.hoja}"
    padding: "12px"
  tecla:
    backgroundColor: "{colors.asfalto-alto}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.tecla}"
    rounded: "{rounded.medio}"
    height: "56px"
  tecla-presionada:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
  tecla-avance:
    backgroundColor: "{colors.verde-vivo}"
    textColor: "{colors.texto}"
    typography: "{typography.titulo-barra}"
    rounded: "{rounded.medio}"
  tecla-avance-presionada:
    backgroundColor: "{colors.verde-ruta}"
    textColor: "{colors.texto-sobre-color}"
  hoja:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.titulo}"
    rounded: "{rounded.hoja}"
    padding: "24px"
  barra-accion:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto-secundario}"
    typography: "{typography.micro}"
    padding: "12px 16px"
---

# Design System: Conteo de Cargas

## Overview

**Creative North Star: "Señalamiento de Ruta"**

La app se lee como un letrero de carretera: de un vistazo, con prisa y bajo cualquier luz. El cromo es asfalto casi negro; el suelo de trabajo es concreto claro; las piezas son blancas como la lámina reflectiva de un letrero; y el color es señal, nunca adorno. El verde ruta dice "avanza" y "ya quedó", el amarillo preventivo dice "atención" (siempre con su rombo), el rojo dice "alto" (siempre con su octágono) y el gris dice "no lleva". Nada más lleva color.

La báscula de bodega sigue viva adentro de la fila de conteo: cada producto tiene su visor, hueco y punteado cuando falta la lectura, sólido cuando ya la tiene. Lo que cambió es el mundo alrededor: encabezados de asfalto a escuadra como un pórtico, un carril de avance cuyas marcas discontinuas se cubren de verde conforme se cuenta, placas de estado de esquina corta en mayúsculas condensadas, un escudo de ruta que identifica la ruta como identifica una carretera, y un teclado que es un tablero de asfalto acoplado abajo, con la tecla de avance en verde vivo.

Se usa de pie en bodega con poca luz, en la camioneta y en la calle a pleno sol, con una mano. Por eso todo toque mide 56 como mínimo, las cifras son grandes, condensadas y tabulares, y cada captura responde al instante con un destello corto y háptica. Se rechazan el dashboard SaaS (tarjetas con sombra, degradados, KPIs decorativos, acento azul genérico) y el ERP gris tipo Handy (tablas densas, controles diminutos, teclado del sistema).

**Key Characteristics:**
- Tres capas de color con un solo trabajo cada una: asfalto (cromo y mano), verde ruta (avanzar y ya quedó), señales de estado (preventivo, alto, no lleva).
- Una sola familia tipográfica de señalamiento en dos cortes: Barlow para leer, Barlow Semi Condensed para títulos, placas y cifras.
- Estado por forma además de color: visor hueco o sólido, rombo para aviso, octágono para error.
- Esquinas cortas de letrero (4 a 12); las píldoras quedan solo donde un círculo es la forma natural.
- Plano: sin sombras. La profundidad es tonal (asfalto contra concreto, blanco con contorno contra concreto).
- Teclados propios en asfalto, objetivos de 56 (72 en tablet), acción principal abajo al alcance del pulgar.
- Grado exterior: ningún texto baja de 4.5:1 ni de 12 px; ningún contorno de control baja de 3:1.
- Solo modo claro para las pantallas de trabajo; el asfalto aporta los momentos oscuros (entrada, encabezados, teclados).

## Colors

Paleta de carretera: neutros de concreto y asfalto, un verde de guía y tres señales de estado calibradas para sol directo y penumbra.

En `tokens.ts` los nombres conservan el código existente: `marca*` es el asfalto, `accion*` y `capturado*` son el verde ruta y `discrepancia*` es el preventivo.

### Primary
- **Asfalto** (`asfalto`): el cromo y la mano. Encabezados de trabajo, el letrero de inicio y de entrada, el tablero del teclado, la fila que se está tecleando, lo seleccionado (una opción marcada, un día elegido) y la placa de los pictogramas del menú. Nunca comunica un estado.
- **Asfalto Alto** (`asfalto-alto`): piezas sobre asfalto: el panel del encabezado, las teclas y los campos inactivos de la fila que se teclea.
- **Asfalto Profundo** (`asfalto-profundo`): el canal del carril de avance y del selector Paquetes | Sueltas.
- **Gris Neblina** (`asfalto-tenue`): texto que se retira sobre asfalto (subtítulos, "de 14 productos", la marca en mayúsculas).
- **Tinte Frío** (`asfalto-tinte`): presionado de una tarjeta tocable o de un botón secundario; fondo de lo seleccionado sobre claro.
- **Asfalto Claro** (`asfalto-claro`) y **Marca de Carril** (`carril`): el contorno de las teclas y del botón de volver sobre asfalto, y las marcas discontinuas de lo que falta en el carril.

### Secondary
- **Verde Ruta** (`verde-ruta`): avanzar. El botón primario (uno por pantalla), el botón letrero del inicio, el visor sólido de una fila contada y el texto verde sobre claro.
- **Verde Ruta Hondo** (`verde-ruta-hondo`): presionado del verde.
- **Verde Vivo** (`verde-vivo`): el verde sobre asfalto: relleno del carril, subrayado del visor del teclado, tecla de avance (con tinta asfalto encima), casillas llenas del PIN, el rol en el letrero de inicio y la palomita de "Al día".
- **Contado** (`capturado`, `capturado-fondo`, `capturado-texto`): borde, fondo y texto de una fila contada y de la placa "contado".

### Tertiary
- **Amarillo Preventivo** (`preventivo`): el letrero de aviso. Sólido con tinta asfalto sobre el teclado y en la placa sólida de aviso; borde de un campo con aviso. Siempre va con el rombo.
- **Preventivo Hondo, Crema y Tinta** (`preventivo-hondo`, `preventivo-fondo`, `preventivo-texto`): el aviso dentro de la fila y las placas tintadas: fondo crema, contorno hondo y texto tinta.
- **Rojo Alto** (`error`, `error-fondo`, `error-texto`): errores de envío, rechazos, campos inválidos y el contorno del botón de peligro. Siempre con el octágono o con su texto.
- **No Lleva** (`pendiente`, `pendiente-fondo`): una fila marcada en cero y la tecla "No lleva"; se retira.

### Neutral
- **Concreto** (`fondo`): el fondo de toda pantalla clara. Gris cálido y mate.
- **Blanco Reflectivo** (`superficie`): tarjetas, filas sin contar, hojas, campos y el botón secundario.
- **Concreto Hundido** (`superficie-honda`): bloques planos dentro de una tarjeta, campos en reposo de una fila y placas neutras.
- **Tinta Asfalto** (`texto`), **Pizarra** (`texto-secundario`), **Gris Rótulo** (`texto-terciario`): texto principal, de apoyo y rótulos de un dato.
- **Contorno de Tarjeta** (`contorno-tarjeta`), **Borde de Control** (`borde`), **Borde Sin Contar** (`borde-sin-contar`), **Borde No Lleva** (`borde-no-lleva`), **Divisor** (`divisor`): contornos de pieza, de control (≥ 3:1) y de estado suave.
- **Velo** (`velo`): lo que queda detrás de una hoja.

### Paleta de familia (cerrada)
El supervisor asigna a cada familia uno de diez colores (`apps/movil/src/theme/colores-familia.ts`, espejo en el backend). Cada uno trae un sólido para la línea de 3 px bajo la banda, un tinte (el sólido al 15 % sobre el concreto) para el fondo de la banda y un tono de texto para el nombre en mayúsculas. Sin color, la banda es concreto hundido.

### Named Rules
**The Tres Capas Rule.** Asfalto es cromo y mano, verde es avanzar y ya quedó, las señales son estado. Un color que no cabe en una de esas tres capas no entra.

**The Lo Que Falta Va en Blanco Rule.** Una fila sin contar es el estado normal al abrir una carga: blanca, con visor hueco. Nunca amarilla; si lo que falta fuera aviso, la pantalla entera sería alarma.

**The Señal Con Forma Rule.** El amarillo nunca va sin rombo y el rojo nunca va sin octágono o texto. A pleno sol el color se lava; la forma no.

**The Familia Identifica Rule.** El color de familia solo tiñe la banda de su familia. Nunca entra en una fila.

## Typography

**Display Font:** Barlow Semi Condensed (600, 700 y 800)
**Body Font:** Barlow (400, 500, 600 y 700)

**Character:** Una grotesca nacida del señalamiento vial, de trazo firme y terminales suaves. El corte normal se lee corrido sin cansar; el semicondensado da títulos con presencia y cifras grandes que caben en el visor sin encogerse. Las dos traen cifras tabulares (`tnum`).

Con fuente propia React Native no aplica `fontWeight`: el corte se elige con `FUENTE` (`regular`, `medio`, `semiNegrita`, `negrita` en Barlow; `rotulo`, `titular`, `extraNegrita` en la condensada). El cambio de fuente se hace solo en `tokens.ts` y `app/_layout.tsx`.

### Hierarchy
- **Número** (condensada 800, 60/62, tabular): la cifra que domina una pantalla.
- **Avance** (condensada 800, 40/42, tabular): el "6" del panel del encabezado de conteo.
- **Display** (condensada 700, 36/40): el nombre de quien está en sesión y los dígitos del PIN; 40 en el letrero de entrada.
- **Total** (condensada 800, 34/36, tabular): la lectura del visor de una fila.
- **Tecla** (condensada 700, 30/34, tabular): los dígitos del teclado de cantidad.
- **Título** (condensada 700, 28/32): títulos de hoja, de pantalla clara, de tarjeta de carga y del botón letrero.
- **Campo** (condensada 700, 24/28, tabular): el número dentro de un campo de captura.
- **Título de barra** (condensada 700, 22/26): título del encabezado de asfalto, títulos de sección y renglones del menú (20).
- **Botón** (condensada 700, 19/23): el texto de todo botón; minúsculas, como un destino.
- **Subtítulo** (Barlow 600, 17/22): el nombre de un producto y el dato bajo su rótulo (sube a 700).
- **Cuerpo** (Barlow 400, 16/23): instrucciones y texto corrido.
- **Familia** (condensada 700, 16/20, MAYÚSCULAS, +1): el nombre de la familia en su banda.
- **Placa** (condensada 700, 14/18, MAYÚSCULAS, +0.8): la leyenda de una placa de estado.
- **Etiqueta** (Barlow 600, 14/19): texto de avisos y notas.
- **Rótulo de dato** (condensada 600, 13/17, MAYÚSCULAS, +0.8): "CONTÓ", "VERIFICA", el rótulo de un campo de texto.
- **Micro** (Barlow 500, 13/18): líneas de contexto.
- **Rótulo** (condensada 600, 12/14, MAYÚSCULAS, +1): "PAQUETES", "SUELTAS", "PIEZAS". Nunca más chico.

### Named Rules
**The Leyenda en Mayúsculas Rule.** Las mayúsculas condensadas con aire entre letras son la leyenda de un letrero: placas, rótulos de dato, campos de captura y bandas de familia. Títulos, botones y texto corrido van en minúsculas.

**The Cifras en Columna Rule.** Toda cantidad que se compara con otra usa dígitos tabulares.

**The Texto que Crece Rule.** El texto sigue el tamaño del sistema; lo que vive en cajas de alto fijo (teclas, campos, visor) crece hasta 1.3× y los encabezados y placas hasta 1.5×.

## Layout

Tres clases de ventana de Material 3 (`useLayout`): compacto (< 600, una columna, teclado abajo, decisiones en hoja inferior), medio (600–839, columna de 720, teclas de 72, diálogos centrados) y expandido (≥ 840, lista en dos columnas y teclado en panel lateral de asfalto). Diálogos de 480 como máximo. Orientación vertical.

Margen lateral de 16. Todo espacio es múltiplo de 4 y sale de la escala (4, 8, 12, 16, 24, 32, 48): 4 dentro de un grupo, 12 entre hermanos, 24 entre grupos, 48 entre secciones.

Los letreros de asfalto (entrada, inicio, encabezado de trabajo) van a todo el ancho, a escuadra, y absorben el área segura superior. La barra de estado se ajusta al enfocar cada pantalla (`useBarraEstado`): clara sobre asfalto, oscura sobre concreto.

**The Aire, No Divisores Rule.** Poco aire dentro de un grupo y mucho entre grupos. Si hace falta una línea, lo que está mal es el espaciado.

## Elevation & Depth

Sin sombras. La profundidad es tonal y tiene tres niveles: el asfalto (cromo, teclados) contra el concreto; la pieza blanca con contorno de 1 px sobre el concreto; y el bloque de concreto hundido dentro de una pieza. Sobre asfalto, las piezas suben un tono (asfalto alto) con contorno de asfalto claro. Las hojas se separan con el velo. Al presionar, una tarjeta toma el tinte frío con contorno en asfalto y se hunde a 0.98; un botón pasa a su tono hondo; una tecla se enciende en blanco. En Android se suma la onda del sistema.

**The Plano Por Defecto Rule.** Nada lleva `shadow` ni `elevation`. Si algo necesita destacar, cambia de fondo o gana espacio.

## Shapes

Esquinas de letrero: cortas y firmes. Placas y avisos internos, 4. Campos, teclas, botones y cuadros de ícono, 8. Paneles sobre asfalto, 10. Tarjetas, filas de conteo, estados vacíos y diálogos, 12. Esquinas superiores de una hoja y del tablero del teclado, 16. El círculo completo solo donde el círculo es la forma natural del objeto; nunca para una placa de estado.

Bordes de 1, 2 y 3: el de 1 contornea piezas y teclas sobre asfalto; el de 2 es el de controles, filas de conteo y botones secundarios; el de 3 (4 en el subrayado activo) es la línea de la banda de familia y el subrayado verde de lo que se teclea. El botón letrero lleva un filete interior de 2 a 4 del canto, como el marco de un letrero.

Formas propias: el **escudo de ruta** (44×50, contorno de tinta, número condensado 800) y la **marca** (el mismo escudo con la palomita de dos trazos, en verde).

## Components

### Buttons
Gruesos, condensados y sin adornos.
- **Shape:** esquinas de 8, al menos 56 de alto, relleno 8/16.
- **Primario:** verde ruta con texto blanco. Uno por pantalla o por hoja. Presionado: verde hondo y se hunde a 0.98.
- **Letrero (grande):** verde ruta, 112 de alto, esquinas de 12, filete interior blanco al 55 %, título a 28, una línea de detalle y una flecha gruesa de destino a la derecha. Es la acción principal del inicio.
- **Secundario:** placa blanca con contorno de 2 en borde sin contar; presionado, tinte frío con contorno de control.
- **Peligro:** blanco con contorno de 2 y texto en rojo. Nunca es el dominante: en su hoja, la salida segura va sólida.
- **Cargando / deshabilitado:** opacidad 0.5; al cargar, indicador junto al texto. Doble toque frenado a 320 ms (las teclas no).

### Chips (Placas)
- **Style:** esquina de 4, relleno 3/10, leyenda condensada en mayúsculas.
- **Tintada (por omisión):** fondo del estado con tinta del mismo tono.
- **Sólida:** para lo que exige actuar ya; la de aviso es amarillo preventivo con tinta asfalto y la fuerte es asfalto con blanco.
- **Contorno:** borde de 2 y texto en el color, para algo sin confirmar.
- **Destacada y grande:** cifras condensadas 800 (18 y 28) para factores como c/60 contra c/70.

### Cards / Containers
- **Corner Style:** 12, contenido recortado.
- **Background:** blanco reflectivo con contorno de 1 (nivel 1) o concreto hundido (nivel 0); tintada con el fondo de un estado cuando el bloque entero es ese estado.
- **Shadow Strategy:** ninguna.
- **Internal Padding:** 24 (normal) o 16 (compacta).
- **Banda de estado:** primera línea con la placa del estado y un detalle en rótulo de dato a la derecha ("3 DE 5").

### Inputs / Fields
- **Style:** blanco, contorno de 2 en borde de control, esquinas de 8, al menos 56 de alto, rótulo arriba en mayúsculas condensadas.
- **Focus:** contorno en asfalto y el rótulo sube a tinta; selección en verde ruta.
- **Error / Disabled:** contorno y ayuda en rojo, siempre con texto; deshabilitado en concreto hundido.

### Navigation
- **Encabezado de asfalto (marca):** a todo el ancho y a escuadra, título condensado blanco, subtítulo en gris neblina, volver en un cuadro de 44 de asfalto claro, escudo de ruta a la derecha cuando la ruta trae número. Debajo, el panel de asfalto alto con la lectura del avance, el estado de envío y el carril. Solo pantallas de trabajo con contexto propio.
- **Barra clara:** sobre el concreto, título condensado a 28, volver blanco con contorno. Administración.
- **Plano:** dentro de una hoja o un paso.
- **Menú:** un bloque blanco; cada renglón con su pictograma blanco sobre placa de asfalto de 40, leyenda condensada a 20 y chevron. Presionado, el renglón entero se vuelve asfalto.

### Carril de avance (componente distintivo)
Canal de asfalto profundo de 10 de alto con marcas de carril discontinuas (10/8, trazo de 2) que representan lo que falta; lo contado lo cubre una línea continua en verde vivo que se traza hasta su nuevo largo en 360 ms con frenado exponencial. Con "Reducir movimiento" salta sin animar.

### Fila de conteo (componente distintivo)
Pieza de esquinas 12, borde de 2 y relleno de 12, del mismo tamaño en cualquier estado; el estado la tiñe completa. A la derecha, el **visor** de 96×56 y el botón 0.
- **Sin contar:** blanca con borde gris claro; visor hueco punteado con "—".
- **Contado:** fondo verde agua, borde verde, palomita; visor sólido verde ruta con la lectura condensada 800 en blanco.
- **No lleva:** gris; visor sólido gris con "0 · NO LLEVA".
- **Tecleando:** la fila entera en asfalto, campos inactivos en asfalto alto y el campo activo blanco con subrayado verde vivo de 4.
- La placa del factor (C/12) toma los colores del estado. Los avisos dentro de la fila son bloques crema con contorno hondo y rombo; el rechazo del servidor, rosa con octágono. Un destello de 280 ms confirma cada cambio de estado.

### Teclado de cantidad y teclado de PIN
El teclado de cantidad es un **tablero de asfalto** acoplado abajo, con esquinas superiores de 16 (panel lateral a escuadra en tablet expandida). Arriba repite el producto y el campo; el selector Paquetes | Sueltas es un canal de asfalto profundo donde la opción activa es una placa blanca; la lectura va a 32 condensada 800 en blanco con subrayado verde vivo (amarillo con aviso). El aviso es un letrero preventivo amarillo con rombo. Las teclas son de asfalto alto con dígitos blancos y se encienden en blanco al presionar; "No lleva" va en gris; la tecla de avance es verde vivo con tinta asfalto y mide dos filas. El teclado de PIN comparte las teclas: oscuro en la entrada, claro (blanco con contorno, asfalto al presionar) dentro de hojas y formularios. Las casillas del PIN son cuatro marcas de carril de 36×12 que se llenan de verde vivo (asfalto sobre claro) y se sacuden ante un PIN incorrecto.

### Hoja y diálogo (`Hoja`)
Hoja inferior de esquinas superiores de 16 en celular, diálogo de 480 con esquinas de 12 en tablet. Título condensado a 28, detalle en cuerpo, pie fijo con la salida a la izquierda y lo esperado a la derecha; con peligro se apilan con la salida segura abajo. Entra en 240 ms con frenado exponencial, sin rebote.

### Estados vacíos y bloques de aviso
El estado vacío lo encabeza una placa de 72 (asfalto con pictograma blanco si es informativo; tinte del estado si es buena noticia o un problema), título condensado a 22 y detalle. Los bloques de error, atención y éxito llevan contorno de 1.5, su glifo (octágono, reloj, palomita) y título condensado a 20.

### Entrada e inicio
La entrada abre con un letrero de asfalto: la marca y "CONTEO DE CARGAS" en mayúsculas, y la instrucción a 40. Cada usuario es una tarjeta con su placa de iniciales en asfalto. El paso del PIN es todo asfalto. El inicio abre con el letrero de asfalto de quien está en sesión: placa blanca con iniciales, nombre en display blanco y rol en verde vivo; debajo, sobre concreto, las acciones.

## Do's and Don'ts

### Do:
- **Do** usar un solo botón verde por pantalla u hoja; lo demás va en secundario o peligro.
- **Do** dibujar en asfalto el cromo y la mano: encabezados de trabajo, teclados, la fila que se teclea y lo seleccionado.
- **Do** acompañar el amarillo con rombo y el rojo con octágono o texto.
- **Do** dejar lo que falta en blanco con visor hueco; el verde aparece conforme se avanza.
- **Do** escribir las leyendas de placa, rótulo y familia en mayúsculas condensadas con aire entre letras, y todo lo demás en minúsculas.
- **Do** usar cifras tabulares condensadas en toda cantidad que se compara.
- **Do** mantener 56 como toque mínimo (72 en teclas de tablet).
- **Do** verificar cada par nuevo de texto sobre fondo en `contraste.spec.ts`.
- **Do** elegir el corte con `FUENTE`, nunca con `fontWeight`.
- **Do** ajustar la barra de estado con `useBarraEstado` en toda pantalla que no use `Encabezado`.

### Don't:
- **Don't** usar sombras, degradados, brillos ni vidrio; la profundidad es tonal.
- **Don't** usar el verde como decoración ni el asfalto como estado.
- **Don't** hacer píldoras de las placas de estado ni redondear de más: esquinas de 4 a 16.
- **Don't** meter el color de familia dentro de una fila de conteo.
- **Don't** usar ámbar o amarillo para lo que simplemente falta contar.
- **Don't** hacer del botón de peligro el dominante de una hoja.
- **Don't** usar un carácter (↑, !, ‹, ›) como ícono; se dibuja en SVG de trazo 2 sobre cuadrícula de 24.
- **Don't** usar `Pressable` o `Modal` directo: `Pulsable`, `Hoja` y `PantallaModal`.
- **Don't** escribir colores, radios ni espacios caso por caso; todo sale de `tokens.ts` o `colores-familia.ts`.
