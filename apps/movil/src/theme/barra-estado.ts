import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';

/**
 * El color de la barra de estado según lo que tiene debajo: claro sobre un
 * encabezado de asfalto, oscuro sobre el concreto. Se aplica al enfocar la
 * pantalla, así al volver de una pantalla de asfalto a una clara (o al revés)
 * la hora y la batería se siguen leyendo. `null` no toca nada (un modal).
 */
export function useBarraEstado(estilo: 'light' | 'dark' | null) {
  useFocusEffect(
    useCallback(() => {
      if (estilo) setStatusBarStyle(estilo, true);
    }, [estilo]),
  );
}
