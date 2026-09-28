---
name: Conteo de Cargas
description: Instrumento de bodega para contar, verificar y autorizar la carga de cada ruta antes de que llegue a Handy.
colors:
  fondo: "#E3E7EF"
  superficie: "#FFFFFF"
  superficie-honda: "#D8DDE8"
  texto: "#0D1120"
  texto-secundario: "#495068"
  texto-terciario: "#5B6279"
  texto-sobre-color: "#FFFFFF"
  divisor: "#D3D9E4"
  contorno-tarjeta: "#C9D0DC"
  borde: "#767E94"
  borde-sin-contar: "#AEB6C7"
  borde-no-lleva: "#C3C8D4"
  velo: "rgba(13, 17, 32, 0.62)"
  marca: "#1E4FE0"
  marca-honda: "#1638B0"
  marca-profunda: "#102A86"
  marca-tenue: "#DCE5FF"
  marca-tinte: "#E7EDFF"
  marca-clara: "#3A62EF"
  capturado: "#14B8A6"
  capturado-hondo: "#0B6E64"
  capturado-fondo: "#CFF0E9"
  capturado-texto: "#0A3A35"
  discrepancia: "#F59E0B"
  discrepancia-honda: "#D97706"
  discrepancia-fondo: "#FEF3C7"
  discrepancia-texto: "#92400E"
  pendiente: "#545B70"
  pendiente-fondo: "#DCDFE8"
  error: "#DC2626"
  error-fondo: "#FEE7E7"
  error-texto: "#911B1B"
typography:
  numero:
    fontFamily: "Archivo_800ExtraBold"
    fontSize: "48px"
    lineHeight: "54px"
    fontFeature: "tnum"
  display:
    fontFamily: "Archivo_700Bold"
    fontSize: "34px"
    lineHeight: "40px"
  total:
    fontFamily: "Archivo_800ExtraBold"
    fontSize: "32px"
    lineHeight: "36px"
    fontFeature: "tnum"
  titulo:
    fontFamily: "Archivo_700Bold"
    fontSize: "26px"
    lineHeight: "32px"
  avance:
    fontFamily: "Archivo_800ExtraBold"
    fontSize: "28px"
    lineHeight: "32px"
    fontFeature: "tnum"
  campo:
    fontFamily: "Archivo_700Bold"
    fontSize: "22px"
    lineHeight: "26px"
    fontFeature: "tnum"
  titulo-vacio:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "20px"
    lineHeight: "26px"
  titulo-barra:
    fontFamily: "Archivo_700Bold"
    fontSize: "20px"
    lineHeight: "24px"
  subtitulo:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "17px"
    lineHeight: "22px"
  cuerpo:
    fontFamily: "Archivo_400Regular"
    fontSize: "16px"
    lineHeight: "22px"
  familia:
    fontFamily: "Archivo_700Bold"
    fontSize: "15px"
    lineHeight: "20px"
  etiqueta:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "14px"
    lineHeight: "18px"
  micro:
    fontFamily: "Archivo_500Medium"
    fontSize: "13px"
    lineHeight: "18px"
  rotulo:
    fontFamily: "Archivo_700Bold"
    fontSize: "12px"
    lineHeight: "14px"
    letterSpacing: "0.6px"
