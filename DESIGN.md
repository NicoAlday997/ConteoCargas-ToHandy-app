---
name: Handy Conteo
description: La báscula de bodega hecha instrumento digital azul para contar, verificar y autorizar la carga de cada camión antes de que llegue a Handy.
colors:
  fondo: "#EEF2F9"
  superficie: "#FFFFFF"
  superficie-honda: "#E3E9F4"
  azul-suave: "#EAF1FF"
  texto: "#0B1733"
  texto-secundario: "#45526B"
  texto-terciario: "#56627A"
  texto-sobre-color: "#FFFFFF"
  divisor: "#DCE3EE"
  contorno-tarjeta: "#D5DDEA"
  borde: "#74819A"
  borde-sin-contar: "#A6B2C7"
  borde-no-lleva: "#C9D1DE"
  velo: "rgba(6, 18, 51, 0.62)"
  azul-noche: "#0A2463"
  azul-noche-alto: "#17337F"
  azul-noche-profundo: "#061233"
  azul-noche-luz: "#133A9A"
  azul-tenue: "#AFC4F0"
  azul-tinte: "#E4ECFF"
  azul-noche-claro: "#24479C"
  azul-senal: "#1652F0"
  azul-senal-hondo: "#0E3DBF"
  azul-senal-brillante: "#2B63F6"
  azul-luminoso: "#5B9BFF"
  cian-luz: "#7FD8FF"
  listo: "#1A9A64"
  listo-hondo: "#0B7A4E"
  listo-fondo: "#DDF4E9"
  listo-texto: "#07482F"
  aviso: "#FFB61F"
  aviso-hondo: "#C98600"
  aviso-fondo: "#FFF2D1"
  aviso-texto: "#6B4500"
  no-lleva: "#586379"
  no-lleva-fondo: "#E3E8F0"
  error: "#D12A3C"
  error-fondo: "#FDE8EB"
  error-texto: "#8E1224"
typography:
  numero:
    fontFamily: "Manrope"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: "58px"
    letterSpacing: "-1.2px"
    fontFeature: "tnum"
  avance:
    fontFamily: "Manrope"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: "40px"
    letterSpacing: "-0.8px"
    fontFeature: "tnum"
  display:
    fontFamily: "Manrope"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "-0.6px"
  total:
    fontFamily: "Manrope"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "32px"
    letterSpacing: "-0.4px"
    fontFeature: "tnum"
  tecla:
    fontFamily: "Manrope"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    fontFeature: "tnum"
  titulo:
    fontFamily: "Manrope"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  campo:
    fontFamily: "Manrope"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: "28px"
    letterSpacing: "-0.2px"
    fontFeature: "tnum"
  titulo-barra:
    fontFamily: "Manrope"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "26px"
    letterSpacing: "-0.3px"
  boton:
    fontFamily: "Manrope"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "22px"
    letterSpacing: "-0.1px"
  subtitulo:
    fontFamily: "Manrope"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
  cuerpo:
    fontFamily: "Manrope"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  familia:
    fontFamily: "Manrope"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: "20px"
  etiqueta:
    fontFamily: "Manrope"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  placa:
    fontFamily: "Manrope"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "18px"
    letterSpacing: "0.1px"
  micro:
    fontFamily: "Manrope"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  etiqueta-dato:
    fontFamily: "Manrope"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.1px"
  rotulo:
    fontFamily: "Manrope"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.1px"
