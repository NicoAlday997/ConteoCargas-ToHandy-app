import { useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { sentir, type Tacto } from '../../theme/tacto';
import { RESORTES } from '../../theme/tokens';

/**
 * Evita el doble toque accidental: un segundo toque dentro de esta ventana no
 * dispara otra vez la acción (p. ej. "Finalizar" tocado dos veces con prisa).
 */
const VENTANA_DOBLE_TOQUE_MS = 320;

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children' | 'onPress'> {
  onPress?: (evento: GestureResponderEvent) => void;
  /** Qué se siente al tocar. `null` = nada (el teclado ya da su propio tacto). */
  tacto?: Tacto | null;
  /**
   * Color de la onda de Android. En iOS no hay onda: la respuesta es tonal y la
   * pone el estilo `pressed` de quien lo usa.
   */
  onda?: string;
  /** Deja pasar toques seguidos (teclas de un teclado): sin freno anti doble toque. */
  repetible?: boolean;
  /**
   * Escala a la que se hunde al presionar, con resorte (ESCALA_PRESIONADO…).
   * Sin ella no se mueve: la respuesta es solo tonal.
   */
  escala?: number;
  style?: StyleProp<ViewStyle> | ((estado: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode | ((estado: PressableStateCallbackType) => ReactNode);
}

/**
 * La base de todo lo tocable: Pressable con tacto por plataforma, onda en
 * Android, freno al doble toque y, si se pide, un hundimiento con resorte.
 * Los componentes de la app no usan Pressable directo para que todos
 * respondan igual. Con "Reducir movimiento" el resorte salta sin animar.
 */
export function Pulsable({
  onPress,
  tacto = 'toque',
  onda,
  repetible = false,
  escala,
  disabled,
  style,
  children,
  onPressIn,
  onPressOut,
  ...resto
}: Props) {
  // Por control: tocar otro botón enseguida sí debe responder.
  const ultimoToque = useRef(0);
  const [presionado, setPresionado] = useState(false);
  const tamano = useSharedValue(1);
  const estiloEscala = useAnimatedStyle(() => ({ transform: [{ scale: tamano.value }] }));

  const alTocar = (evento: GestureResponderEvent) => {
    if (!onPress) return;
    if (!repetible) {
      const ahora = Date.now();
      if (ahora - ultimoToque.current < VENTANA_DOBLE_TOQUE_MS) return;
      ultimoToque.current = ahora;
    }
    if (tacto) sentir(tacto);
    onPress(evento);
  };

  const estado = { pressed: presionado };
  const estiloResuelto = typeof style === 'function' ? style(estado) : style;
  const hijos = typeof children === 'function' ? children(estado) : children;

  return (
    <PressableAnimado
      {...resto}
      disabled={disabled}
      onPress={alTocar}
      onPressIn={(evento) => {
        setPresionado(true);
        if (escala !== undefined) tamano.set(withSpring(escala, RESORTES.presion));
        onPressIn?.(evento);
      }}
      onPressOut={(evento) => {
        setPresionado(false);
        if (escala !== undefined) tamano.set(withSpring(1, RESORTES.presion));
        onPressOut?.(evento);
      }}
      android_ripple={Platform.OS === 'android' && onda && !disabled ? { color: onda, foreground: true } : undefined}
      style={escala !== undefined ? [estiloResuelto, estiloEscala] : estiloResuelto}
    >
      {hijos}
    </PressableAnimado>
  );
}