rounded:
  chico: "6px"
  icono: "11px"
  medio: "12px"
  panel: "14px"
  grande: "18px"
  encabezado: "22px"
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
    backgroundColor: "{colors.marca}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.subtitulo}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-primario-presionado:
    backgroundColor: "{colors.marca-honda}"
    textColor: "{colors.texto-sobre-color}"
  boton-secundario:
    backgroundColor: "{colors.superficie-honda}"
    textColor: "{colors.texto}"
    typography: "{typography.subtitulo}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-secundario-presionado:
    backgroundColor: "{colors.divisor}"
    textColor: "{colors.texto}"
  boton-peligro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.error}"
    typography: "{typography.subtitulo}"
    rounded: "{rounded.medio}"
    padding: "8px 16px"
    height: "56px"
  boton-peligro-presionado:
    backgroundColor: "{colors.error-fondo}"
    textColor: "{colors.error}"
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
  bloque-plano:
    backgroundColor: "{colors.superficie-honda}"
    textColor: "{colors.texto}"
    rounded: "{rounded.grande}"
    padding: "24px"
  campo-texto:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.cuerpo}"
    rounded: "{rounded.medio}"
    padding: "8px 12px"
    height: "56px"
  etiqueta-contado:
    backgroundColor: "{colors.capturado-fondo}"
    textColor: "{colors.capturado-texto}"
    typography: "{typography.etiqueta}"
    rounded: "{rounded.completo}"
    padding: "4px 12px"
  etiqueta-aviso:
    backgroundColor: "{colors.discrepancia-fondo}"
    textColor: "{colors.discrepancia-texto}"
    typography: "{typography.etiqueta}"
    rounded: "{rounded.completo}"
    padding: "4px 12px"
  etiqueta-error:
    backgroundColor: "{colors.error-fondo}"
    textColor: "{colors.error-texto}"
    typography: "{typography.etiqueta}"
    rounded: "{rounded.completo}"
    padding: "4px 12px"
  etiqueta-neutra:
    backgroundColor: "{colors.superficie-honda}"
    textColor: "{colors.texto}"
    typography: "{typography.etiqueta}"
    rounded: "{rounded.completo}"
    padding: "4px 12px"
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
    backgroundColor: "{colors.marca}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.grande}"
    padding: "12px"
  encabezado-marca:
    backgroundColor: "{colors.marca}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo-barra}"
    rounded: "{rounded.encabezado}"
    padding: "12px 16px 16px"
  panel-encabezado:
    backgroundColor: "{colors.marca-honda}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.panel}"
    padding: "12px"
  tecla:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.display}"
    rounded: "{rounded.medio}"
    height: "56px"
  tecla-presionada:
    backgroundColor: "{colors.marca}"
    textColor: "{colors.texto-sobre-color}"
  visor-vacio:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto-terciario}"
    typography: "{typography.total}"
    rounded: "{rounded.medio}"
    height: "56px"
  visor-contado:
    backgroundColor: "{colors.capturado-hondo}"
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
  hoja:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.titulo}"
    rounded: "{rounded.encabezado}"
    padding: "24px"
  barra-accion:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto-secundario}"
    typography: "{typography.micro}"
    padding: "12px 16px"
---

# Design System: Conteo de Cargas

## Overview

**Creative North Star: "La Báscula de Bodega"**

La app es un instrumento de medición, no una aplicación de oficina. En reposo, la pantalla es neutra: gris azulado de fondo, tarjetas blancas y texto casi negro. El color aparece solo como una lectura, igual que la aguja de una báscula: turquesa cuando algo ya se contó, ámbar cuando algo pide atención, rojo cuando algo falló y azul donde está la mano en este momento. Si no cambió nada y no hay nada que hacer, no hay color.

El carácter es directo, rápido y táctil. Se usa de pie, con poca luz y las manos ocupadas contando cajas, pero también en la camioneta y en la calle, a pleno sol, con reflejos y con una sola mano, así que todo se toca con el pulgar y responde al instante. Los controles son gruesos (56 de alto como mínimo), las cifras son grandes y de ancho fijo, y un destello corto confirma cada captura sin hacer esperar la siguiente. La densidad es media: en una lista de 73 productos, cada fila muestra su estado de reojo, y el aire entre grupos agrupa sin necesidad de líneas divisorias.

Se rechazan dos mundos de forma explícita. El dashboard SaaS genérico (tarjetas con sombra, degradados, KPIs decorativos) porque aquí cada píxel de color es un dato. Y el ERP gris tipo Handy (tablas densas, controles diminutos, teclado del sistema) porque es justo lo que la app viene a sustituir en la bodega.

