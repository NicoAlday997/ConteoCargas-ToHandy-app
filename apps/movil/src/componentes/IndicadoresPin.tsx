import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BORDES, COLORES, ESPACIADO, RADIOS, RESORTES } from '../theme/tokens';

export const LONGITUD_PIN = 4;

const LADO_CIRCULO = 18;
/** El círculo que sigue se marca con un anillo un poco más grande: ahí cae el próximo dígito. */
const ESCALA_ACTIVO = 1.18;
const DESPLAZAMIENTO_SACUDIDA = 10;
const DURACION_TRAMO_MS = 50;
/** Cuánto se queda en rojo tras un PIN incorrecto: lo que dura la sacudida y un respiro. */
const DURACION_ERROR_MS = 700;

interface Props {
  cantidad: number;
  /** Cambia de valor cada vez que hay un error de PIN; dispara la sacudida y el rojo. */
  claveError: number;
  /** El PIN se aceptó: los círculos se llenan de verde antes de salir. */
  exito?: boolean;
  /** Sobre el héroe azul noche (la entrada). */
  oscuro?: boolean;
}

type EstadoCirculo = 'vacio' | 'activo' | 'lleno' | 'error' | 'exito';

/**
 * Cuatro círculos que se llenan conforme se teclea, sin mostrar dígitos (el
 * dispositivo es compartido). Cada estado tiene forma además de color:
 * - vacío: solo el contorno;
 * - activo (el que sigue): contorno grueso y un poco más grande;
 * - lleno: sólido, entra con un resorte corto;
 * - error: contorno rojo y la fila se sacude (se percibe sin leer el mensaje);
 * - éxito: sólidos en verde.
 */
export function IndicadoresPin({ cantidad, claveError, exito = false, oscuro = false }: Props) {
  const desplazamiento = useSharedValue(0);
  // El último error que ya se dejó de mostrar. Mientras `claveError` sea más
  // nuevo (y no se haya vuelto a teclear), los círculos van en rojo.
  const [errorVisto, setErrorVisto] = useState(claveError);
  const enError = claveError !== errorVisto && cantidad === 0;

  useEffect(() => {
    if (claveError === 0) return;
    desplazamiento.set(withSequence(
      withTiming(-DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(-DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(DESPLAZAMIENTO_SACUDIDA, { duration: DURACION_TRAMO_MS }),
      withTiming(0, { duration: DURACION_TRAMO_MS }),
    ));
    const t = setTimeout(() => setErrorVisto(claveError), DURACION_ERROR_MS);
    return () => clearTimeout(t);
  }, [claveError, desplazamiento]);

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ translateX: desplazamiento.value }],
  }));

  const estadoDe = (i: number): EstadoCirculo => {
    if (exito) return 'exito';
    if (enError) return 'error';
    if (i < cantidad) return 'lleno';
    if (i === cantidad) return 'activo';
    return 'vacio';
  };

  return (
    <Animated.View
      style={[estilos.fila, estiloAnimado]}
      accessible
      accessibilityLabel={`${cantidad} de ${LONGITUD_PIN} dígitos ingresados`}
    >
      {Array.from({ length: LONGITUD_PIN }, (_, i) => (
        <Circulo key={i} estado={estadoDe(i)} oscuro={oscuro} />
      ))}
    </Animated.View>
  );
}

function Circulo({ estado, oscuro }: { estado: EstadoCirculo; oscuro: boolean }) {
  const escala = useSharedValue(1);
  const relleno = useSharedValue(0);
  const solido = estado === 'lleno' || estado === 'exito';

  useEffect(() => {
    escala.set(withSpring(estado === 'activo' ? ESCALA_ACTIVO : 1, RESORTES.seleccion));
    relleno.set(solido ? withSpring(1, RESORTES.seleccion) : withTiming(0, { duration: 120 }));
  }, [estado, solido, escala, relleno]);

  const estiloAro = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  const estiloRelleno = useAnimatedStyle(() => ({ transform: [{ scale: relleno.value }], opacity: relleno.value }));

  const paleta = oscuro ? OSCURO : CLARO;
  const colorAro =
    estado === 'error' ? COLORES.error : estado === 'exito' ? COLORES.capturado : estado === 'vacio' ? paleta.vacio : paleta.activo;
  const colorRelleno = estado === 'exito' ? COLORES.capturado : paleta.lleno;

  return (
    <Animated.View
      style={[
        estilos.circulo,
        { borderColor: colorAro, borderWidth: estado === 'activo' || estado === 'error' ? BORDES.medio + 0.5 : BORDES.medio },
        estado === 'error' && { backgroundColor: oscuro ? 'rgba(209, 42, 60, 0.22)' : COLORES.errorFondo },
        estiloAro,
      ]}
    >
      <Animated.View style={[estilos.relleno, { backgroundColor: colorRelleno }, estiloRelleno]} />
    </Animated.View>
  );
}

/** Sobre el héroe: vacío en azul tenue, activo y lleno en blanco. */
const OSCURO = { vacio: 'rgba(175, 196, 240, 0.55)', activo: COLORES.textoSobreColor, lleno: COLORES.textoSobreColor };
/** Sobre claro (una hoja): vacío en contorno, activo y lleno en azul señal. */
const CLARO = { vacio: COLORES.borde, activo: COLORES.accion, lleno: COLORES.accion };

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: ESPACIADO.lg + ESPACIADO.xs,
    minHeight: LADO_CIRCULO * ESCALA_ACTIVO + ESPACIADO.sm,
  },
  circulo: {
    width: LADO_CIRCULO,
    height: LADO_CIRCULO,
    borderRadius: RADIOS.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El relleno ocupa todo el círculo (bajo el contorno): lleno se lee como sólido.
  relleno: {
    width: LADO_CIRCULO,
    height: LADO_CIRCULO,
    borderRadius: RADIOS.completo,
  },
});
