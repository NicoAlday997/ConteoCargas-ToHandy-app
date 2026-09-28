import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  /** Atrás del sistema (Android) y el gesto de cerrar. */
  onCerrar: () => void;
  children: ReactNode;
}

/**
 * Una tarea completa encima de la pantalla actual: elegir productos para una
 * plantilla, modificar una cantidad con su propio teclado. No es una decisión
 * que interrumpe (esas van en `Hoja`): ocupa la pantalla, sube desde abajo y
 * se cierra con su botón de volver. Vive fuera del árbol de la app, así que
 * trae su propio proveedor de márgenes. Las pantallas no usan `Modal` directo.
 */
export function PantallaModal({ visible, onCerrar, children }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCerrar}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </Modal>
  );
}
