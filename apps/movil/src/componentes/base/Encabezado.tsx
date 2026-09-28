import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { useBarraEstado } from '../../theme/barra-estado';
import { BORDES, COLORES, CURVA_SALIDA, ESCALA_TEXTO, ESPACIADO, MOVIMIENTO, RADIOS, RITMO, TIPOGRAFIA } from '../../theme/tokens';
import { Chevron } from './Icono';
import { Pulsable } from './Pulsable';

/** 44: el mínimo de iOS; con el hitSlop llega a los 56 de la app sin comerse el título. */
const LADO_VOLVER = 44;

interface Props {
  titulo: string;
  /** Bajo el título: la fecha de la carga, a quién pertenece. */
  subtitulo?: string | null;
  /** Muestra un chevron de volver a la izquierda. */
  onVolver?: () => void;
  etiquetaVolver?: string;
  /** Slot a la derecha del título: la acción de la pantalla. */
  accion?: ReactNode;
  /**
   * - marca: bloque de asfalto a todo el ancho, como el letrero de un pórtico
   *   sobre la carretera. SOLO las pantallas de trabajo con contexto propio
   *   (conteo, discrepancias, historial, autorizaciones, factores). Sube bajo
   *   la barra de estado: la pantalla que lo usa no debe aplicar el margen
   *   superior de área segura. Lo que vaya en `accion` e `inferior` debe
   *   leerse sobre asfalto (`useSobreMarca`).
   * - barra: sobre el fondo de pantalla, sin bloque (plantillas, familias…).
   * - plano: dentro del contenido (un modal, un paso de un flujo).
   */
  variante?: 'marca' | 'barra' | 'plano';
  /** Por omisión, 1 en marca (que no se coma la pantalla) y 2 en las demás. */
  lineasTitulo?: number;
  /** Líneas de contexto bajo el subtítulo, alineadas con el título. */
  children?: ReactNode;
  /** A todo el ancho, bajo el título (en marca, normalmente un `PanelEncabezado`). */
  inferior?: ReactNode;
}

export function Encabezado({
  titulo,
  subtitulo,
  onVolver,
  etiquetaVolver = 'Volver',
  accion,
  variante = 'barra',
  lineasTitulo,
  children,
  inferior,
}: Props) {
  const margenes = useSafeAreaInsets();
  // Dentro de un modal (plano) la barra de estado no es suya.
  useBarraEstado(variante === 'plano' ? null : variante === 'marca' ? 'light' : 'dark');
  const sobreMarca = variante === 'marca';
  const lineas = lineasTitulo ?? (sobreMarca ? 1 : 2);
  const estiloContenedor =
    variante === 'marca'
      ? [estilos.barra, estilos.barraMarca, { paddingTop: margenes.top + ESPACIADO.md }]
      : variante === 'barra'
        ? estilos.barra
        : estilos.plano;

  return (
    <ContextoMarca.Provider value={sobreMarca}>
      <View style={estiloContenedor}>
        <View style={estilos.fila}>
          {onVolver && (
            <Pulsable
              onPress={onVolver}
              accessibilityRole="button"
              accessibilityLabel={etiquetaVolver}
              hitSlop={ESPACIADO.sm}
              style={({ pressed }) => [
                estilos.botonVolver,
                sobreMarca ? estilos.botonVolverMarca : estilos.botonVolverClaro,
                pressed && (sobreMarca ? estilos.botonVolverPresionadoMarca : estilos.botonVolverPresionado),
              ]}
            >
              <Chevron
                direccion="izquierda"
                tamano={ESPACIADO.xl - ESPACIADO.xs}
                color={sobreMarca ? COLORES.textoSobreColor : COLORES.texto}
              />
            </Pulsable>
          )}
          <View style={[estilos.titulos, onVolver && (sobreMarca ? estilos.titulosConVolver : estilos.titulosConVolverPlano)]}>
            <Text
              style={[sobreMarca ? estilos.titulo : estilos.tituloPlano, sobreMarca && estilos.textoInvertido]}
              accessibilityRole="header"
              numberOfLines={lineas}
              maxFontSizeMultiplier={sobreMarca ? ESCALA_TEXTO.compacto : undefined}
            >
              {titulo}
            </Text>
            {subtitulo ? (
              // En la barra no debe crecer sin límite; dentro del contenido se lee completo.
              <Text
                style={[variante === 'plano' ? estilos.subtituloPlano : estilos.subtitulo, sobreMarca && estilos.subtituloMarca]}
                numberOfLines={variante === 'plano' ? undefined : 2}
              >
                {subtitulo}
              </Text>
            ) : null}
            {children}
          </View>
          {accion}
        </View>
        {inferior}
      </View>
    </ContextoMarca.Provider>
  );
}

