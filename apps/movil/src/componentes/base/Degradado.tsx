import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { HALO, type Degradado as TipoDegradado } from '../../theme/tokens';

interface Props {
  degradado: TipoDegradado;
  /** Resplandor de luz arriba a la derecha: solo el cromo azul noche. */
  halo?: boolean;
  /**
   * Anillos concéntricos tenues, como la carátula de un instrumento de
   * medición: solo en los fondos de la entrada, donde no hay contenido denso.
   */
  anillos?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Relleno en degradado detrás del contenido de su padre. Se dibuja en SVG
 * (react-native-svg, igual en iOS y Android) y ocupa todo el padre: va como
 * primer hijo de una vista con `position: relative`. No recibe toques.
 *
 * SOLO para superficies grandes que no cambian de tamaño (el héroe, el fondo
 * del login y del inicio): ver la regla junto a DEGRADADOS en tokens.ts.
 *
 * NO SE MIDE. El <Svg> y sus rellenos van al 100 % y las coordenadas del
 * degradado son fraccionarias: el SVG se estira con su contenedor en el mismo
 * cuadro de layout, en el lado nativo, sin pasar por React. Antes medía su
 * tamaño con onLayout, lo guardaba en estado y dibujaba con esa medida; cada
 * cambio de tamaño dejaba el dibujo con la medida vieja hasta el siguiente
 * render (que llegaba tarde o no llegaba). No vuelvas a meter una medición.
 *
 * Tampoco recorta esquinas: el contenedor recorta con `overflow: 'hidden'`.
 * El fondo sólido del contenedor (en su estilo) es el que garantiza que el
 * texto se lea; esto solo decora encima.
 */
export function Degradado({ degradado, halo = false, anillos = false, style }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { x1, y1, x2, y2 } = vectorDeAngulo(degradado.angulo);
  const n = degradado.colores.length;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`l${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>
            {degradado.colores.map((color, i) => (
              <Stop key={i} offset={degradado.paradas?.[i] ?? (n === 1 ? 0 : i / (n - 1))} stopColor={color} />
            ))}
          </LinearGradient>
          {halo && (
            <RadialGradient id={`r${id}`} cx="88%" cy="0%" rx="75%" ry="70%" fx="88%" fy="0%">
              <Stop offset={0} stopColor={HALO.color} stopOpacity={HALO.opacidad} />
              <Stop offset={1} stopColor={HALO.color} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#l${id})`} />
        {halo && <Rect x={0} y={0} width="100%" height="100%" fill={`url(#r${id})`} />}
        {anillos &&
          RADIOS_ANILLOS.map((r, i) => (
            <Circle key={r} cx="92%" cy="6%" r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.07 - i * 0.015} strokeWidth={1} />
          ))}
      </Svg>
    </View>
  );
}

/** Radios de los anillos de la carátula, en px. */
const RADIOS_ANILLOS = [120, 200, 290];

/** Ángulo de CSS (0 = hacia arriba, 90 = hacia la derecha, 180 = hacia abajo) a los extremos del degradado. */
function vectorDeAngulo(angulo: number) {
  const rad = (angulo * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  const redondear = (v: number) => `${Math.round(v * 1000) / 10}%`;
  return { x1: redondear(0.5 - dx), y1: redondear(0.5 - dy), x2: redondear(0.5 + dx), y2: redondear(0.5 + dy) };
}
