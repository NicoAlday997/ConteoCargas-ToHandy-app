import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBarraEstado } from '../../theme/barra-estado';
import {
  BORDES,
  COLORES,
  CURVA_SALIDA,
  DEGRADADOS,
  ESCALA_PRESIONADO_CONTROL,
  ESCALA_TEXTO,
  ESPACIADO,
  MOVIMIENTO,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
} from '../../theme/tokens';
import { Degradado } from './Degradado';
import { fraccionAvance } from './fraccion-avance';
import { Chevron } from './Icono';
import { Pulsable } from './Pulsable';

/** 44: el mínimo de iOS; con el hitSlop llega a los 56 de la app sin comerse el título. */
const LADO_VOLVER = 44;

/** Lo que la superficie clara de abajo monta sobre el héroe: su borde redondeado. */
const ALTO_MONTURA = RADIOS.encabezado;

interface Props {
  titulo: string;
  /** Bajo el título: la fecha de la carga, a quién pertenece. */
  subtitulo?: string | null;
  /** Muestra un volver circular a la izquierda. */
  onVolver?: () => void;
  etiquetaVolver?: string;
  /** Slot a la derecha del título: la acción de la pantalla. */
  accion?: ReactNode;
  /**
   * - marca: el héroe azul noche con su halo de luz, a todo el ancho. Las
   *   pantallas de trabajo con contexto propio (conteo, discrepancias,
   *   historial, autorizaciones) y su panel inferior (`inferior`).
   * - barra: el mismo héroe, más compacto: administración (plantillas,
   *   familias, días no laborables, cambiar PIN).
   * - plano: dentro del contenido (una hoja, un paso de un flujo).
   * En marca y barra el héroe sube bajo la barra de estado (la pantalla no
   * aplica el margen superior de área segura) y termina en la montura: el
   * borde redondeado de la superficie clara que sigue. Lo que vaya en
   * `accion` e `inferior` debe leerse sobre azul (`useSobreMarca`).
   */
  variante?: 'marca' | 'barra' | 'plano';
  /** Por omisión, 1 en marca (que no se coma la pantalla) y 2 en las demás. */
  lineasTitulo?: number;
  /** Líneas de contexto bajo el subtítulo, alineadas con el título. */
  children?: ReactNode;
  /** A todo el ancho, bajo el título (en marca, normalmente un `PanelEncabezado`). */
  inferior?: ReactNode;
  /** Color de la superficie que monta el héroe; por omisión, el fondo de pantalla. */
  fondoInferior?: string;
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
  fondoInferior = COLORES.fondo,
}: Props) {
  const margenes = useSafeAreaInsets();
  const heroe = variante !== 'plano';
  // Dentro de un modal (plano) la barra de estado no es suya.
  useBarraEstado(heroe ? 'light' : null);
  const lineas = lineasTitulo ?? (variante === 'marca' ? 1 : 2);

  if (!heroe) {
    return (
      <View style={estilos.plano}>
        <View style={estilos.fila}>
          {onVolver && (
            <BotonVolver
              onVolver={onVolver}
              etiqueta={etiquetaVolver}
              sobreMarca={false}
            />
          )}
          <View
            style={[estilos.titulos, onVolver && estilos.titulosConVolverPlano]}
          >
            <Text
              style={estilos.tituloPlano}
              accessibilityRole="header"
              numberOfLines={lineas}
            >
              {titulo}
            </Text>
            {subtitulo ? (
              <Text style={estilos.subtituloPlano}>{subtitulo}</Text>
            ) : null}
            {children}
          </View>
          {accion}
        </View>
        {inferior}
      </View>
    );
  }

  return (
    <ContextoMarca.Provider value>
      <View
        style={[estilos.heroe, { paddingTop: margenes.top + ESPACIADO.md }]}
      >
        <Degradado degradado={DEGRADADOS.marca} halo />
        <View style={estilos.fila}>
          {onVolver && (
            <BotonVolver
              onVolver={onVolver}
              etiqueta={etiquetaVolver}
              sobreMarca
            />
          )}
          <View style={[estilos.titulos, onVolver && estilos.titulosConVolver]}>
            <Text
              style={estilos.titulo}
              accessibilityRole="header"
              numberOfLines={lineas}
              maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
            >
              {titulo}
            </Text>
            {subtitulo ? (
              <Text style={estilos.subtitulo} numberOfLines={2}>
                {subtitulo}
              </Text>
            ) : null}
            {children}
          </View>
          {accion}
        </View>
        {inferior}
        <View
          pointerEvents="none"
          style={[estilos.montura, { backgroundColor: fondoInferior }]}
        />
      </View>
    </ContextoMarca.Provider>
  );
}

function BotonVolver({
  onVolver,
  etiqueta,
  sobreMarca,
}: {
  onVolver: () => void;
  etiqueta: string;
  sobreMarca: boolean;
}) {
  return (
    <Pulsable
      onPress={onVolver}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={ESPACIADO.sm}
      escala={ESCALA_PRESIONADO_CONTROL}
      style={({ pressed }) => [
        estilos.botonVolver,
        sobreMarca ? estilos.botonVolverMarca : estilos.botonVolverClaro,
        pressed &&
          (sobreMarca
            ? estilos.botonVolverPresionadoMarca
            : estilos.botonVolverPresionado),
      ]}
    >
      <Chevron
        direccion="izquierda"
        tamano={ESPACIADO.xl - ESPACIADO.xs}
        color={sobreMarca ? COLORES.textoSobreColor : COLORES.texto}
      />
    </Pulsable>
  );
}

/**
 * Segundo renglón del héroe: un panel azul hondo que agrupa el avance, la
 * barra y el estado de envío. Fondo sólido: lleva texto blanco.
 */
