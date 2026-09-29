import { Children, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../../theme/breakpoints';
import {
  ANCHO_MODAL,
  COLORES,
  CURVA_SALIDA,
  ESPACIADO,
  MOVIMIENTO,
  RADIOS,
  RESORTES,
  RITMO,
  SOMBRAS,
  TIPOGRAFIA,
} from '../../theme/tokens';

const CURVA = Easing.bezier(...CURVA_SALIDA);
const ENTRADA_VELO = FadeIn.duration(MOVIMIENTO.hoja).easing(CURVA);
const ENTRADA_HOJA = SlideInDown.springify()
  .damping(RESORTES.entrada.damping)
  .stiffness(RESORTES.entrada.stiffness)
  .mass(RESORTES.entrada.mass);
const ENTRADA_DIALOGO = FadeInDown.springify()
  .damping(RESORTES.entrada.damping)
  .stiffness(RESORTES.entrada.stiffness * 1.4)
  .mass(RESORTES.entrada.mass);

interface Props {
  visible: boolean;
  /** Atrás del sistema, y tocar fuera si `cerrarAlTocarFondo`. No se llama mientras está `bloqueada`. */
  onCerrar: () => void;
  /** Lo que se decide aquí, en una frase. Se anuncia como encabezado. */
  titulo?: string;
  /** Una línea bajo el título: qué pasa si se confirma. */
  detalle?: string | null;
  /** Mientras se guarda: ni atrás ni el fondo la cierran. */
  bloqueada?: boolean;
  /**
   * Tocar fuera la cierra. Solo en lo que no se pierde nada al cerrar (una
   * lista para ir a un producto); nunca con un formulario a medias.
   */
  cerrarAlTocarFondo?: boolean;
  /** Botones: fijos abajo, siempre al alcance del pulgar aunque el contenido se desplace. */
  pie?: ReactNode;
  /** Pantalla completa del contenido sin desplazamiento propio (listas virtualizadas). */
  sinDesplazamiento?: boolean;
  children?: ReactNode;
  estiloContenido?: StyleProp<ViewStyle>;
}

/**
 * Toda decisión que interrumpe va aquí; una sola forma para toda la app.
 * - Celular: hoja inferior. Sube desde abajo, donde está el pulgar, y deja los
 *   botones a una mano.
 * - Tablet: diálogo centrado de 480 como máximo, que se lee de un vistazo.
 * Entra con un resorte amortiguado (llega firme, sin rebote visible) y, con "Reducir movimiento",
 * aparece sin animar (Reanimated respeta el ajuste del sistema).
 */
export function Hoja({
  visible,
  onCerrar,
  titulo,
  detalle,
  bloqueada = false,
  cerrarAlTocarFondo = false,
  pie,
  sinDesplazamiento = false,
  children,
  estiloContenido,
}: Props) {
  const { esTablet } = useLayout();
  const margenes = useSafeAreaInsets();
  // Android: con barras translúcidas, el Modal dibuja desde arriba pero mide la
  // pantalla sin las barras, y la hoja quedaba flotando sobre una franja de velo.
  // Se le da el alto completo de la pantalla para que llegue al borde.
  const { height: altoPantalla } = useWindowDimensions();
  const altoAndroid = Platform.OS === 'android' ? { flex: 0, height: Dimensions.get('screen').height || altoPantalla } : null;
  const cerrar = () => {
    if (!bloqueada) onCerrar();
  };

  const cabecera =
    titulo || detalle ? (
      <View style={estilos.cabecera}>
        {titulo ? (
          <Text style={estilos.titulo} accessibilityRole="header">
            {titulo}
          </Text>
        ) : null}
        {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      </View>
    ) : null;

  const cuerpo = sinDesplazamiento ? (
    <View style={[estilos.contenido, estilos.contenidoFijo, estiloContenido]}>
      {cabecera}
      {children}
    </View>
  ) : (
    <ScrollView
      style={estilos.desplazable}
      contentContainerStyle={[estilos.contenido, estiloContenido]}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      {cabecera}
      {children}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cerrar}
    >
      {visible && (
        <KeyboardAvoidingView style={[estilos.raiz, altoAndroid]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View entering={ENTRADA_VELO} style={StyleSheet.absoluteFill}>
            <Pressable
              style={estilos.velo}
              onPress={cerrarAlTocarFondo ? cerrar : undefined}
              accessible={cerrarAlTocarFondo}
              accessibilityRole={cerrarAlTocarFondo ? 'button' : undefined}
              accessibilityLabel={cerrarAlTocarFondo ? 'Cerrar' : undefined}
            />
          </Animated.View>
          <View
            style={[
              estilos.colocacion,
              esTablet
                ? [estilos.colocacionDialogo, { paddingTop: margenes.top + RITMO.margen, paddingBottom: margenes.bottom + RITMO.margen }]
                : [estilos.colocacionHoja, { paddingTop: margenes.top + ESPACIADO.xl }],
            ]}
            pointerEvents="box-none"
          >
            <Animated.View
              entering={esTablet ? ENTRADA_DIALOGO : ENTRADA_HOJA}
              style={[esTablet ? estilos.dialogo : estilos.hoja]}
              accessibilityViewIsModal
            >
              {!esTablet && <View style={estilos.tirador} accessibilityElementsHidden importantForAccessibility="no" />}
              {cuerpo}
              {pie ? (
                <View style={[estilos.pie, !esTablet && { paddingBottom: margenes.bottom + RITMO.margen }]}>{pie}</View>
              ) : (
                !esTablet && <View style={{ height: margenes.bottom }} />
              )}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

/**
 * Botones de una hoja, del mismo ancho, lado a lado: la salida a la izquierda
 * y lo esperado a la derecha, donde termina la lectura y descansa el pulgar
 * derecho. `apiladas` para textos largos o una acción destructiva: la salida
 * segura va hasta abajo, la más cercana al pulgar.
 */
export function AccionesHoja({ children, apiladas = false }: { children: ReactNode; apiladas?: boolean }) {
  const hijos = Children.toArray(children).filter(Boolean);
  return (
    <View style={apiladas ? estilos.accionesApiladas : estilos.acciones}>
      {hijos.map((hijo, i) => (
        <View key={i} style={apiladas ? null : estilos.celdaAccion}>
          {hijo}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
  },
  velo: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  colocacion: {
    flex: 1,
  },
  colocacionHoja: {
    justifyContent: 'flex-end',
  },
  colocacionDialogo: {
    justifyContent: 'center',
    paddingHorizontal: RITMO.margen,
  },
  // Hoja inferior: esquinas de arriba redondeadas, pegada abajo; el área segura inferior la pone el pie.
  hoja: {
    width: '100%',
    maxHeight: '100%',
    backgroundColor: COLORES.superficie,
    borderTopLeftRadius: RADIOS.encabezado,
    borderTopRightRadius: RADIOS.encabezado,
    boxShadow: SOMBRAS.panel,
  },
  // El tirador: dice "esto es una hoja" de un vistazo.
  tirador: {
    alignSelf: 'center',
    width: ESPACIADO.xxl + ESPACIADO.sm,
    height: 5,
    marginTop: ESPACIADO.sm + 2,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.bordeNoLleva,
  },
  dialogo: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    maxHeight: '100%',
    alignSelf: 'center',
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.encabezado,
    boxShadow: SOMBRAS.elevada,
  },
  desplazable: {
    flexGrow: 0,
    flexShrink: 1,
  },
  contenido: {
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    paddingTop: ESPACIADO.lg,
    paddingBottom: RITMO.margen,
  },
  contenidoFijo: {
    flexShrink: 1,
  },
  cabecera: {
    gap: ESPACIADO.sm,
    marginBottom: ESPACIADO.xs,
  },
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  // Sin línea: el pie se separa por su propio aire.
  pie: {
    paddingHorizontal: ESPACIADO.xl,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.xl,
  },
  acciones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
  celdaAccion: {
    flex: 1,
  },
  accionesApiladas: {
    gap: RITMO.relacionado,
  },
});