rounded:
  chico: "8px"
  medio: "12px"
  icono: "12px"
  control: "16px"
  panel: "18px"
  pieza: "20px"
  grande: "22px"
  hoja: "28px"
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
    backgroundColor: "{colors.azul-senal}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.boton}"
    rounded: "{rounded.control}"
    padding: "8px 24px"
    height: "56px"
  boton-primario-presionado:
    backgroundColor: "{colors.azul-senal-hondo}"
    textColor: "{colors.texto-sobre-color}"
  boton-grande:
    backgroundColor: "{colors.azul-senal}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo}"
    rounded: "{rounded.grande}"
    padding: "20px 24px"
    height: "112px"
  boton-secundario:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.azul-senal-hondo}"
    typography: "{typography.boton}"
    rounded: "{rounded.control}"
    padding: "8px 24px"
    height: "56px"
  boton-secundario-presionado:
    backgroundColor: "{colors.azul-tinte}"
    textColor: "{colors.azul-senal-hondo}"
  boton-peligro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.error-texto}"
    typography: "{typography.boton}"
    rounded: "{rounded.control}"
    padding: "8px 24px"
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
  pastilla-estado:
    backgroundColor: "{colors.aviso-fondo}"
    textColor: "{colors.aviso-texto}"
    typography: "{typography.placa}"
    rounded: "{rounded.completo}"
    padding: "4px 12px"
  campo-texto:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.cuerpo}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "56px"
  heroe:
    backgroundColor: "{colors.azul-noche}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo}"
    padding: "12px 16px 40px"
  fila-menu:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.subtitulo}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "68px"
  fila-sin-contar:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pieza}"
    padding: "12px"
  fila-contado:
    backgroundColor: "{colors.azul-suave}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pieza}"
    padding: "12px"
  fila-no-lleva:
    backgroundColor: "{colors.no-lleva-fondo}"
    textColor: "{colors.no-lleva}"
    rounded: "{rounded.pieza}"
    padding: "12px"
  fila-tecleando:
    backgroundColor: "{colors.azul-noche}"
    textColor: "{colors.texto-sobre-color}"
    rounded: "{rounded.pieza}"
    padding: "12px"
  visor-contado:
    backgroundColor: "{colors.azul-senal}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.total}"
    rounded: "{rounded.medio}"
    width: "96px"
    height: "56px"
  visor-no-lleva:
    backgroundColor: "{colors.no-lleva}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.total}"
    rounded: "{rounded.medio}"
    width: "96px"
    height: "56px"
  boton-cero:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.campo}"
    rounded: "{rounded.completo}"
    size: "56px"
  panel-teclado:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.hoja}"
    padding: "16px 12px"
  tecla:
    backgroundColor: "{colors.fondo}"
    textColor: "{colors.texto}"
    typography: "{typography.tecla}"
    rounded: "{rounded.control}"
    height: "56px"
  tecla-presionada:
    backgroundColor: "{colors.azul-senal}"
    textColor: "{colors.texto-sobre-color}"
  tecla-avance:
    backgroundColor: "{colors.azul-senal}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo-barra}"
    rounded: "{rounded.control}"
  visor-teclado:
    backgroundColor: "{colors.azul-noche}"
    textColor: "{colors.texto-sobre-color}"
    typography: "{typography.titulo}"
    rounded: "{rounded.control}"
    height: "44px"
  tecla-pin:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.tecla}"
    rounded: "{rounded.completo}"
    size: "78px"
  circulo-pin:
    backgroundColor: "{colors.azul-senal}"
    rounded: "{rounded.completo}"
    size: "18px"
  hoja:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    typography: "{typography.titulo}"
    rounded: "{rounded.hoja}"
    padding: "16px 24px 24px"
  barra-inferior:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto-secundario}"
    typography: "{typography.micro}"
    rounded: "{rounded.hoja}"
    padding: "16px 16px 12px"
---

# Design System: Handy Conteo

## Overview

**Creative North Star: "El Instrumento Azul"**

Handy Conteo es la báscula de bodega hecha instrumento digital. El cromo es azul noche con luz: un degradado que baja de un azul encendido arriba a la noche profunda, con un halo azul en la esquina superior derecha como la luz sobre una báscula, y (solo en la entrada y el inicio) anillos concéntricos tenues como la carátula de un instrumento de medición. Encima de ese cromo se monta una superficie clara de niebla azulada con su borde redondeado de 28, y sobre ella flotan piezas blancas con sombra suave teñida de azul. La lectura de cada producto es un visor: hueco y punteado mientras falta, encendido en azul señal cuando ya tiene cifra.

Se usa de pie en bodega con poca luz, en la camioneta y en la calle a pleno sol, con una mano. Por eso el azul es identidad pero nunca el único portador de un estado: cada estado lleva forma (visor hueco o encendido, palomita en círculo verde, rombo ámbar, octágono rojo) y texto. Todo toque mide 56 como mínimo, las cifras van en Manrope ExtraBold tabular, y cada captura responde al instante con un resorte, un destello corto y háptica. Se rechazan el asfalto negro como identidad, el dashboard SaaS de tarjetas iguales con KPIs decorativos y el ERP gris de controles diminutos.

La geometría es variada a propósito: rectángulos suaves para lo que contiene (12 a 22), la hoja de 28 que monta el héroe, cápsulas para estados, selectores y la barra de avance, y círculos para el PIN, los avatares, los íconos de tarea, el botón 0 y la palomita.

