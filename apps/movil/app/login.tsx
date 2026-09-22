import { useEffect, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ETIQUETAS_ROL } from '../src/api/auth';
import {
  clasificarErrorLogin,
  useLogin,
  useUsuarios,
  type ErrorLogin,
  type UsuarioElegible,
} from '../src/api/hooks-auth';
import { recordarPinTemporal } from '../src/api/sesion';
import { IndicadoresPin, LONGITUD_PIN } from '../src/componentes/IndicadoresPin';
import { TecladoPin } from '../src/componentes/TecladoPin';
import { useLayout } from '../src/theme/breakpoints';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

/** Corto: la transición orienta al usuario, no debe hacerlo esperar. */
const DURACION_TRANSICION_MS = 180;
const FILAS_SKELETON = 6;
const ANCHO_MAXIMO_PIN = 440;
/** Basta para que la cuenta regresiva del bloqueo no se quede atrás un minuto entero. */
const INTERVALO_RELOJ_BLOQUEO_MS = 15_000;

type Direccion = 'inicial' | 'adelante' | 'atras';

export default function PantallaLogin() {
  const [usuario, setUsuario] = useState<UsuarioElegible | null>(null);
  const [direccion, setDireccion] = useState<Direccion>('inicial');

  const elegir = (u: UsuarioElegible) => {
    setDireccion('adelante');
    setUsuario(u);
  };

  const volver = () => {
    setDireccion('atras');
    setUsuario(null);
  };

  return (
    <SafeAreaView style={estilos.pantalla}>
      {usuario ? (
        <Animated.View
          key={`pin-${usuario.id}`}
          style={estilos.paso}
          entering={SlideInRight.duration(DURACION_TRANSICION_MS)}
        >
          <PasoPin usuario={usuario} onVolver={volver} />
        </Animated.View>
      ) : (
        <Animated.View
          key="usuarios"
          style={estilos.paso}
          entering={direccion === 'atras' ? SlideInLeft.duration(DURACION_TRANSICION_MS) : undefined}
        >
          <PasoUsuarios onElegir={elegir} />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Paso 1: selección de usuario (RF-01)
// ---------------------------------------------------------------------------

function PasoUsuarios({ onElegir }: { onElegir: (u: UsuarioElegible) => void }) {
  const { columnas } = useLayout();
  const consulta = useUsuarios();

  const encabezado = (
    <View style={estilos.encabezadoLista}>
      <Text style={estilos.titulo} accessibilityRole="header">
        Selecciona tu nombre
      </Text>
    </View>
  );

  if (consulta.isPending) {
    return (
      <View style={estilos.contenidoLista}>
        {encabezado}
        <SkeletonUsuarios columnas={columnas} />
      </View>
    );
  }

  if (consulta.isError) {
    return (
      <View style={estilos.contenidoLista}>
        {encabezado}
        <EstadoVacio
          titulo="No se pudo cargar la lista de usuarios"
          detalle="Revisa la conexión del dispositivo y vuelve a intentarlo."
          textoBoton="Reintentar"
          cargando={consulta.isFetching}
          onPress={() => void consulta.refetch()}
        />
      </View>
    );
  }

  return (
    <FlatList
      // numColumns no puede cambiar en caliente: se remonta al rotar.
      key={`columnas-${columnas}`}
      data={consulta.data}
      keyExtractor={(u) => u.id}
      numColumns={columnas}
      columnWrapperStyle={columnas > 1 ? estilos.filaColumnas : undefined}
      contentContainerStyle={[estilos.contenidoLista, estilos.separacionFilas]}
      ListHeaderComponent={encabezado}
      ListEmptyComponent={
        <EstadoVacio
          titulo="No hay usuarios activos"
          detalle="Pide a un supervisor que dé de alta tu usuario."
          textoBoton="Actualizar"
          cargando={consulta.isFetching}
          onPress={() => void consulta.refetch()}
        />
      }
      refreshing={consulta.isRefetching}
      onRefresh={() => void consulta.refetch()}
      renderItem={({ item }) => <FilaUsuario usuario={item} onPress={() => onElegir(item)} />}
    />
  );
}

function FilaUsuario({ usuario, onPress }: { usuario: UsuarioElegible; onPress: () => void }) {
  const nombre = usuario.nombreCompleto?.trim() || 'Usuario sin nombre';
  const rol = usuario.rolApp ? ETIQUETAS_ROL[usuario.rolApp] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rol ? `${nombre}, ${rol}` : nombre}
      style={({ pressed }) => [estilos.filaUsuario, pressed && estilos.filaUsuarioPresionada]}
    >
      {({ pressed }) => (
        <>
          <Text style={[estilos.nombreUsuario, pressed && estilos.textoInvertido]} numberOfLines={2}>
            {nombre}
          </Text>
          {rol && <Text style={[estilos.rolUsuario, pressed && estilos.textoInvertido]}>{rol}</Text>}
        </>
      )}
    </Pressable>
  );
}

/** Estático a propósito: la única animación de la pantalla es la de navegación y error. */
function SkeletonUsuarios({ columnas }: { columnas: number }) {
  const filas = Array.from({ length: Math.ceil(FILAS_SKELETON / columnas) }, (_, i) => i);
  return (
    <View
      style={estilos.separacionFilas}
      accessible
      accessibilityLabel="Cargando usuarios"
      accessibilityState={{ busy: true }}
    >
      {filas.map((fila) => (
        <View key={fila} style={estilos.filaColumnas}>
          {Array.from({ length: columnas }, (_, col) => (
            <View key={col} style={[estilos.filaUsuario, estilos.filaSkeleton]}>
              <View style={[estilos.barraSkeleton, estilos.barraNombre]} />
              <View style={[estilos.barraSkeleton, estilos.barraRol]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

interface PropsEstadoVacio {
  titulo: string;
  detalle: string;
  textoBoton: string;
  cargando: boolean;
  onPress: () => void;
}

function EstadoVacio({ titulo, detalle, textoBoton, cargando, onPress }: PropsEstadoVacio) {
  return (
    <View style={estilos.estadoVacio}>
      <Text style={estilos.tituloEstado}>{titulo}</Text>
      <Text style={estilos.detalleEstado}>{detalle}</Text>
      <Pressable
        onPress={onPress}
        disabled={cargando}
        accessibilityRole="button"
        accessibilityState={{ disabled: cargando, busy: cargando }}
        style={({ pressed }) => [
          estilos.botonPrincipal,
          pressed && estilos.botonPrincipalPresionado,
          cargando && estilos.deshabilitado,
        ]}
      >
        <Text style={estilos.textoBotonPrincipal}>{cargando ? 'Cargando…' : textoBoton}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Paso 2: captura del PIN (RF-02, RF-03)
// ---------------------------------------------------------------------------

function PasoPin({ usuario, onVolver }: { usuario: UsuarioElegible; onVolver: () => void }) {
  const { esTablet } = useLayout();
  const mutacionLogin = useLogin();

  // Ref además del estado: dos toques muy rápidos no deben leer un PIN viejo.
  const pinRef = useRef('');
  const [cantidad, setCantidad] = useState(0);
  const [aviso, setAviso] = useState<ErrorLogin | null>(null);
  const [claveError, setClaveError] = useState(0);

  const enviando = mutacionLogin.isPending;
  const bloqueado = aviso?.tipo === 'bloqueado' || aviso?.tipo === 'inactivo';
  const minutosBloqueo = useMinutosRestantes(aviso?.tipo === 'bloqueado' ? aviso.bloqueadoHasta : null);

  // Al vencer el bloqueo se libera el teclado sin obligar a volver a la lista.
  useEffect(() => {
    if (aviso?.tipo === 'bloqueado' && minutosBloqueo === 0) setAviso(null);
  }, [aviso, minutosBloqueo]);

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      onVolver();
      return true;
    });
    return () => suscripcion.remove();
  }, [onVolver]);

  const limpiarPin = () => {
    pinRef.current = '';
    setCantidad(0);
  };

  const enviar = (pin: string) => {
    mutacionLogin.mutate(
      { usuarioAppId: usuario.id, pin },
      {
        onSuccess: (respuesta) => {
          limpiarPin();
          if (respuesta.debeCambiarPin === true) {
            recordarPinTemporal(pin);
            router.replace('/cambiar-pin');
          } else {
            router.replace('/');
          }
        },
        onError: (error) => {
          limpiarPin();
          const clasificado = clasificarErrorLogin(error);
          // Solo un PIN rechazado sacude los indicadores; la red no es culpa del PIN.
          if (clasificado.tipo === 'pin-incorrecto') setClaveError((c) => c + 1);
          setAviso(clasificado);
        },
      },
    );
  };

  const alDigito = (digito: string) => {
    if (enviando || bloqueado || pinRef.current.length >= LONGITUD_PIN) return;
    const nuevo = pinRef.current + digito;
    pinRef.current = nuevo;
    setCantidad(nuevo.length);
    setAviso(null);
    if (nuevo.length === LONGITUD_PIN) {
      enviar(nuevo);
    }
  };

  const alBorrar = () => {
    if (enviando || bloqueado) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setCantidad(pinRef.current.length);
  };

  const nombre = usuario.nombreCompleto?.trim() || 'Usuario sin nombre';

  return (
    <View style={[estilos.contenidoPin, esTablet && estilos.contenidoPinTablet]}>
      <View>
        <Pressable
          onPress={onVolver}
          accessibilityRole="button"
          accessibilityLabel="Volver y elegir otro usuario"
          style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
        >
          {({ pressed }) => (
            <Text style={[estilos.textoBotonVolver, pressed && estilos.textoInvertido]}>‹ Elegir otro usuario</Text>
          )}
        </Pressable>
        <Text style={estilos.nombreSeleccionado} accessibilityRole="header" numberOfLines={2}>
          {nombre}
        </Text>
        <Text style={estilos.instruccion}>Teclea tu PIN de {LONGITUD_PIN} dígitos</Text>
      </View>

      <View style={estilos.zonaIndicadores}>
        <IndicadoresPin cantidad={cantidad} claveError={claveError} />
        <View style={estilos.zonaAviso} accessibilityLiveRegion="polite">
          {enviando ? (
            <Text style={estilos.textoVerificando}>Verificando…</Text>
          ) : (
            aviso && !bloqueado && <AvisoPin aviso={aviso} />
          )}
        </View>
      </View>

      {aviso?.tipo === 'bloqueado' || aviso?.tipo === 'inactivo' ? (
        // El panel ocupa el lugar del teclado: no hay nada que teclear hasta resolverlo.
        <PanelBloqueo aviso={aviso} minutos={minutosBloqueo} />
      ) : (
        <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando} />
      )}
    </View>
  );
}

/** Minutos que faltan (redondeo hacia arriba) hasta `hasta`; 0 si ya pasó, null si no hay fecha. */
function useMinutosRestantes(hasta: Date | null): number | null {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!hasta) return;
    setAhora(Date.now());
    const intervalo = setInterval(() => setAhora(Date.now()), INTERVALO_RELOJ_BLOQUEO_MS);
    return () => clearInterval(intervalo);
  }, [hasta]);

  if (!hasta) return null;
  return Math.max(0, Math.ceil((hasta.getTime() - ahora) / 60_000));
}

/** Hora local HH:MM sin depender de Intl (Hermes no siempre lo trae completo). */
function formatearHora(fecha: Date): string {
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
}

/**
 * Aviso bajo los indicadores. PIN y red se ven distintos a propósito (no solo
 * por color): el PIN es texto rojo; la red, un recuadro ámbar, porque el PIN
 * ni siquiera se revisó.
 */
function AvisoPin({ aviso }: { aviso: Exclude<ErrorLogin, { tipo: 'bloqueado' } | { tipo: 'inactivo' }> }) {
  switch (aviso.tipo) {
    case 'pin-incorrecto': {
      const n = aviso.intentosRestantes;
      let detalle = 'Revisa los dígitos y vuelve a teclearlo.';
      if (n === 1) {
        detalle = 'Te queda 1 intento antes del bloqueo temporal. Si no recuerdas tu PIN, pide a tu supervisor que lo restablezca.';
      } else if (n !== null) {
        detalle = `Te quedan ${n} intentos antes del bloqueo temporal.`;
      }
      return (
        <View accessibilityRole="alert">
          <Text style={[estilos.tituloAviso, { color: COLORES.error }]}>PIN incorrecto</Text>
          <Text style={estilos.detalleAviso}>{detalle}</Text>
        </View>
      );
    }
    case 'red':
      return (
        <View accessibilityRole="alert" style={estilos.recuadroRed}>
          <Text style={[estilos.tituloAviso, { color: COLORES.discrepancia }]}>Sin conexión con el servidor</Text>
          <Text style={estilos.detalleAviso}>
            Tu PIN no se llegó a revisar. Verifica la conexión y vuelve a teclearlo.
          </Text>
        </View>
      );
    case 'otro':
      return (
        <View accessibilityRole="alert">
          <Text style={[estilos.tituloAviso, { color: COLORES.error }]}>No se pudo iniciar sesión</Text>
          <Text style={estilos.detalleAviso}>{aviso.mensaje}</Text>
        </View>
      );
  }
}

interface PropsPanelBloqueo {
  aviso: Extract<ErrorLogin, { tipo: 'bloqueado' } | { tipo: 'inactivo' }>;
  minutos: number | null;
}

function PanelBloqueo({ aviso, minutos }: PropsPanelBloqueo) {
  let titulo = 'Usuario desactivado';
  let cuando: string | null = null;
  let queHacer = 'Pide a tu supervisor que reactive tu usuario.';

  if (aviso.tipo === 'bloqueado') {
    titulo = 'Usuario bloqueado temporalmente';
    queHacer = 'Si necesitas entrar antes, pide a tu supervisor que restablezca tu PIN.';
    if (aviso.bloqueadoHasta && minutos !== null) {
      const cuanto = minutos === 1 ? '1 minuto' : `${minutos} minutos`;
      cuando = `Se desbloquea en ${cuanto} (a las ${formatearHora(aviso.bloqueadoHasta)}).`;
    } else {
      cuando = 'Se desbloquea en unos minutos.';
    }
  }

  return (
    <View style={estilos.panelBloqueo} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={estilos.tituloPanelBloqueo}>{titulo}</Text>
      {cuando && <Text style={estilos.textoPanelBloqueo}>{cuando}</Text>}
      <Text style={[estilos.textoPanelBloqueo, estilos.textoPanelAccion]}>{queHacer}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  paso: {
    flex: 1,
  },

  // Paso 1
  contenidoLista: {
    flexGrow: 1,
    padding: ESPACIADO.lg,
  },
  encabezadoLista: {
    paddingVertical: ESPACIADO.lg,
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  separacionFilas: {
    gap: ESPACIADO.md,
  },
  filaColumnas: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
  },
  filaUsuario: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingVertical: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.lg,
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
  },
  filaUsuarioPresionada: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  nombreUsuario: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  rolUsuario: {
    marginTop: ESPACIADO.xs,
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  filaSkeleton: {
    gap: ESPACIADO.sm,
    minHeight: TOQUE_MINIMO + ESPACIADO.lg,
  },
  barraSkeleton: {
    borderRadius: RADIOS.sm,
    backgroundColor: COLORES.borde,
    opacity: 0.35,
  },
  barraNombre: {
    height: TIPOGRAFIA.tamanos.xl,
    width: '65%',
  },
  barraRol: {
    height: TIPOGRAFIA.tamanos.sm,
    width: '30%',
  },
  estadoVacio: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.md,
    paddingVertical: ESPACIADO.xxxl,
  },
  tituloEstado: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  detalleEstado: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
  botonPrincipal: {
    minHeight: TOQUE_MINIMO,
    minWidth: 200,
    marginTop: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPrincipalPresionado: {
    backgroundColor: COLORES.textoSecundario,
  },
  textoBotonPrincipal: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSobreColor,
  },
  deshabilitado: {
    opacity: 0.5,
  },

  // Paso 2
  contenidoPin: {
    flex: 1,
    justifyContent: 'space-between',
    padding: ESPACIADO.lg,
    gap: ESPACIADO.lg,
  },
  contenidoPinTablet: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_PIN,
    alignSelf: 'center',
  },
  botonVolver: {
    minHeight: TOQUE_MINIMO,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    marginLeft: -ESPACIADO.md,
    borderRadius: RADIOS.md,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.texto,
  },
  textoBotonVolver: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  nombreSeleccionado: {
    marginTop: ESPACIADO.sm,
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  instruccion: {
    marginTop: ESPACIADO.xs,
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
  },
  zonaIndicadores: {
    alignItems: 'center',
    gap: ESPACIADO.lg,
  },
  // Altura reservada: que aparezca un aviso no debe mover el teclado bajo el dedo.
  // Cabe el aviso más alto (recuadro de red o PIN con 1 intento).
  zonaAviso: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVerificando: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  tituloAviso: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    textAlign: 'center',
  },
  detalleAviso: {
    marginTop: ESPACIADO.xs,
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
    textAlign: 'center',
  },
  recuadroRed: {
    paddingVertical: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
    borderRadius: RADIOS.md,
  },
  panelBloqueo: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.error,
    borderRadius: RADIOS.md,
  },
  tituloPanelBloqueo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSobreColor,
    textAlign: 'center',
  },
  textoPanelBloqueo: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    color: COLORES.textoSobreColor,
    textAlign: 'center',
  },
  textoPanelAccion: {
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
  },
});
