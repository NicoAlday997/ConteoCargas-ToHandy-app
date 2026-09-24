import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { COLORES, ELEVACION, ESPACIADO, OPACIDAD, RADIOS, RITMO, TIPOGRAFIA, type NivelTipografia } from '../../theme/tokens';

/** Lento: indica que algo viene, no pide atención. */
const DURACION_PULSO_MS = 800;

/**
 * Contenedor de un esqueleto: la forma del contenido que va a llegar, con un
 * pulso suave. Al llegar los datos nada salta, porque cada pieza mide lo que
 * medirá el contenido real. Un solo pulso para todo el bloque: barato en listas.
 */
export function Esqueleto({
  etiqueta,
  children,
  style,
}: {
  /** Lo que se está cargando, para lectores de pantalla ("Cargando historial"). */
  etiqueta: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reducido = useReducedMotion();
  const opacidad = useSharedValue(1);

  useEffect(() => {
    if (reducido) return;
    opacidad.value = withRepeat(withTiming(OPACIDAD.pulsoEsqueleto, { duration: DURACION_PULSO_MS }), -1, true);
  }, [opacidad, reducido]);

  const pulso = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      style={[pulso, style]}
      accessible
      accessibilityLabel={etiqueta}
      accessibilityState={{ busy: true }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Una línea de texto por llegar. Mide el interlineado del nivel tipográfico que
 * reemplaza, así el bloque no cambia de alto cuando llega el texto.
 */
export function LineaEsqueleto({
  nivel = 'cuerpo',
  ancho = '100%',
  sobreMarca = false,
}: {
  nivel?: NivelTipografia;
  ancho?: DimensionValue;
  /** Sobre el azul de marca: barra clara en vez de gris. */
  sobreMarca?: boolean;
}) {
  const alto = TIPOGRAFIA[nivel].lineHeight;
  return (
    <View style={[estilos.linea, { height: alto }]}>
      <View style={[estilos.barra, { width: ancho, height: TIPOGRAFIA[nivel].fontSize }, sobreMarca && estilos.barraMarca]} />
    </View>
  );
}

/** Bloque sólido del alto dado: un botón, un campo, una píldora. */
export function BloqueEsqueleto({ alto, ancho = '100%', radio = RADIOS.medio }: { alto: number; ancho?: DimensionValue; radio?: number }) {
  return <View style={[estilos.barra, { height: alto, width: ancho, borderRadius: radio }]} />;
}

/**
 * Tarjeta de lista por llegar: el título y las líneas de detalle de una
 * tarjeta real. `compacta` para las de relleno corto.
 */
export function TarjetaEsqueleto({
  lineas = ['70%', '45%'],
  titulo = 'subtitulo',
  compacta = false,
  cifra = false,
}: {
  /** Ancho de cada línea de detalle. */
  lineas?: DimensionValue[];
  titulo?: NivelTipografia;
  compacta?: boolean;
  /** Una cifra a la derecha, como en las tarjetas que muestran un total. */
  cifra?: boolean;
}) {
  return (
    <View style={[estilos.tarjeta, compacta && estilos.tarjetaCompacta]}>
      <View style={estilos.cuerpoTarjeta}>
        <LineaEsqueleto nivel={titulo} ancho="60%" />
        {lineas.map((ancho, i) => (
          <LineaEsqueleto key={i} nivel="etiqueta" ancho={ancho} />
        ))}
      </View>
      {cifra && <BloqueEsqueleto alto={TIPOGRAFIA.display.lineHeight} ancho={ESPACIADO.xxxl} radio={RADIOS.chico} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  linea: {
    justifyContent: 'center',
  },
  barra: {
    borderRadius: RADIOS.chico,
    backgroundColor: COLORES.borde,
    opacity: OPACIDAD.esqueleto,
  },
  barraMarca: {
    backgroundColor: COLORES.marcaClaro,
  },
  tarjeta: {
    ...ELEVACION[1],
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    borderRadius: RADIOS.grande,
  },
  tarjetaCompacta: {
    padding: ESPACIADO.lg,
  },
  cuerpoTarjeta: {
    flex: 1,
    gap: RITMO.interno,
  },
});
