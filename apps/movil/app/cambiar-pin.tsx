import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../src/api/cliente';
import { useCambiarPin } from '../src/api/hooks-auth';
import { cerrarSesion, obtenerPinTemporal, olvidarPinTemporal } from '../src/api/sesion';
import { Encabezado } from '../src/componentes/base';
import { IndicadoresPin, LONGITUD_PIN } from '../src/componentes/IndicadoresPin';
import { TecladoPin } from '../src/componentes/TecladoPin';
import { useLayout } from '../src/theme/breakpoints';
import { COLORES, ESPACIADO, PESOS, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

const ANCHO_MAXIMO_PIN = 440;

type Etapa = 'nuevo' | 'confirmar';

interface Aviso {
  titulo: string;
  detalle: string;
  color: string;
}

/**
 * Obligatoria tras alta o restablecimiento (docs/06 §3.1): no se sale de
 * aquí hacia la app sin definir un PIN propio. La única salida es cancelar,
 * que cierra la sesión.
 */
export default function PantallaCambiarPin() {
  const { esTablet } = useLayout();
  const mutacion = useCambiarPin();
  // Se lee una sola vez: es el PIN temporal con el que se acaba de entrar.
  const [pinActual] = useState(obtenerPinTemporal);

  const pinRef = useRef('');
  const pinNuevoRef = useRef('');
  const [etapa, setEtapa] = useState<Etapa>('nuevo');
  const [cantidad, setCantidad] = useState(0);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [claveError, setClaveError] = useState(0);

  const enviando = mutacion.isPending;

  const cancelar = () => {
    void cerrarSesion().then(() => router.replace('/login'));
  };

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelar();
      return true;
    });
    return () => suscripcion.remove();
  });

  // Sin el PIN temporal en memoria (p. ej. la app se reinició) no se puede
  // llamar a /auth/cambiar-pin: se vuelve a entrar con el PIN temporal.
  useEffect(() => {
    if (pinActual === null) void cerrarSesion();
  }, [pinActual]);

  if (pinActual === null) {
    return <Redirect href="/login" />;
  }

  const reiniciar = (nuevoAviso: Aviso, conSacudida: boolean) => {
    pinRef.current = '';
    pinNuevoRef.current = '';
    setCantidad(0);
    setEtapa('nuevo');
    setAviso(nuevoAviso);
    if (conSacudida) setClaveError((c) => c + 1);
  };

  const enviar = (pinNuevo: string) => {
    mutacion.mutate(
      { pinActual, pinNuevo },
      {
        onSuccess: () => {
          olvidarPinTemporal();
          router.replace('/');
        },
        onError: (error) => {
          if (error instanceof ErrorRed) {
            // Se conserva el PIN nuevo: solo hay que volver a confirmarlo.
            pinRef.current = '';
            setCantidad(0);
            setAviso({
              titulo: 'Sin conexión con el servidor',
              detalle: 'Tu PIN no se cambió. Verifica la conexión y vuelve a confirmarlo.',
              color: COLORES.discrepancia,
            });
            return;
          }
          if (error instanceof ErrorApi && error.estado === 401) {
            void cerrarSesion().then(() => router.replace('/login'));
            return;
          }
          reiniciar(
            {
              titulo: 'No se pudo cambiar el PIN',
              detalle: error.message || 'Intenta de nuevo con otro PIN.',
              color: COLORES.error,
            },
            true,
          );
        },
      },
    );
  };

  const alCompletar = (pin: string) => {
    if (etapa === 'nuevo') {
      if (pin === pinActual) {
        reiniciar(
          { titulo: 'Elige un PIN distinto', detalle: 'El PIN nuevo no puede ser igual al temporal.', color: COLORES.error },
          true,
        );
        return;
      }
      pinNuevoRef.current = pin;
      pinRef.current = '';
      setCantidad(0);
      setEtapa('confirmar');
      return;
    }

    if (pin !== pinNuevoRef.current) {
      reiniciar(
        { titulo: 'Los PIN no coinciden', detalle: 'Empieza de nuevo: teclea tu PIN nuevo.', color: COLORES.error },
        true,
      );
      return;
    }
    enviar(pin);
  };

  const alDigito = (digito: string) => {
    if (enviando || pinRef.current.length >= LONGITUD_PIN) return;
    const nuevo = pinRef.current + digito;
    pinRef.current = nuevo;
    setCantidad(nuevo.length);
    setAviso(null);
    if (nuevo.length === LONGITUD_PIN) {
      alCompletar(nuevo);
    }
  };

  const alBorrar = () => {
    if (enviando) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setCantidad(pinRef.current.length);
  };

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={[estilos.contenido, esTablet && estilos.contenidoTablet]}>
        <View>
          <Pressable
            onPress={cancelar}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel="Cancelar y cerrar sesión"
            style={({ pressed }) => [estilos.botonCancelar, pressed && estilos.botonCancelarPresionado]}
          >
            {({ pressed }) => (
              <Text style={[estilos.textoBotonCancelar, pressed && estilos.textoInvertido]}>‹ Cancelar</Text>
            )}
          </Pressable>
          <View style={estilos.titulo}>
            <Encabezado
              titulo={etapa === 'nuevo' ? 'Crea tu PIN nuevo' : 'Confirma tu PIN nuevo'}
              subtitulo={
                etapa === 'nuevo'
                  ? `Tu PIN actual es temporal. Teclea ${LONGITUD_PIN} dígitos que solo tú conozcas.`
                  : 'Teclea el mismo PIN otra vez.'
              }
              variante="plano"
            />
          </View>
        </View>

        <View style={estilos.zonaIndicadores}>
          <IndicadoresPin cantidad={cantidad} claveError={claveError} />
          <View style={estilos.zonaAviso} accessibilityLiveRegion="polite">
            {enviando ? (
              <Text style={estilos.textoGuardando}>Guardando…</Text>
            ) : (
              aviso && (
                <View accessibilityRole="alert">
                  <Text style={[estilos.tituloAviso, { color: aviso.color }]}>{aviso.titulo}</Text>
                  <Text style={estilos.detalleAviso}>{aviso.detalle}</Text>
                </View>
              )
            )}
          </View>
        </View>

        <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando} />
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  contenido: {
    flex: 1,
    justifyContent: 'space-between',
    padding: ESPACIADO.lg,
    gap: ESPACIADO.lg,
  },
  contenidoTablet: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_PIN,
    alignSelf: 'center',
  },
  botonCancelar: {
    minHeight: TOQUE_MINIMO,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    marginLeft: -ESPACIADO.md,
    borderRadius: RADIOS.medio,
  },
  botonCancelarPresionado: {
    backgroundColor: COLORES.texto,
  },
  textoBotonCancelar: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  titulo: {
    marginTop: ESPACIADO.sm,
  },
  zonaIndicadores: {
    alignItems: 'center',
    gap: ESPACIADO.lg,
  },
  zonaAviso: {
    minHeight: TOQUE_MINIMO + ESPACIADO.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoGuardando: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.medio,
    color: COLORES.textoSecundario,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    textAlign: 'center',
  },
  detalleAviso: {
    marginTop: ESPACIADO.xs,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
    textAlign: 'center',
  },
});
