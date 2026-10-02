import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  CIFRAS,
  COLORES,
  DEGRADADOS,
  ESCALA_TEXTO,
  ESPACIADO,
  FUENTE,
  RADIOS,
  TONOS,
  type ColorTono,
  type Tarea,
} from '../../theme/tokens';

/**
 * Iconos en SVG, sin librerías: pocos, simples y del mismo trazo. Van en un
 * bloque tintado con el dibujo en el color fuerte del tono: en un estado
 * vacío (círculo grande) o a la izquierda de una fila de menú (cuadro, ver
 * `IconoTarea`); nunca sueltos decorando un botón. Las excepciones son
 * `Chevron` ("esto lleva a otra pantalla" o "volver"), `Palomita` ("contado")
 * y `Lapiz` ("esto se puede cambiar"), que no decoran: comunican.
 * - lista: un historial o registro (aquí aparecerán las cargas).
 * - listo: nada pendiente (la cola está al día, todo resuelto).
 * - reloj: algo con vigencia o en espera; el historial.
 * - personas: usuarios.
 * - caja: productos de una carga; el empaque.
 * - candado: sin acceso.
 * - alerta: aviso preventivo (rombo, como el letrero amarillo): pide atención.
 * - alto: error o bloqueo (octágono, como el letrero de alto): algo falló.
 * - autorizar: el visto bueno del supervisor.
 * - plantilla: qué productos ve cada ruta.
 * - calendario: días no laborables.
 * - colores: colores de familia.
 * - camion: la ruta, la salida.
 * - subir: guardado en el teléfono, falta que llegue al servidor.
 * - sinSenal: sin conexión.
 * - persona: quién hizo algo.
 * - borrar: la tecla de borrar el último dígito.
 * - sincronizar: traer de Handy el catálogo y los vendedores.
 */
export type NombreIcono =
  | 'lista'
  | 'listo'
  | 'reloj'
  | 'personas'
  | 'caja'
  | 'candado'
  | 'alerta'
  | 'alto'
  | 'autorizar'
  | 'plantilla'
  | 'calendario'
  | 'colores'
  | 'camion'
  | 'subir'
  | 'sinSenal'
  | 'persona'
  | 'borrar'
  | 'sincronizar';

/** Qué ícono lleva cada tarea. Todos en tinta: el color es de los estados. */
export const ICONO_TAREA: Record<Tarea, NombreIcono> = {
  autorizar: 'autorizar',
  empaques: 'caja',
  plantillas: 'plantilla',
  historial: 'reloj',
  personas: 'personas',
  diasNoLaborables: 'calendario',
  coloresFamilia: 'colores',
  sincronizar: 'sincronizar',
};

/** Círculo del estado vacío y el anillo de luz que lo rodea. */
const TAMANO_VACIO = 72;
const TAMANO_ANILLO = 96;
const DIBUJO_VACIO = 34;
/** Círculo de una fila de menú. */
const TAMANO_TAREA = 44;
const DIBUJO_TAREA = 22;

interface Props {
  nombre: NombreIcono;
  tono?: ColorTono;
}

/**
 * Círculo de 72 px en el tinte del tono, con el dibujo en su color fuerte y un
 * anillo tenue alrededor: la geometría circular de la app, que dice de un
 * vistazo si es buena noticia (verde), aviso (ámbar), error (rojo) o
 * información (azul).
 */
export function Icono({ nombre, tono = 'marca' }: Props) {
  const { solido, fondo } = TONOS[tono];
  return (
    <View
      style={estilos.anillo}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          estilos.anilloTenue,
          { backgroundColor: fondo },
        ]}
      />
      <View style={[estilos.circulo, { backgroundColor: fondo }]}>
        <Dibujo nombre={nombre} color={solido} tamano={DIBUJO_VACIO} />
      </View>
    </View>
  );
}

/**
 * Círculo de 44 px de una fila de menú: el pictograma de la tarea en azul
 * sobre azul suave. `invertido` cuando la fila está presionada: se enciende en
 * azul sólido con el dibujo en blanco.
 */