**Key Characteristics:**
- Grado exterior: ningún texto baja de 4.5:1 ni de 12 px, ningún contorno de control baja de 3:1, y ningún estado depende solo del tinte (forma, glifo o texto lo acompañan).
- La lectura de cada fila es un visor: hueco punteado cuando falta, bloque sólido cuando ya hay lectura. Se distingue por forma aun cuando el sol lava los colores.
- Neutro en reposo; el color siempre es un estado, nunca decoración.
- Dos sistemas de color que no se mezclan: el estado tiñe la fila completa y el color de familia solo identifica la banda de su encabezado.
- Una sola acción azul por pantalla; el azul también marca lo que se está tecleando.
- Plano: sin sombras. La profundidad se logra con el cambio de fondo y con el espacio.
- Cifras tabulares en toda cantidad que se compara con otra.
- Teclado numérico propio y objetivos de toque de 56 en vez de 44 (72 en tablet).
- La acción principal vive abajo, al alcance del pulgar; las decisiones que interrumpen suben como hoja inferior en celular y aparecen como diálogo en tablet.
- Cada toque se siente: háptica con el lenguaje de cada plataforma (constantes del sistema en Android, generadores de impacto en iOS).
- Solo modo claro (`userInterfaceStyle: light`).

## Colors

Paleta fría y contenida: una base gris azulada, un azul de trabajo y cuatro familias de estado, cada una con tres o cuatro tonos (sólido, hondo, fondo y texto) calibrados para cumplir 4.5:1.

### Primary
- **Azul de Trabajo** (`marca`): el encabezado de las pantallas de trabajo, el único botón primario de la pantalla, la fila que se está tecleando, el campo con foco y la tecla presionada. Nunca comunica un estado.
- **Azul Hondo** (`marca-honda`): presionado del azul, paneles dentro del encabezado, campos inactivos de la fila que se teclea y el rótulo del campo en el teclado.
- **Azul Profundo** (`marca-profunda`): canal de la barra de avance sobre azul.
- **Azul Neblina** (`marca-tenue`): texto que se retira sobre azul (subtítulos, notas y unidades).
- **Azul Claro** (`marca-clara`): botón de volver sobre el encabezado azul, un tono más claro para que se lea como botón.
- **Tinte Azul** (`marca-tinte`): presionado de una tarjeta tocable; fondo de la pastilla de marca.

### Secondary
- **Turquesa Contado** (`capturado`): borde de una fila ya contada y relleno de la barra de avance.
- **Turquesa Hondo** (`capturado-hondo`): el visor sólido de una fila contada (lectura en blanco), la palomita y la pastilla del factor; relleno sólido con texto blanco.
- **Agua Contada** (`capturado-fondo`): fondo de la fila contada y de las etiquetas "contado".
- **Turquesa Tinta** (`capturado-texto`): texto sobre el fondo turquesa.

### Tertiary
- **Ámbar de Aviso** (`discrepancia`): borde del visor cuando la captura tiene un aviso. Es solo para lo que pide atención real: un empaque sin confirmar, sueltas que completan un paquete o una diferencia entre conteos.
- **Ámbar Hondo** (`discrepancia-honda`), **Crema Ámbar** (`discrepancia-fondo`), **Ámbar Tinta** (`discrepancia-texto`): los bloques de aviso siempre combinan el fondo crema con el texto tinta.
- **Rojo Falla** (`error`), **Rosa Falla** (`error-fondo`), **Rojo Tinta** (`error-texto`): errores de envío, rechazos del servidor, campos inválidos y el contorno del botón de peligro.

### Neutral
- **Gris Andén** (`fondo`): el fondo de toda pantalla; sobre él, lo blanco se lee como tarjeta.
- **Blanco Tarjeta** (`superficie`): tarjetas, filas sin contar, modales, campos y teclas.
- **Gris Hundido** (`superficie-honda`): bloques planos dentro de una tarjeta, campos en reposo, pastillas neutras y el botón secundario.
- **Tinta Noche** (`texto`): texto principal.
- **Pizarra** (`texto-secundario`): texto de apoyo, ayudas y placeholder.
- **Gris Rótulo** (`texto-terciario`): rótulos de un dato ("Contó", "Productos"). Cumple AA sobre blanco y sobre el fondo. También es el "—" del visor vacío.
- **Contorno de Tarjeta** (`contorno-tarjeta`): 1 px alrededor de toda pieza blanca. A pleno sol el blanco sobre gris claro se funde; el contorno la dibuja. Rodea, no separa: no es un divisor.
- **Borde de Control** (`borde`): contorno de campos, teclas del PIN y opciones, a 3:1 sobre blanco.
- **Divisor** (`divisor`), **Borde Sin Contar** (`borde-sin-contar`) y **Borde No Lleva** (`borde-no-lleva`): contornos muy suaves que no compiten con el estado.
- **Gris No Lleva** (`pendiente`) y **Fondo No Lleva** (`pendiente-fondo`): una fila marcada en cero; se retira visualmente.
- **Velo** (`velo`): oscurece lo que queda detrás de un modal.

