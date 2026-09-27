import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COLOR_TAREA, COLORES, ESPACIADO, RADIOS, TONOS, type ColorTono, type Tarea } from '../../theme/tokens';

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
 * - alerta: algo falló.
 * - autorizar: el visto bueno del supervisor.
 * - plantilla: qué productos ve cada ruta.
 * - calendario: días no laborables.
 * - colores: colores de familia.
 */
export type NombreIcono =
  | 'lista'
  | 'listo'
  | 'reloj'
  | 'personas'
  | 'caja'
  | 'candado'
  | 'alerta'
  | 'autorizar'
  | 'plantilla'
  | 'calendario'
  | 'colores';

/** Qué ícono lleva cada tarea; el color sale de COLOR_TAREA. */
export const ICONO_TAREA: Record<Tarea, NombreIcono> = {
  autorizar: 'autorizar',
  empaques: 'caja',
  plantillas: 'plantilla',
  historial: 'reloj',
  personas: 'personas',
  diasNoLaborables: 'calendario',
  coloresFamilia: 'colores',
};

/** Círculo del estado vacío. */
const TAMANO_VACIO = 72;
const DIBUJO_VACIO = 36;
/** Cuadro de una fila de menú. */
const TAMANO_TAREA = 40;
const DIBUJO_TAREA = 22;

interface Props {
  nombre: NombreIcono;
  tono?: ColorTono;
}

/** Círculo de 72 px en el tinte del tono, con el dibujo grande en su color fuerte. */
export function Icono({ nombre, tono = 'marca' }: Props) {
  const { solido, fondo } = TONOS[tono];
  return (
    <View
      style={[estilos.circulo, { backgroundColor: fondo }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dibujo nombre={nombre} color={solido} tamano={DIBUJO_VACIO} />
    </View>
  );
}

/** Cuadro de 40 px de una fila de menú: el ícono de la tarea en el color de la tarea. */
export function IconoTarea({ tarea }: { tarea: Tarea }) {
  const { solido, fondo } = TONOS[COLOR_TAREA[tarea]];
  return (
    <View
      style={[estilos.cuadro, { backgroundColor: fondo }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dibujo nombre={ICONO_TAREA[tarea]} color={solido} tamano={DIBUJO_TAREA} />
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
    <View style={{ width: tamano, height: tamano }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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

/** Palomita en SVG: "contado", "completa". */
export function Palomita({ color, tamano = ESPACIADO.lg + ESPACIADO.xs }: { color: string; tamano?: number }) {
  return (
    <View style={{ width: tamano, height: tamano }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Lápiz en SVG: junto a un dato que se toca para cambiarlo (la fecha de la carga). */
export function Lapiz({ color, tamano = ESPACIADO.lg }: { color: string; tamano?: number }) {
  return (
    <View style={{ width: tamano, height: tamano }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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

/** Todos en una cuadrícula de 24 con trazo de 2: se ven del mismo peso a cualquier tamaño. */
function Dibujo({ nombre, color, tamano }: { nombre: NombreIcono; color: string; tamano: number }) {
  const trazo = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
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
      contenido = <Path d="M4.5 12.5l5 5L19.5 7" {...trazo} strokeWidth={2.5} />;
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
      contenido = <Path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5L12 12l9-4.5M12 12v9" {...trazo} />;
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
      contenido = (
        <>
          <Path d="M12 3.5L2.5 20h19L12 3.5z" {...trazo} />
          <Path d="M12 9.5v5M12 17.5v.01" {...trazo} />
        </>
      );
      break;
    case 'autorizar':
      contenido = <Path d="M12 3l8 3v6c0 4.4-3.4 8.2-8 9-4.6-.8-8-4.6-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-5" {...trazo} />;
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
          <Path d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4" {...trazo} />
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
  }
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      {contenido}
    </Svg>
  );
}

const estilos = StyleSheet.create({
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
    borderRadius: RADIOS.icono,
  },
});