export function IconoTarea({
  tarea,
  invertido = false,
}: {
  tarea: Tarea;
  invertido?: boolean;
}) {
  return (
    <View
      style={[
        estilos.cuadro,
        { backgroundColor: invertido ? COLORES.accion : COLORES.azulSuave },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dibujo
        nombre={ICONO_TAREA[tarea]}
        color={invertido ? COLORES.textoSobreColor : COLORES.accion}
        tamano={DIBUJO_TAREA}
      />
    </View>
  );
}

/**
 * Chevron en SVG ("›" o "‹"): mismo tamaño y grosor en toda la app y centrado
 * en su renglón, cosa que el carácter de texto no garantiza (queda fino y cae
 * sobre la línea base). Ocupa un cuadro fijo para que las filas alineen.
 */
export function Chevron({
  direccion = 'derecha',
  color = COLORES.textoTerciario,
  tamano = ESPACIADO.xl,
}: {
  direccion?: 'derecha' | 'izquierda';
  /** Terciario por omisión; blanco sobre azul. */
  color?: string;
  tamano?: number;
}) {
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path
          d={direccion === 'derecha' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/**
 * Flecha de letrero de destino: gruesa y con punta abierta. Dice "esto te lleva
 * a otra pantalla" en el botón grande, donde el chevron se veía tímido.
 */
export function Flecha({
  color,
  tamano = ESPACIADO.xl + ESPACIADO.sm,
}: {
  color: string;
  tamano?: number;
}) {
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 12h15M13 5.5l6.5 6.5-6.5 6.5"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** El número de una ruta a partir de su nombre ("Ruta 3" → "3"); null si no trae número. */
export function numeroRuta(nombre: string | null | undefined): string | null {
  const encontrado = nombre?.match(/\d+/);
  return encontrado ? encontrado[0] : null;
}

/** Palomita en SVG: "contado", "completa". */
export function Palomita({
  color,
  tamano = ESPACIADO.lg + ESPACIADO.xs,
}: {
  color: string;
  tamano?: number;
}) {
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Lápiz en SVG: junto a un dato que se toca para cambiarlo (la fecha de la carga). */
export function Lapiz({
  color,
  tamano = ESPACIADO.lg,
}: {
  color: string;
  tamano?: number;
}) {
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/**
 * El dibujo suelto, sin bloque: junto a un texto que dice lo mismo (una
 * pastilla de estado, un aviso). Nunca solo: el color y la forma acompañan al
 * texto, no lo sustituyen.
 */
export function Glifo({
  nombre,
  color,
  tamano = ESPACIADO.lg + ESPACIADO.xs,
}: {
  nombre: NombreIcono;
  color: string;
  tamano?: number;
}) {
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dibujo nombre={nombre} color={color} tamano={tamano} />
    </View>
  );
}

/** Todos en una cuadrícula de 24 con trazo de 2: se ven del mismo peso a cualquier tamaño. */
function Dibujo({
  nombre,
  color,
  tamano,
}: {
  nombre: NombreIcono;
  color: string;
  tamano: number;
}) {
  const trazo = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;
  let contenido;
  switch (nombre) {
    case 'lista':
      contenido = (
        <>
          <Path d="M9 6h11M9 12h11M9 18h7" {...trazo} />
          <Circle cx={4.5} cy={6} r={1.25} fill={color} />
          <Circle cx={4.5} cy={12} r={1.25} fill={color} />
          <Circle cx={4.5} cy={18} r={1.25} fill={color} />
        </>
      );
      break;
    case 'listo':
      contenido = (
        <Path d="M4.5 12.5l5 5L19.5 7" {...trazo} strokeWidth={2.5} />
      );
      break;
    case 'reloj':
      contenido = (
        <>
          <Circle cx={12} cy={12} r={9} {...trazo} />
          <Path d="M12 7v5l3.5 2" {...trazo} />
        </>
      );
      break;
    case 'personas':
      contenido = (
        <>
          <Circle cx={9} cy={8} r={3.5} {...trazo} />
          <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" {...trazo} />
          <Circle cx={17} cy={9} r={2.5} {...trazo} />
          <Path d="M17 14c2.6 0 4.5 1.9 4.5 5" {...trazo} />
        </>
      );
      break;
    case 'caja':
      contenido = (
        <Path
          d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5L12 12l9-4.5M12 12v9"
          {...trazo}
        />
      );
      break;
    case 'candado':
      contenido = (
        <>
          <Rect x={4.5} y={10.5} width={15} height={10.5} rx={2} {...trazo} />
          <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5" {...trazo} />
        </>
      );
      break;
    case 'alerta':
      // Rombo preventivo: la forma dice "atención" aunque el sol lave el amarillo.
      contenido = (
        <>
          <Path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" {...trazo} />
          <Path d="M12 8v5M12 16.25v.01" {...trazo} strokeWidth={2.5} />
        </>
      );
      break;
    case 'alto':
      // Octágono de alto: la forma dice "falló" o "detente" sin leer el color.
      contenido = (
        <>
          <Path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" {...trazo} />
          <Path d="M12 7.75v5.5M12 16.25v.01" {...trazo} strokeWidth={2.5} />
        </>
      );
      break;
    case 'autorizar':
      contenido = (
        <Path
          d="M12 3l8 3v6c0 4.4-3.4 8.2-8 9-4.6-.8-8-4.6-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-5"
          {...trazo}
        />
      );
      break;
    case 'plantilla':
      contenido = (
        <>
          <Rect x={4.5} y={4} width={15} height={17} rx={2} {...trazo} />
          <Path d="M9 2.5h6v3H9zM8.5 11h7M8.5 15h4.5" {...trazo} />
        </>
      );
      break;
    case 'calendario':
      contenido = (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={2} {...trazo} />
          <Path
            d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4"
            {...trazo}
          />
        </>
      );
      break;
    case 'colores':
      contenido = (
        <>
          <Circle cx={8} cy={8.5} r={4} {...trazo} />
          <Circle cx={16} cy={8.5} r={4} {...trazo} />
          <Circle cx={12} cy={15.5} r={4} {...trazo} />
        </>
      );
      break;
    case 'camion':
      contenido = (
        <>
          <Path d="M2.5 6h11v9.5h-11zM13.5 9.5h4l3 3.5v2.5h-7" {...trazo} />
          <Circle cx={7} cy={18} r={1.75} {...trazo} />
          <Circle cx={17} cy={18} r={1.75} {...trazo} />
        </>
      );
      break;
    case 'sincronizar':
      contenido = (
        <Path
          d="M19.5 10.5A7.5 7.5 0 0 0 6.2 6.8M4.5 13.5a7.5 7.5 0 0 0 13.3 3.7M6 3v4h4M18 21v-4h-4"
          {...trazo}
        />
      );
      break;
    case 'subir':
      contenido = (
        <Path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" {...trazo} strokeWidth={2.5} />
      );
      break;
    case 'sinSenal':
      contenido = (
        <>
          <Path
            d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M9 16a4.5 4.5 0 0 1 6 0"
            {...trazo}
          />
          <Path d="M4 4l16 16" {...trazo} strokeWidth={2.5} />
        </>
      );
      break;
    case 'borrar':
      contenido = (
        <>
          <Path
            d="M8.5 5.5h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11L2.5 12z"
            {...trazo}
          />
          <Path d="M11.5 9.5l5 5M16.5 9.5l-5 5" {...trazo} />
        </>
      );
      break;
    case 'persona':
      contenido = (
        <>
          <Circle cx={12} cy={8} r={4} {...trazo} />
          <Path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" {...trazo} />
        </>
      );
      break;
  }
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      {contenido}
    </Svg>
  );
}

/**
 * Escudo de ruta: identifica una ruta de venta ("3") como el escudo
 * identifica una carretera. Es un dato, no un adorno: lleva el número de la
 * ruta y nada más. Azul señal con el número en blanco; se lee sobre claro y
 * sobre el héroe azul noche (lo rodea un filo blanco).
 */
export function EscudoRuta({
  numero,
  tamano = 'normal',
  accessibilityLabel,
}: {
  numero: string;
  tamano?: 'normal' | 'grande';
  accessibilityLabel?: string;
}) {
  const alto = tamano === 'grande' ? ALTO_ESCUDO_GRANDE : ALTO_ESCUDO;
  const ancho = Math.round(alto * 0.88);
  const texto = numero.length > 3 ? numero.slice(0, 3) : numero;
  return (
    <View
      style={{
        width: ancho,
        height: alto,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible
      accessibilityLabel={accessibilityLabel ?? `Ruta ${numero}`}
    >
      <Svg
        width={ancho}
        height={alto}
        viewBox="0 0 44 50"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d="M7 3h30c2.8 0 5 2.2 5 5v14c0 13-9 21.5-20 25C11 43.5 2 35 2 22V8c0-2.8 2.2-5 5-5z"
          fill={COLORES.accion}
          stroke={COLORES.superficie}
          strokeWidth={2.5}
        />
      </Svg>
      <Text
        style={[
          tamano === 'grande'
            ? estilos.numeroEscudoGrande
            : estilos.numeroEscudo,
          texto.length > 2 && estilos.numeroEscudoLargo,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={ESCALA_TEXTO.control}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {texto}
      </Text>
    </View>
  );
}

/**
 * La marca de Handy Conteo: un cubo isométrico (la carga) dentro de una placa
 * azul redondeada, con la cara de arriba encendida como la lectura de una
 * báscula. `invertida` sobre el héroe azul noche: la placa lleva un filo de
 * luz para despegarse del fondo.
 */
export function MarcaApp({
  tamano = ESPACIADO.xxl + ESPACIADO.sm,
  invertida = false,
}: {
  tamano?: number;
  invertida?: boolean;
}) {
  const [inicio, fin] = DEGRADADOS.accion.colores;
  return (
    <View
      style={{ width: tamano, height: tamano }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={tamano} height={tamano} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="marcaPlaca" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset={0} stopColor={COLORES.accionViva} />
            <Stop offset={0.45} stopColor={inicio} />
            <Stop offset={1} stopColor={fin} />
          </LinearGradient>
        </Defs>
        <Rect
          x={1}
          y={1}
          width={46}
          height={46}
          rx={14}
          fill="url(#marcaPlaca)"
          stroke={invertida ? 'rgba(255,255,255,0.35)' : 'none'}
          strokeWidth={1.5}
        />
        <Path
          d="M24 11.5l11 6.25-11 6.25-11-6.25z"
          fill={COLORES.cian}
          fillOpacity={0.55}
        />
        <Path
          d="M24 11.5l11 6.25v12.5L24 36.5l-11-6.25v-12.5zM13 17.75L24 24l11-6.25M24 24v12.5"
          stroke={COLORES.superficie}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const ALTO_ESCUDO = 36;
const ALTO_ESCUDO_GRANDE = 52;

const estilos = StyleSheet.create({
  numeroEscudo: {
    marginTop: -2,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 16,
    lineHeight: 20,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  numeroEscudoGrande: {
    marginTop: -2,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 22,
    lineHeight: 28,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  numeroEscudoLargo: {
    fontSize: 14,
  },
  anillo: {
    width: TAMANO_ANILLO,
    height: TAMANO_ANILLO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anilloTenue: {
    borderRadius: RADIOS.completo,
    opacity: 0.45,
  },
  circulo: {
    width: TAMANO_VACIO,
    height: TAMANO_VACIO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  cuadro: {
    width: TAMANO_TAREA,
    height: TAMANO_TAREA,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
});