**Las tareas del menú no tienen color.** Se reconocen por su ícono, en tinta sobre gris hundido. El trabajo pendiente de un grupo ("3 cargas") va en pastilla sólida de tinta: exige actuar, pero no es un estado.

### Paleta de familia (cerrada)
El supervisor asigna a cada familia de producto uno de diez colores (rojo, naranja, ámbar, verde, turquesa, azul, índigo, violeta, rosa y café), definidos en `apps/movil/src/theme/colores-familia.ts` y reflejados en el backend. Cada uno tiene tres tonos: un sólido para la línea de 3 px bajo la banda (3:1 sobre el fondo), un tinte para el fondo de la banda (el sólido al 15 % sobre el fondo) y un tono de texto para el nombre de la familia (4.5:1 sobre el tinte). Por omisión, una familia no tiene color y se ve neutra.

### Named Rules
**La Regla de Un Color, Un Estado.** Cada color de estado significa una sola cosa en toda la app. El turquesa es "contado", el ámbar es "aviso", el rojo es "error" y el gris es "no lleva". Ninguno se usa para decorar.

**La Regla de Lo Que Falta Va Neutro.** Una fila sin contar es el estado normal al abrir una carga: blanca con borde gris claro, nunca ámbar. Si lo que falta fuera ámbar, la pantalla entera sería una alarma y el ámbar dejaría de significar algo.

**La Regla del Azul Es la Mano.** El azul marca dónde se está trabajando: el encabezado de trabajo, la acción primaria (una por pantalla) y lo que se teclea. Nunca es una etiqueta de estado.

**La Regla de Familia Identifica, Estado Comunica.** El color de familia solo tiñe la banda del encabezado de su familia. Nunca entra en una fila, porque el estado de la fila manda sobre ella entera.

## Typography

**Display Font:** Archivo (Bold 700)
**Body Font:** Archivo (Regular 400, Medium 500 y SemiBold 600)

**Character:** Una sola familia grotesca, compacta y de trazo firme, que aguanta cifras grandes en negrita sin perder claridad y texto corrido a 16 sin cansar. La jerarquía se construye con tamaño y peso, nunca con otra familia.

Con una fuente propia, React Native no aplica `fontWeight`. El peso se elige con la variante (`FUENTE.regular`, `FUENTE.medio`, `FUENTE.semiNegrita`, `FUENTE.negrita` o `FUENTE.extraNegrita`, esta última solo para lecturas) y el cambio de fuente se hace solo en `tokens.ts` y `app/_layout.tsx`.

### Hierarchy
- **Número** (ExtraBold, 48/54, tabular): la cifra que domina la pantalla, por ejemplo lo que falta por resolver.
- **Display** (Bold, 34/40): los dígitos del PIN, el número que se busca con la mirada.
- **Total** (ExtraBold, 32/36, tabular): la lectura del visor de una fila de conteo; no es tocable.
- **Título** (Bold, 26/32): el nombre grande en login y en el inicio de cada rol, el título de un modal y el texto de un botón grande.
- **Avance** (ExtraBold, 28/32, tabular): el "4" del avance en el encabezado de conteo.
- **Campo** (Bold, 22/26, tabular): el número dentro de un campo de captura.
- **Título de estado vacío** (SemiBold, 20/26).
- **Título de barra** (Bold, 20/24): el título del encabezado.
- **Subtítulo** (SemiBold, 17/22): el nombre de un producto, el texto de un botón y el dato bajo su rótulo (este último sube a Bold).
- **Cuerpo** (Regular, 16/22): instrucciones y texto corrido.
- **Familia** (Bold, 15/20): el nombre de la familia en su banda.
- **Etiqueta** (SemiBold, 14/18): el texto de pastillas, avisos y notas; en las pastillas sube a Bold.
- **Micro** (Medium, 13/18): rótulos de un dato y líneas de contexto. Medium y no Regular: a pleno sol el trazo fino se deshace.
- **Rótulo** (Bold, 12/14, MAYÚSCULAS, +0.6): solo los campos de captura ("PAQUETES", "SUELTAS") y la unidad del visor ("PIEZAS", "NO LLEVA"). Nunca más chico: es la diferencia entre 12 y 144 piezas.