**Key Characteristics:**
- Cromo azul noche en degradado con halo; superficies blancas que flotan sobre niebla azulada.
- Azul señal (#1652F0) como única voz de acción, selección y lectura encendida.
- Una sola familia, Manrope, en cinco cortes; cifras ExtraBold tabulares.
- Estado por forma + texto + color: visor hueco/encendido, palomita, rombo, octágono.
- Geometría mixta: rectángulos suaves, hoja de 28, cápsulas y círculos.
- Movimiento con resortes amortiguados y entradas escalonadas cortas; con "Reducir movimiento" se corta en seco.

## Colors

Una paleta de azules en cuatro profundidades (noche, señal, luminoso, suave) sobre una niebla azulada, con tres señales de estado que nunca se usan como decoración.

### Primary
- **Azul Señal** (#1652F0): la acción principal (una por pantalla u hoja), la tecla de avance, lo seleccionado, los enlaces de texto, el visor de lo contado, los íconos de tarea. En degradado de Azul Señal Brillante (#2B63F6) a #1446DB en botones y tecla de avance. Blanco encima: 6.0:1.
- **Azul Señal Hondo** (#0E3DBF): presionado del primario; texto azul sobre blanco y sobre azul suave (secundarios, "Listo", opción activa).

### Secondary
- **Azul Noche** (#0A2463): el cromo. Héroes de toda pantalla, la entrada, la fila que se teclea, el visor del teclado. Siempre en su degradado (#133A9A → #0A2463 → #061233) con halo #4C8DFF al 42 %.
- **Azul Noche Alto** (#17337F) y **Azul Noche Claro** (#24479C): piezas sobre el cromo (campos inactivos, pastilla del empaque al teclear).
- **Azul Tenue** (#AFC4F0): texto que se retira sobre el cromo (subtítulos, "de 14 productos", "Hola,"). ≥ 5:1 sobre todo el degradado.

### Tertiary
- **Azul Luminoso** (#5B9BFF) y **Cian Luz** (#7FD8FF): solo luz. El relleno de la barra de avance (degradado #3F86FF → #7FD8FF), el aro del campo activo, la cara superior del cubo del logotipo, el punto del rol. Nunca texto.

### Neutral
- **Niebla Azulada** (#EEF2F9): fondo de toda pantalla clara y de las teclas del teclado de cantidad.
- **Blanco** (#FFFFFF): tarjetas, hojas, filas, barra inferior, panel del teclado.
- **Niebla Honda** (#E3E9F4): campos en reposo, pastillas neutras, canal del selector.
- **Azul Suave** (#EAF1FF): fondo de la fila contada, círculos de ícono de tarea, botón "Listo".
- **Tinta Marino** (#0B1733), **Pizarra** (#45526B), **Pizarra Clara** (#56627A): texto principal, secundario y rótulos.
- **Contorno** (#D5DDEA): el filo de 1 px de toda pieza blanca; a pleno sol la sombra desaparece y el contorno la dibuja.
- **Borde de Control** (#74819A): contornos de campos, botón 0 y círculos vacíos del PIN (≥ 3:1).

### Estados
- **Listo** (#0B7A4E sobre #DDF4E9, texto #07482F): coincide, confirmado, completo. Siempre con palomita.
- **Aviso** (#FFB61F / hondo #C98600, fondo #FFF2D1, texto #6B4500): diferencias, sueltas que ya son paquete, sin conexión. Siempre con rombo.
- **No lleva** (#586379 sobre #E3E8F0): producto revisado en cero, cancelado.
- **Error** (#D12A3C, fondo #FDE8EB, texto #8E1224): rechazo del servidor, PIN incorrecto, bloqueo. Siempre con octágono o texto.

### Named Rules
**The Una Voz Azul Rule.** Azul Señal es lo que se toca para avanzar y lo que ya se leyó; un solo botón primario por pantalla u hoja. Lo demás va en secundario (blanco con texto azul hondo) o peligro.

**The Forma Antes Que Color Rule.** Ningún estado depende solo del color: el visor cambia de hueco a encendido, lo listo lleva palomita en círculo, el aviso rombo, el error octágono, y todos llevan su texto.

**The Luz No Es Texto Rule.** Azul Luminoso y Cian Luz son luz (avance, aros, halos); nunca se escriben con ellos.

## Typography

**Display Font:** Manrope (ExtraBold 800)
**Body Font:** Manrope (Medium 500, SemiBold 600, Bold 700)
**Label/Mono Font:** Manrope SemiBold 600; cifras con `tabular-nums`

**Character:** una grotesca moderna de aperturas abiertas y terminales suaves: humana en el texto corrido, firme y compacta en títulos, y con cifras muy legibles a distancia (el 1, el 4 y el 7 no se confunden). Una sola familia: la jerarquía sale del peso y del tamaño, no de mezclar caras.

### Hierarchy
- **Número** (800, 52/58, -1.2): la cifra que domina (cargas que esperan autorización).
- **Avance** (800, 36/40, -0.8): el "6" de "6 de 14 productos".
- **Display** (800, 30/36, -0.6): "Handy Conteo", el nombre de quien entra (34/40 en el saludo del inicio).
- **Total** (800, 28/32, tabular): la lectura del visor de cada fila.
- **Título** (800, 24/30): títulos de héroe, hojas y del botón grande.
- **Tecla** (600, 26/32; 28/34 en el PIN): dígitos de los teclados propios.
- **Campo** (800, 22/28, tabular): el número dentro de Paquetes / Sueltas.
- **Botón** (800, 17/22): texto de botones.
- **Subtítulo** (700, 16/22): nombres de producto (800), datos bajo su rótulo.
- **Cuerpo** (500, 16/24): texto corrido e instrucciones. Medium y no Regular: a pleno sol el Regular se deshace.
- **Etiqueta** (600, 14/20), **Placa** (700, 13/18), **Micro** (500, 13/18), **Rótulo / Etiqueta de dato** (600, 12/16): avisos, pastillas, contexto y rótulos.

### Named Rules
**The Minúsculas Rule.** Nada en mayúsculas gritadas: "Paquetes", "Esperando contador", "Contó". El peso separa el rótulo del dato.

**The Cifra Tabular Rule.** Toda cantidad que se compara lleva `tabular-nums` (`CIFRAS`): las columnas de números quedan alineadas al recorrer la lista.

**The Corte Por Fuente Rule.** El peso se elige con `FUENTE`, nunca con `fontWeight` (con fuente propia React Native lo ignora). Ningún texto baja de 12 px.

## Layout

Una columna. Margen lateral 16, ritmo en rejilla de 4 (`ESPACIADO` 4/8/12/16/24/32/48): 4 dentro de un grupo, 12 entre hermanos, 24 entre grupos, 48 entre secciones. Cada pantalla abre con su héroe azul noche (sube bajo la barra de estado; la pantalla no aplica el margen superior de área segura) y la superficie clara lo monta con su borde de 28.

Responsive por clase de ventana (`useLayout`): **compacto** (< 600) celular, teclado acoplado abajo, hojas inferiores; **medio** (600–839) tablet de 8" vertical, una columna de hasta 720 (560 en inicio, 568 en la lista de usuarios), teclas de 72, diálogos centrados de 480; **expandido** (≥ 840) tablet grande u horizontal, lista y teclado lado a lado (panel lateral con esquinas izquierdas de 28), usuarios en dos columnas. El teclado del PIN nunca pasa de teclas de 78: en tablet el bloque va al centro.

## Elevation & Depth

Sistema híbrido: profundidad por capas (cromo azul noche → superficie clara que lo monta → piezas blancas) más sombras suaves con desplazamiento, teñidas de azul noche (`boxShadow`, iOS y Android). Nada de sombras gigantes, halos sin dirección, neumorfismo ni vidrio desenfocado; lo translúcido sobre el cromo (panel del avance, teclas del PIN, volver) es un blanco al 8–14 % sin desenfoque.

### Shadow Vocabulary
- **tarjeta** (`0px 1px 2px rgba(11,23,51,0.06), 0px 6px 16px rgba(16,42,110,0.07)`): tarjetas, filas de conteo, grupo de menú, botón secundario.
- **elevada** (`0px 2px 6px rgba(11,23,51,0.06), 0px 14px 32px rgba(10,36,99,0.14)`): la pieza que flota (tarjetas de usuario, fila que se teclea, diálogo).
- **accion** (`0px 6px 16px rgba(22,82,240,0.30)`): botón primario, tecla de avance, día elegido. Desaparece al presionar.
- **panel** (`0px -6px 24px rgba(10,36,99,0.12)`): lo acoplado abajo (teclado, barra inferior, hoja): la sombra sube.
- **tecla** (`0px 1px 2px rgba(11,23,51,0.10)`): teclas claras del PIN, opción activa del selector.

### Named Rules
**The Contorno Al Sol Rule.** Toda pieza blanca lleva además su contorno de 1 px (#D5DDEA): la sombra se pierde a pleno sol; el contorno no.

## Shapes

Geometría mixta como identidad. Rectángulos suaves para lo que contiene: 8 (avisos, pastilla del empaque), 12 (campos, visor, teclas del teclado de cantidad), 16 (botones, campos de texto, bloques de error), 20 (filas de conteo), 22 (tarjetas y el botón grande). La hoja de 28 es la superficie que monta el héroe, la esquina alta de hojas, barra inferior y teclado. Cápsulas para pastillas de estado, selector Paquetes | Sueltas, barra de avance, bandas de familia y "Listo". Círculos para PIN (18), teclas del PIN (hasta 78), avatares, íconos de tarea (44) y de estado vacío (72 dentro de un anillo de 96), botón volver (44), botón 0 (56), palomita y días del calendario. Nada se recorta con `overflow: hidden` donde vive una sombra.

## Components

### Buttons
- **Shape:** rectángulo suave de 16 (22 el grande), alto 56 (112 el grande).
- **Primary:** degradado Azul Señal Brillante → #1446DB, texto blanco ExtraBold 17, sombra `accion`. Presionado: degradado hondo y sin sombra.
- **Grande:** la acción de un inicio; título de 24, detalle debajo y una flecha en un círculo translúcido.
- **Secondary:** blanco, contorno fino, sombra `tarjeta`, texto Azul Señal Hondo; presionado en azul tinte con contorno azul.
- **Peligro:** blanco con contorno rojo de 2 y texto rojo hondo; nunca el dominante.
- **Movimiento:** todos se hunden con resorte (0.96 controles, 0.98 piezas grandes) y vuelven.

### Chips (Pastillas)
- **Style:** cápsula del ancho de su texto: tinte del estado con texto hondo del mismo tono (Placa 13/18 Bold), relleno 4 × 12.
- **State:** azul (seleccionado/en curso), verde (listo), ámbar (aviso), rojo (error), pizarra (no lleva). La del empaque (C/12) es un rectángulo de 8 del mismo ancho en todas las filas.

### Cards / Containers
- **Corner Style:** 22.
- **Background:** blanco sobre niebla azulada; tintadas solo para comunicar un estado.
- **Shadow Strategy:** `tarjeta` (1) o `elevada` (2), con contorno fino.
- **Internal Padding:** 24 (16 compacta). El estado va como pastilla en la primera línea con un detalle a la derecha.

### Inputs / Fields
- **Style:** blanco, contorno de 1.5 en Borde de Control, esquina de 16, alto 56; rótulo arriba (Etiqueta de dato).
- **Focus:** contorno de 2 en Azul Señal y el rótulo pasa a azul hondo.
- **Error / Disabled:** contorno rojo con su texto debajo / niebla honda.

### Navigation
- **Héroe (`Encabezado`):** degradado azul noche con halo, volver circular translúcido de 44, título blanco 24, subtítulo Azul Tenue; `inferior` para un panel translúcido (avance). Termina en la montura de 28.
- **Menú (`FilaMenu`):** un bloque blanco con filas de 68: ícono de tarea en círculo azul suave, título ExtraBold 17, detalle, chevron en círculo. Presionada: pastilla interior azul tinte, el ícono y el chevron se encienden en azul.

### Entrada (login y PIN)
Toda sobre el cromo con anillos. Portada centrada: la placa del logotipo (cubo isométrico blanco sobre placa azul de 14 de radio con la cara superior en cian) con sombra honda, "Handy Conteo" Display y el lema "La Báscula de Bodega". Cada usuario es una tarjeta blanca elevada con avatar circular en degradado azul, nombre ExtraBold 19, rol debajo y chevron en círculo; entran escalonadas con resorte. El PIN: avatar, nombre, cuatro círculos (vacío = aro; activo = aro grueso 1.18×; lleno = sólido con resorte; error = aro rojo y sacudida; éxito = verde) y teclado de círculos translúcidos que se encienden en blanco.

### Fila de conteo (componente distintivo)
Pieza de esquina 20, contorno 1.5, relleno 12, misma medida en todo estado. A la derecha, el visor de 96 × 56 y el botón 0 circular de 56.
- **Sin contar:** blanca, contorno #A6B2C7, visor hueco punteado con "—".
- **Contado:** azul suave con contorno #9DB8F6, pastilla del empaque azul señal, palomita blanca en círculo verde y el visor encendido (degradado azul) con la cifra en blanco.
- **No lleva:** pizarra, sin sombra, visor sólido pizarra "0 · No lleva".
- **Tecleando:** toda la fila en el degradado azul noche con sombra `elevada`; el campo activo blanco con aro Azul Luminoso de 3.
- Cada cambio de estado destella 280 ms (azul al contar, pizarra en cero). Avisos dentro de la fila: bloque ámbar con rombo; rechazo: rosa con octágono.

### Teclado de cantidad
Panel blanco acoplado abajo con esquinas altas de 28 y sombra `panel`. Arriba repite el producto y "Listo" (cápsula azul suave). Selector Paquetes | Sueltas en cápsula: la opción activa es una pieza blanca que flota. La lectura va en un visor azul noche (el visor de la báscula) con la cifra blanca de 30; borde ámbar con aviso. Teclas de niebla de 16 con contorno fino; se encienden en azul al presionar. "No lleva" pizarra; la tecla de avance en degradado azul a doble alto con su sombra.

### Hoja y diálogo (`Hoja`)
Hoja inferior de esquinas altas de 28 con tirador y sombra que sube; entra con resorte amortiguado. En tablet, diálogo de 480 con esquinas de 28 que sube y aparece. Pie fijo: la salida a la izquierda y lo esperado a la derecha; con peligro se apilan.

### Discrepancias
Los dos conteos lado a lado como bloques de niebla (quién arriba, cuánto grande) y debajo la franja de diferencia en cápsula ámbar: rombo en círculo blanco, "Diferencia", quién contó más y la cifra. La cantidad final pendiente va en marco punteado; confirmada, sólida verde con palomita. Quién capturó y quién confirma siempre visibles.

### Estados vacíos, avisos y barra inferior
Estado vacío: círculo de 72 en el tinte del tono dentro de un anillo tenue de 96, título 20 y detalle. Bloques de error/aviso/éxito: esquina 16, contorno de 1.5, glifo (octágono, reloj, palomita) y título ExtraBold 17. La barra de acciones fija abajo (`BARRA_INFERIOR`) es blanca con esquinas altas de 28 y sombra que sube.

## Do's and Don'ts

### Do:
- **Do** abrir cada pantalla con el héroe azul noche de `Encabezado` y dejar que la superficie clara lo monte.
- **Do** usar un solo botón primario (azul señal en degradado) por pantalla u hoja.
- **Do** acompañar cada estado con forma y texto: visor hueco/encendido, palomita en círculo, rombo ámbar, octágono rojo.
- **Do** usar cifras Manrope ExtraBold con `CIFRAS` en toda cantidad que se compara.
- **Do** mantener 56 como toque mínimo (72 en teclas de tablet).
- **Do** dar a cada pieza blanca su contorno fino además de su sombra.
- **Do** hundir lo tocable con `Pulsable escala` (resorte) y respetar "Reducir movimiento".
- **Do** verificar cada par nuevo de texto sobre fondo (incluidas las paradas de un degradado) en `contraste.spec.ts`.
- **Do** ajustar la barra de estado con `useBarraEstado` en toda pantalla que no use `Encabezado`.

### Don't:
- **Don't** usar negro o asfalto como identidad; el oscuro de la app es azul noche.
- **Don't** escribir con Azul Luminoso o Cian Luz, ni poner degradados en texto o en tarjetas de contenido.
- **Don't** usar vidrio desenfocado, halos sin dirección, sombras gigantes o neumorfismo.
- **Don't** convertir todo en cápsula: contenedores en rectángulo suave, cápsula para estados y selectores, círculo para lo que es uno solo.
- **Don't** usar ámbar para lo que simplemente falta contar.
- **Don't** hacer del botón de peligro el dominante de una hoja.
- **Don't** usar un carácter (↑, !, ‹) como ícono; se dibuja en SVG de trazo 2 sobre cuadrícula de 24.
- **Don't** usar `Pressable` o `Modal` directo: `Pulsable`, `Hoja` y `PantallaModal`.
- **Don't** escribir colores, radios, sombras ni espacios caso por caso; todo sale de `tokens.ts` o `colores-familia.ts`.
