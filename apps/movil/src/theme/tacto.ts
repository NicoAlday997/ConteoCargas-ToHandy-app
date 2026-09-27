import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Respuesta táctil. Se siente en la mano aunque la vista esté en las cajas.
 * Cada plataforma con su lenguaje: en Android, las constantes del sistema
 * (respetan el ajuste de "respuesta táctil" del teléfono); en iOS, los
 * generadores de impacto y notificación.
 *
 * Nunca falla: un teléfono sin motor de vibración simplemente no vibra.
 */
export type Tacto = 'tecla' | 'toque' | 'seleccion' | 'exito' | 'aviso' | 'error';

const ANDROID: Record<Tacto, Haptics.AndroidHaptics> = {
  tecla: Haptics.AndroidHaptics.Keyboard_Tap,
  toque: Haptics.AndroidHaptics.Virtual_Key,
  seleccion: Haptics.AndroidHaptics.Segment_Tick,
  exito: Haptics.AndroidHaptics.Confirm,
  aviso: Haptics.AndroidHaptics.Reject,
  error: Haptics.AndroidHaptics.Reject,
};

function ios(tipo: Tacto): Promise<void> {
  switch (tipo) {
    case 'tecla':
    case 'toque':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'seleccion':
      return Haptics.selectionAsync();
    case 'exito':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'aviso':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

export function sentir(tipo: Tacto): void {
  if (Platform.OS === 'web') return;
  const promesa = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(ANDROID[tipo]) : ios(tipo);
  promesa.catch(() => undefined);
}
