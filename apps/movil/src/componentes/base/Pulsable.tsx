import { useRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { sentir, type Tacto } from '../../theme/tacto';

/**
 * Evita el doble toque accidental: un segundo toque dentro de esta ventana no
 * dispara otra vez la acción (p. ej. "Finalizar" tocado dos veces con prisa).
 */
const VENTANA_DOBLE_TOQUE_MS = 320;

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
  style?: StyleProp<ViewStyle> | ((estado: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode | ((estado: PressableStateCallbackType) => ReactNode);
}

/**
 * La base de todo lo tocable: Pressable con tacto por plataforma, onda en
 * Android y freno al doble toque. Los componentes de la app no usan Pressable
 * directo para que todos respondan igual.
 */
export function Pulsable({ onPress, tacto = 'toque', onda, repetible = false, disabled, ...resto }: Props) {
  // Por control: tocar otro botón enseguida sí debe responder.
  const ultimoToque = useRef(0);
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

  return (
    <Pressable
      {...resto}
      disabled={disabled}
      onPress={alTocar}
      android_ripple={Platform.OS === 'android' && onda && !disabled ? { color: onda, foreground: true } : undefined}
    />
  );
}