export function PanelEncabezado({ children }: { children: ReactNode }) {
  return <View style={estilos.panel}>{children}</View>;
}

const CURVA_AVANCE = Easing.bezier(...CURVA_SALIDA);

/**
 * La barra de avance: una cápsula honda donde lo contado se enciende en azul
 * vivo y crece hasta su nuevo largo en cada captura. Se lee de reojo sin
 * quitarle alto a la lista. Con "Reducir movimiento" salta a su largo sin
 * animar.
 *
 * El ancho se anima en píxeles sobre el canal medido: un ancho en porcentaje
 * animado no se aplicaba en el hilo de UI y el relleno se quedaba midiendo su
 * contenido, siempre el mismo pedacito. La medida va a un valor compartido de
 * Reanimated (hilo de UI), nunca a estado de React.
 *
 * El relleno es color plano, sin degradado: fue el primero de los cuatro bugs
 * del degradado que se medía a sí mismo (ver la regla junto a DEGRADADOS en
 * tokens.ts).
 *
 * Relleno = fraccionAvance(actual, total) × ancho del canal:
 *   0 de 14  → 0    × canal = 0 px: no se ve.
 *   7 de 14  → 0.5  × canal: exactamente la mitad.
 *   14 de 14 → 1    × canal: el extremo derecho.
 */
export function BarraAvance({
  actual,
  total,
}: {
  actual: number;
  total: number;
}) {
  const avance = fraccionAvance(actual, total);
  const reducirMovimiento = useReducedMotion();
  const largo = useSharedValue(avance);
  const anchoCanal = useSharedValue(0);
  useEffect(() => {
    largo.value = reducirMovimiento
      ? avance
      : withTiming(avance, {
          duration: MOVIMIENTO.carril,
          easing: CURVA_AVANCE,
        });
  }, [avance, largo, reducirMovimiento]);
  const estiloRelleno = useAnimatedStyle(() => ({
    width: largo.value * anchoCanal.value,
  }));
  const alMedirCanal = (e: LayoutChangeEvent) => {
    anchoCanal.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      style={estilos.canal}
      onLayout={alMedirCanal}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: actual }}
    >
      <Animated.View style={[estilos.relleno, estiloRelleno]} />
    </View>
  );
}

const ALTO_BARRA = 10;

const ContextoMarca = createContext(false);

/** Si el contenido va dentro del héroe azul: así elige colores que se lean. */
export function useSobreMarca(): boolean {
  return useContext(ContextoMarca);
}

/** Contexto dentro del encabezado: se retira frente al título y al subtítulo. */
export function NotaEncabezado({
  children,
  lineas = 2,
}: {
  children: ReactNode;
  lineas?: number;
}) {
  const sobreMarca = useSobreMarca();
  return (
    <Text
      style={[estilos.nota, sobreMarca && estilos.notaMarca]}
      numberOfLines={lineas}
    >
      {children}
    </Text>
  );
}

const estilos = StyleSheet.create({
  // El héroe: la montura redondeada de abajo se suma a su relleno inferior.
  // El azul noche va EN EL ESTILO: el texto blanco del héroe se lee aunque el
  // degradado (decoración) no llegue a pintarse.
  heroe: {
    backgroundColor: COLORES.marca,
    gap: ESPACIADO.lg,
    paddingHorizontal: RITMO.margen,
    paddingBottom: ALTO_MONTURA + ESPACIADO.md,
    overflow: 'hidden',
  },
  montura: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: ALTO_MONTURA + 1,
    borderTopLeftRadius: RADIOS.encabezado,
    borderTopRightRadius: RADIOS.encabezado,
  },
  plano: {
    gap: ESPACIADO.sm,
  },
  // Arriba, no al centro: con notas de contexto el volver se quedaba flotando a
  // media altura. El título se centra ópticamente con el botón.
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
  },
  // Círculo: la geometría de lo que se toca para moverse.
  botonVolver: {
    width: LADO_VOLVER,
    height: LADO_VOLVER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  botonVolverMarca: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: BORDES.fino,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  botonVolverClaro: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.marcaTinte,
  },
  botonVolverPresionadoMarca: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  titulos: {
    flex: 1,
    gap: 2,
  },
  // La primera línea del título, centrada con el botón de volver.
  titulosConVolver: {
    paddingTop: (LADO_VOLVER - TIPOGRAFIA.titulo.lineHeight) / 2,
  },
  titulosConVolverPlano: {
    paddingTop: (LADO_VOLVER - TIPOGRAFIA.titulo.lineHeight) / 2,
  },
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.textoSobreColor,
  },
  tituloPlano: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  subtitulo: {
    ...TIPOGRAFIA.micro,
    fontSize: 14,
    lineHeight: 20,
    color: COLORES.marcaTenue,
  },
  subtituloPlano: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: TIPOGRAFIA.cuerpo.fontFamily,
    color: COLORES.textoSecundario,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  notaMarca: {
    color: COLORES.marcaTenue,
  },
  // Fondo SÓLIDO, no translúcido: lleva el número blanco del avance ("0 de 9
  // resueltas") y no puede depender de que el degradado pinte detrás. Azul
  // hondo: el más cercano al velo blanco del 8 % sobre el azul noche que tenía.
  panel: {
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    backgroundColor: COLORES.marcaHonda,
    borderRadius: RADIOS.panel,
    borderWidth: BORDES.fino,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  canal: {
    height: ALTO_BARRA,
    borderRadius: RADIOS.completo,
    backgroundColor: 'rgba(6, 18, 51, 0.55)',
    overflow: 'hidden',
  },
  // Azul vivo plano: el color sólido más cercano al degradado azul → cian que tenía.
  relleno: {
    height: '100%',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.accionViva,
  },
});
