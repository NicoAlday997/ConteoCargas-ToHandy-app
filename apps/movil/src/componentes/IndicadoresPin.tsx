import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { BORDES, COLORES, ESPACIADO, RADIOS } from '../theme/tokens';

export const LONGITUD_PIN = 4;

const TAMANO_INDICADOR = 20;
const DESPLAZAMIENTO_SACUDIDA = 10;
const DURACION_TRAMO_MS = 50;

interface Props {
  cantidad: number;
  /** Cambia de valor cada vez que hay un error de PIN; dispara la sacudida. */
  claveError: number;
}

/**
 * Cuatro círculos que se llenan conforme se teclea, sin mostrar dígitos
 * (el dispositivo es compartido). La sacudida es la única señal animada del
 * error: se percibe aunque no se esté leyendo el mensaje.
 */
export function IndicadoresPin({ cantidad, claveError }: Props) {
  const desplazamiento = useSharedValue(0);

  useEffect(() => {
    if (claveError === 0) return;
    desplazamiento.value = withSequence(
      withTiming(-DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(-DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(0, { duration: DURACION_TRAMO_MS }),
    );
  }, [claveError, desplazamiento]);

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ translateX: desplazamiento.value }],
  }));

  return (
    <Animated.View
      style={[estilos.fila, estiloAnimado]}
      accessible
      accessibilityLabel={`${cantidad} de ${LONGITUD_PIN} dígitos ingresados`}
    >
      {Array.from({ length: LONGITUD_PIN }, (_, i) => (
        <View key={i} style={[estilos.indicador, i < cantidad && estilos.indicadorLleno]} />
      ))}
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ESPACIADO.xl,
  },
  indicador: {
    width: TAMANO_INDICADOR,
    height: TAMANO_INDICADOR,
    borderRadius: RADIOS.completo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.marca,
  },
  indicadorLleno: {
    backgroundColor: COLORES.marca,
  },
});