### Named Rules
**La Regla de Cifras en Columna.** Toda cantidad que se compara con otra (cantidades, totales, factores y avance) usa dígitos tabulares (`tabular-nums`). Así, al recorrer la lista las cifras quedan alineadas.

**La Regla del Rótulo en Mayúsculas.** Las mayúsculas se reservan para los campos de captura y la unidad de un total. Cualquier otro rótulo va con mayúscula inicial, en 13 px (Micro) y en gris rótulo.

**La Regla del Texto que Crece.** El texto sigue el tamaño que la persona eligió en su teléfono (Dynamic Type, escala de fuente de Android). Lo que vive en cajas de alto fijo (teclas, campos, visor) crece hasta 1.3× (`ESCALA_TEXTO.control`); encabezados y pastillas, hasta 1.5×. Las cajas usan alto mínimo, no alto fijo.

**La Regla del Dato Presente o Ausente.** Un dato que existe va en Subtítulo Bold con tinta noche. Un dato que todavía no existe ("Pendiente") usa el mismo tamaño en Regular y pizarra: el hueco se nota sin necesidad de un color de alarma.

## Layout

Tres clases de ventana, las de Material 3 (`useLayout` en `theme/breakpoints.ts`, con `useWindowDimensions` para responder a la rotación y a la pantalla dividida):
- **Compacto** (< 600): celular. Una columna, teclado abajo, decisiones en hoja inferior.
- **Medio** (600–839): tablet de 8" en vertical. Una columna de 720 como máximo, teclas de 72 y diálogos centrados. El teclado sigue abajo: al lado dejaría la lista demasiado angosta para leer nombres.
- **Expandido** (≥ 840): tablet grande o en horizontal. Lista en dos columnas y teclado en un panel lateral.

Los diálogos no pasan de 480 de ancho: una columna que se lee de un vistazo. La orientación sigue fija en vertical.

El margen lateral de la pantalla es de 16. Todo valor de espacio es múltiplo de 4 y sale de la escala (4, 8, 12, 16, 24, 32, 48). El ritmo agrupa por proporción, no con líneas: 4 dentro de un grupo, 12 entre elementos hermanos (tarjetas de una lista, botones de un grupo), 24 entre grupos de datos dentro de una tarjeta y 48 entre secciones de una pantalla.

El encabezado de marca sube bajo la barra de estado y absorbe el área segura superior. La pantalla que lo usa no vuelve a aplicar ese margen.

**La Regla de Aire, No Divisores.** Poco aire dentro de un grupo y mucho entre grupos. Si hace falta una línea para separar dos bloques, lo que está mal es el espaciado.

## Elevation & Depth

El sistema es plano, sin ninguna sombra. La profundidad tiene dos niveles, ambos logrados con el cambio de fondo: el nivel 1 es una tarjeta blanca con contorno de 1 px sobre el gris andén, y el nivel 0 es un bloque gris hundido dentro de una tarjeta (resúmenes, tablas). Los modales se separan con el velo, no con sombra. Con lector de pantalla, la fila de conteo es una sola parada con acciones (capturar paquetes, sueltas, no lleva) en vez de seis elementos. La respuesta al toque también es tonal: al presionar, una tarjeta se tiñe de azul claro y se escala a 0.98, y un botón pasa a su tono hondo y se hunde a 0.98. En Android se suma la onda del sistema.

**La Regla de Plano por Defecto.** Nada lleva `shadow` ni `elevation`. Si algo necesita destacar, cambia de fondo o gana espacio alrededor.

## Shapes

Las esquinas son redondeadas en todos los niveles y su radio crece con el tamaño del bloque. Los avisos internos usan 6. El cuadro del ícono de una fila de menú, 11. Campos, teclas y botones, 12. Los paneles dentro del encabezado azul, 14. Tarjetas, filas de conteo y modales, 18. Las esquinas inferiores del encabezado azul, 22. Todo lo que es dato (pastillas de estado, factor de empaque, barra de avance) es una píldora completa (999), para que se reconozca como dato y no como texto suelto.