/**
 * Segundo renglón del encabezado de asfalto: un panel un tono arriba que
 * agrupa el avance, el carril y el estado de envío.
 */
export function PanelEncabezado({ children }: { children: ReactNode }) {
  return <View style={estilos.panel}>{children}</View>;
}

const CURVA_CARRIL = Easing.bezier(...CURVA_SALIDA);

/**
 * El carril de avance: lo que falta se ve como las marcas discontinuas de un
 * carril y lo contado lo cubre una línea verde continua, que se traza hasta su
 * nuevo largo en cada captura. Se lee de reojo sin quitarle alto a la lista.
 * Con "Reducir movimiento", Reanimated lo deja en su largo sin animar.
 */
export function BarraAvance({ actual, total }: { actual: number; total: number }) {
  const avance = total > 0 ? Math.min(1, Math.max(0, actual / total)) : 0;
  const largo = useSharedValue(avance);
  useEffect(() => {
    largo.value = withTiming(avance, { duration: MOVIMIENTO.carril, easing: CURVA_CARRIL });
  }, [avance, largo]);
  const estiloRelleno = useAnimatedStyle(() => ({ width: `${largo.value * 100}%` }));

  return (
    <View style={estilos.canal} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: actual }}>
      <Svg width="100%" height={ALTO_CARRIL} style={StyleSheet.absoluteFill}>
        <Line
          x1={ESPACIADO.sm}
          y1={ALTO_CARRIL / 2}
          x2="100%"
          y2={ALTO_CARRIL / 2}
          stroke={COLORES.carril}
          strokeWidth={2}
          strokeDasharray="10 8"
        />
      </Svg>
      <Animated.View style={[estilos.relleno, estiloRelleno]} />
    </View>
  );
}

const ALTO_CARRIL = 10;

const ContextoMarca = createContext(false);

/** Si el contenido va dentro de un encabezado de marca (asfalto): así elige colores que se lean. */
export function useSobreMarca(): boolean {
  return useContext(ContextoMarca);
}

/** Contexto dentro del encabezado: se retira frente al título y al subtítulo. */
export function NotaEncabezado({ children, lineas = 2 }: { children: ReactNode; lineas?: number }) {
  const sobreMarca = useSobreMarca();
  return (
    <Text style={[estilos.nota, sobreMarca && estilos.notaMarca]} numberOfLines={lineas}>
      {children}
    </Text>
  );
}

const estilos = StyleSheet.create({
  barra: {
    gap: ESPACIADO.md,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.md,
    paddingBottom: ESPACIADO.md,
  },
  // A todo el ancho y a escuadra: un pórtico, no una tarjeta.
  barraMarca: {
    paddingBottom: RITMO.margen,
    backgroundColor: COLORES.marca,
  },
  plano: {
    gap: ESPACIADO.sm,
  },
  // Arriba, no al centro: con notas de contexto el volver se quedaba flotando a
  // media altura. El título se centra ópticamente con el botón (ver titulosConVolver).
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
  },
  botonVolver: {
    width: LADO_VOLVER,
    height: LADO_VOLVER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.icono,
  },
  botonVolverMarca: {
    backgroundColor: COLORES.marcaClara,
  },
  botonVolverClaro: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.superficieHonda,
  },
  botonVolverPresionadoMarca: {
    backgroundColor: COLORES.marcaHonda,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  // Sin hueco: el interlineado ya separa título, subtítulo y notas.
  titulos: {
    flex: 1,
  },
  // La primera línea del título, centrada con el botón de volver.
  titulosConVolver: {
    paddingTop: (LADO_VOLVER - TIPOGRAFIA.tituloBarra.lineHeight) / 2,
  },
  titulosConVolverPlano: {
    paddingTop: (LADO_VOLVER - TIPOGRAFIA.titulo.lineHeight) / 2,
  },
  titulo: {
    ...TIPOGRAFIA.tituloBarra,
    color: COLORES.texto,
  },
  tituloPlano: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  subtitulo: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  subtituloMarca: {
    color: COLORES.marcaTenue,
  },
  subtituloPlano: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  notaMarca: {
    color: COLORES.marcaTenue,
  },
  panel: {
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
    backgroundColor: COLORES.marcaHonda,
    borderRadius: RADIOS.panel,
    borderWidth: BORDES.fino,
    borderColor: COLORES.marcaClara,
  },
  canal: {
    height: ALTO_CARRIL,
    justifyContent: 'center',
    borderRadius: RADIOS.chico,
    backgroundColor: COLORES.marcaProfunda,
    overflow: 'hidden',
  },
  relleno: {
    height: '100%',
    borderRadius: RADIOS.chico,
    backgroundColor: COLORES.accionViva,
  },
});