Los bordes tienen tres grosores (1, 2 y 3). El borde de 2 es el contorno de campos, del botón de peligro y de la fila de conteo en cualquier estado. El de 3 se reserva para la línea de la banda de familia, el borde superior del teclado y el subrayado del visor.

## Components

### Buttons
Gruesos y sin adornos: se leen como una tecla, no como un enlace.
- **Shape:** esquinas medias (12), al menos 56 de alto, relleno 8/16.
- **Primario:** relleno azul de trabajo con texto blanco en Subtítulo. Uno por pantalla o por modal. Al presionarlo pasa a azul hondo.
- **Secundario:** gris hundido con texto en tinta, sin borde. Sirve para volver, cancelar y alternativas. Al presionarlo pasa al tono divisor.
- **Peligro:** fondo blanco con contorno de 2 y texto en rojo falla. Nunca es el botón dominante: en su modal, el botón sólido es la salida segura ("No, volver"). Al presionarlo pasa a rosa falla.
- **Grande:** alineado a la izquierda, con el texto en Título, una segunda línea en Cuerpo Medium y una flecha a la derecha: se lee como un renglón ("Continuar carga · sale mañana") que lleva a otra pantalla.
- **Cargando / deshabilitado:** opacidad al 0.5; al cargar muestra un indicador junto al texto ("Guardando…").
- **Doble toque:** cada control ignora un segundo toque dentro de 320 ms. Las teclas de los teclados no tienen ese freno.

### Chips (Etiqueta)
- **Style:** píldora con relleno de 4/12 y texto en Etiqueta Bold.
- **Tintada (por omisión):** fondo del estado con texto oscuro del mismo tono. Así se muestra un estado: se lee de reojo sin gritar.
- **Sólida:** fondo del color con texto blanco, solo para lo que exige actuar ya.
- **Contorno:** borde de 2 y texto en el color, para algo sin confirmar.
- **Neutra / referencia / fuerte:** gris hundido con texto en tinta, pizarra o, en la variante fuerte, fondo tinta.
- **Tamaños:** normal junto a texto de cuerpo; destacada (Subtítulo Bold) junto al nombre de un producto; grande (Título) cuando es lo que distingue un renglón de otro (c/60 contra c/70). El ancho fijo alinea las pastillas en columna.

### Cards / Containers (Tarjeta)
- **Corner Style:** grande (18), con el contenido recortado.
- **Background:** blanco tarjeta (nivel 1) o gris hundido (nivel 0). Puede ir tintada con el fondo de un estado cuando el bloque entero es ese estado.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** ninguno.
- **Internal Padding:** 24 en la normal y 16 en la compacta; hueco interno de 12 (normal) o 4 (compacta). Entre tarjetas de una lista, 12.
- **Banda de estado:** la primera línea puede ser una píldora tintada con el nombre del estado y un detalle en micro a la derecha ("3 de 5"). La tarjeta sigue siendo blanca y el estado es lo único con color.

### Inputs / Fields (CampoTexto)
- **Style:** fondo blanco con contorno de 2 en borde de control, esquinas medias (12), al menos 56 de alto y texto en Cuerpo. El rótulo va arriba en micro gris y la ayuda debajo en Etiqueta Regular pizarra.
- **Focus:** el contorno pasa a azul de trabajo, igual que el campo activo del conteo.
- **Error / Disabled:** en error, el contorno y el texto de ayuda pasan a rojo falla. El error nunca se comunica solo con el color: siempre va con su texto. Deshabilitado, el campo toma fondo gris hundido.

### Navigation (Encabezado)
- **Marca:** bloque azul a todo el ancho con las esquinas inferiores de 22. Solo en las pantallas de trabajo con contexto propio (conteo, discrepancias, historial, autorizaciones y empaques). Lleva el título en Título de barra blanco y subtítulo y notas en azul neblina. El botón de volver es un cuadro de 36 en azul claro con chevron blanco. Debajo va un panel azul hondo (radio 14) que agrupa el avance, la barra de progreso y el estado de envío.
- **Barra:** sobre el gris andén, sin bloque, con el título en tinta y el botón de volver blanco. Para pantallas de administración (plantillas, familias).
- **Plano:** dentro del contenido (un modal o un paso de un flujo), con el título a tamaño Título.
- **Barra de avance:** canal azul profundo de 8 de alto con relleno turquesa contado, en forma de píldora.

### Fila de conteo (componente distintivo)
El corazón de la app. Cada fila es un bloque de radio 18, borde de 2 y relleno de 12. Mide lo mismo en cualquier estado y su estado la tiñe completa (fondo, borde, visor y pastilla del factor). A la derecha, junto al botón 0, va el **visor**: la lectura de la báscula, de 96 de ancho y 56 de alto.
- **Sin contar:** blanca con borde gris claro. Visor hueco, con contorno punteado y "—".
- **Contado:** fondo agua con borde turquesa y palomita. Visor sólido en turquesa hondo con la lectura en blanco ExtraBold.
- **No lleva:** fondo y nombre en gris no lleva. Visor sólido gris con "0" y "NO LLEVA": la pastilla aparte desaparece.
- **Tecleando:** la fila entera en azul de trabajo con texto blanco, campos inactivos en azul hondo y el campo activo en blanco subrayado de azul, para que sea imposible perder dónde vas.

Al cambiar de estado (nunca al montarse), un destello de 280 ms a opacidad 0.3 confirma el toque. La marca de envío es discreta a propósito y está dibujada, nunca es un carácter: flecha hacia arriba si falta enviar y triángulo de alerta si el servidor rechazó; lo ya enviado no lleva marca. Los avisos llevan su glifo de alerta además del fondo ámbar. Los avisos ámbar dentro de la fila (bloque crema con texto tinta) son lo único ámbar de la lista.

### Teclado de cantidad y teclado de PIN
Teclados propios, nunca el del sistema, que cambia de tamaño y tapa la lista. El teclado de cantidad va en un panel gris andén con borde superior azul de 3. Arriba repite el producto y el campo que se captura (rótulo en Etiqueta Bold mayúsculas, azul hondo). El visor, subrayado de 3 en azul, se vuelve ámbar cuando hay aviso, y la cifra va a 30 Bold tabular. La zona de aviso reserva dos líneas de alto para que las teclas nunca se muevan. Es un numpad: tres columnas de dígitos (el 0 a todo el ancho abajo) y, del lado del pulgar, una columna de acciones un poco más ancha con **Borrar**, **No lleva** (en el gris de la fila no lleva: marca 0 y pasa al siguiente) y la **tecla de avance**, azul sólido y de doble alto: es la acción del panel. Arriba, un selector **Paquetes | Sueltas** (el campo activo va relleno de azul) dice por forma qué se captura. "Listo" solo cierra y es lo más callado del panel: gris hundido, 40 de alto con holgura hasta 56. Con paquetes tecleados, el avance salta al siguiente producto; con Paquetes vacío, va a Sueltas. En el teclado de PIN, las teclas son blancas con borde de 1 y se vuelven azules al presionarlas. Un PIN incorrecto sacude los indicadores (cinco tramos de 50 ms).

### Hoja y diálogo (`Hoja`)
Toda decisión que interrumpe usa la misma primitiva. En celular es una hoja inferior (esquinas superiores de 22) que sube desde el pulgar; en tablet es un diálogo centrado de 480. Título en Título, detalle en Cuerpo secundario, contenido desplazable y **pie fijo** con los botones (`AccionesHoja`): la salida a la izquierda y lo esperado a la derecha. Con una acción destructiva se apilan: el contorno rojo arriba y la salida segura, sólida, hasta abajo. Mientras guarda, ni atrás ni el velo la cierran. Tocar el velo solo cierra lo que no pierde nada (una lista para ir a un producto).

### Barra de acción (`BarraAccion`)
La acción de la pantalla, fija abajo sobre blanco con contorno arriba: Finalizar en el conteo, Autorizar en la revisión. Sobre el botón, en una línea, por qué todavía no procede ("Faltan 3 productos por contar."). Absorbe el área segura inferior. En la revisión del supervisor, las acciones de excepción (rechazar, modificar, cambiar fecha, cancelar) se guardan tras "Más acciones".

### Cierre
Terminar algo se confirma: al finalizar un conteo, el inicio muestra un bloque verde con palomita, cuántos productos llegaron y qué sigue ("Sigue el contador: hace su conteo sin ver el tuyo."), junto con un toque háptico de éxito.

### Confirmación cruzada
La regla se muestra como dos pasos numerados (1 una persona captura, 2 otra persona confirma desde su teléfono con su PIN). Cada diferencia dice quién capturó y quién confirma; a quien capturó se le explica por qué no puede confirmar. La cantidad final sin confirmar va en un marco punteado; confirmada, sólida en verde con palomita. El diálogo de PIN dice "Confirmas como {nombre}".

### Plataforma (`Pulsable`)
Todo lo tocable pasa por `Pulsable`: háptica por plataforma, onda del sistema en Android, respuesta tonal en iOS y freno al doble toque. Los íconos son SVG propios de trazo 2 en una cuadrícula de 24 (incluido un camión para la identidad de la app). El volver de iOS por borde y el atrás de Android siguen activos.

### Estados de espera
El esqueleto pulsa entre 0.35 y 0.5 de opacidad cada 800 ms y se queda quieto si el sistema pide reducir movimiento. En login, los pasos entran deslizándose de lado. Las hojas entran en 240 ms con frenado exponencial y nunca rebotan (`MOVIMIENTO` y `CURVA_SALIDA` en `tokens.ts`).

## Do's and Don'ts

### Do:
- **Do** usar un solo botón primario azul por pantalla o modal; lo demás va en secundario o peligro.
- **Do** teñir la fila entera con su estado (fondo, borde, total y factor) y dejar el color de familia solo en la banda de su encabezado.
- **Do** mostrar lo que falta contar en blanco con borde gris claro; el color aparece conforme se avanza.
- **Do** usar dígitos tabulares en toda cifra que se compare con otra.
- **Do** mantener 56 como alto mínimo de toque, de botones y de campos de captura (72 en las teclas de tablet).
- **Do** mostrar el estado de una lectura por forma (visor hueco o sólido, glifo) además del color.
- **Do** poner la acción principal abajo y las decisiones que interrumpen en `Hoja`.
- **Do** separar con espacio de la escala (4 / 12 / 24 / 48) en vez de líneas divisorias.
- **Do** acompañar todo error o estado con texto; el color nunca va solo.
- **Do** verificar cada par nuevo de texto sobre fondo en `contraste.spec.ts` (4.5:1 para texto, 3:1 para gráficos).
- **Do** elegir el peso con la variante de `FUENTE`, nunca con `fontWeight`.

### Don't:
- **Don't** usar sombras, degradados ni tarjetas "flotantes" de dashboard SaaS genérico; la profundidad es tonal.
- **Don't** imitar el ERP gris tipo Handy: nada de tablas densas, controles pequeños ni teclado del sistema para capturar cantidades.
- **Don't** usar ámbar para lo que simplemente falta contar; el ámbar es solo para avisos reales.
- **Don't** usar el azul de trabajo como etiqueta de estado.
- **Don't** meter el color de familia dentro de una fila de conteo.
- **Don't** hacer del botón de peligro el botón dominante de un modal.
- **Don't** escribir rótulos en mayúsculas fuera de los campos de captura y la unidad de un total.
- **Don't** usar un carácter (↑, !, ‹, ›) como ícono; se dibuja.
- **Don't** usar `Pressable` o `Modal` directo en una pantalla: `Pulsable`, `Hoja` (decisiones que interrumpen) y `PantallaModal` (una tarea completa encima, como modificar una cantidad) dan la respuesta de la plataforma.
- **Don't** escribir el color de la onda de Android a mano: sale de `ONDA` en `tokens.ts`.
- **Don't** poner más de una acción azul en una lista de tarjetas: solo la primera que requiere acción; las demás van en secundario.
- **Don't** poner texto por debajo de 12 px ni usar el azul o el color de una tarea como adorno de menú.
- **Don't** inventar valores de espacio, radio o color caso por caso; todo sale de `tokens.ts` o `colores-familia.ts`.
