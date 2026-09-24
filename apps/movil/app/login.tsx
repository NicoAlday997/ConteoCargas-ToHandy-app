import { useEffect, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { BloqueError, EstadoVacio, Esqueleto, LineaEsqueleto, SEPARACION_TARJETAS, Tarjeta } from '../src/componentes/base';
import { IndicadoresPin, LONGITUD_PIN } from '../src/componentes/IndicadoresPin';
import { TecladoPin } from '../src/componentes/TecladoPin';
import { useLayout } from '../src/theme/breakpoints';
import { COLORES, ELEVACION, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

/** Corto: la transición orienta al usuario, no debe hacerlo esperar. */
const DURACION_TRANSICION_MS = 180;
const FILAS_SKELETON = 6;
const ANCHO_MAXIMO_PIN = 440;
const TAMANO_AVATAR = TOQUE_MINIMO;
/** Cabe el aviso más alto (recuadro de red o PIN con 1 intento) sin mover el teclado. */
const ALTO_ZONA_AVISO = ESPACIADO.xxxl * 2 + ESPACIADO.sm;
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

  // Azul solo detrás de la barra de estado y la banda de marca; lo demás, fondo tintado.
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'left', 'right']}>
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

/** Banda de marca de la entrada: lo primero que se ve al abrir la app. */
function BandaMarca({ antetitulo, titulo }: { antetitulo: string; titulo: string }) {
  return (
    <View style={estilos.bandaMarca}>
      <View style={estilos.columnaBanda}>
        <Text style={estilos.antetitulo}>{antetitulo}</Text>
        <Text style={estilos.tituloBanda} accessibilityRole="header" numberOfLines={2}>
          {titulo}
        </Text>
      </View>
    </View>
  );
}

function PasoUsuarios({ onElegir }: { onElegir: (u: UsuarioElegible) => void }) {
  const { columnas } = useLayout();
  const consulta = useUsuarios();
  const margenes = useSafeAreaInsets();
  const relleno = { paddingBottom: ESPACIADO.xxxl + margenes.bottom };

  const encabezado = <BandaMarca antetitulo="Verificación de cargas" titulo="Selecciona tu nombre" />;

  if (consulta.isPending) {
    return (
      <View style={estilos.paso}>
        {encabezado}
        <View style={[estilos.contenidoLista, relleno]}>
          <SkeletonUsuarios columnas={columnas} />
        </View>
      </View>
    );
  }

  if (consulta.isError) {
    return (
      <View style={estilos.paso}>
        {encabezado}
        <View style={[estilos.contenidoLista, relleno]}>
          <BloqueError
            titulo="No se pudo cargar la lista de usuarios"
            detalle="La lista vive en el servidor. Revisa la conexión del dispositivo y vuelve a intentarlo."
            tono="atencion"
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.paso}>
      {encabezado}
      <FlatList
        // numColumns no puede cambiar en caliente: se remonta al rotar.
        key={`columnas-${columnas}`}
        data={consulta.data}
        keyExtractor={(u) => u.id}
        numColumns={columnas}
        columnWrapperStyle={columnas > 1 ? estilos.filaColumnas : undefined}
        contentContainerStyle={[estilos.contenidoLista, estilos.separacionFilas, relleno]}
        ListEmptyComponent={
          <EstadoVacio
            icono="personas"
            titulo="No hay usuarios activos"
            detalle="Aquí aparecerán los nombres en cuanto un supervisor dé de alta a su equipo. Pídele que registre tu usuario."
            accion={{
              texto: 'Actualizar',
              onPress: () => void consulta.refetch(),
              cargando: consulta.isFetching,
              textoCargando: 'Actualizando…',
            }}
          />
        }
        refreshing={consulta.isRefetching}
        onRefresh={() => void consulta.refetch()}
        renderItem={({ item }) => <FilaUsuario usuario={item} onPress={() => onElegir(item)} />}
      />
    </View>
  );
}

/** Iniciales para el avatar: "María López Ruiz" → "ML". */
function iniciales(nombre: string): string {
  const partes = nombre.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

function FilaUsuario({ usuario, onPress }: { usuario: UsuarioElegible; onPress: () => void }) {
  const nombre = usuario.nombreCompleto?.trim() || 'Usuario sin nombre';
  const rol = usuario.rolApp ? ETIQUETAS_ROL[usuario.rolApp] : null;

  return (
    <Tarjeta
      onPress={onPress}
      compacta
      accessibilityLabel={rol ? `${nombre}, ${rol}` : nombre}
      style={[estilos.filaUsuario, estilos.filaUsuarioContenido]}
    >
      <View style={estilos.avatar}>
        <Text style={estilos.textoAvatar}>{iniciales(nombre)}</Text>
      </View>
      <View style={estilos.datosUsuario}>
        <Text style={estilos.nombreUsuario} numberOfLines={2}>
          {nombre}
        </Text>
        {rol && <Text style={estilos.rolUsuario}>{rol}</Text>}
      </View>
      <Text style={estilos.flecha}>›</Text>
    </Tarjeta>
  );
}

/** Mismo tamaño que una tarjeta de usuario, avatar incluido: al llegar la lista nada salta. */
function SkeletonUsuarios({ columnas }: { columnas: number }) {
  const filas = Array.from({ length: Math.ceil(FILAS_SKELETON / columnas) }, (_, i) => i);
  return (
    <Esqueleto etiqueta="Cargando usuarios" style={estilos.separacionFilas}>
      {filas.map((fila) => (
        <View key={fila} style={estilos.filaColumnas}>
          {Array.from({ length: columnas }, (_, col) => (
            <View key={col} style={[estilos.filaUsuario, estilos.filaUsuarioContenido, estilos.filaSkeleton]}>
              <View style={[estilos.avatar, estilos.avatarSkeleton]} />
              <View style={estilos.datosUsuario}>
                <LineaEsqueleto nivel="titulo" ancho="65%" />
                <LineaEsqueleto nivel="etiqueta" ancho="30%" />
              </View>
            </View>
          ))}
        </View>
      ))}
    </Esqueleto>
  );
}

// ---------------------------------------------------------------------------
// Paso 2: captura del PIN (RF-02, RF-03)
// ---------------------------------------------------------------------------

function PasoPin({ usuario, onVolver }: { usuario: UsuarioElegible; onVolver: () => void }) {
  const { esTablet } = useLayout();
  const margenes = useSafeAreaInsets();
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
    <View style={estilos.paso}>
      <View style={[estilos.bandaMarca, estilos.bandaPin]}>
        <View style={estilos.columnaBanda}>
          <Pressable
            onPress={onVolver}
            accessibilityRole="button"
            accessibilityLabel="Volver y elegir otro usuario"
            style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
          >
            <Text style={estilos.textoBotonVolver}>‹ Elegir otro usuario</Text>
          </Pressable>
          <Text style={estilos.tituloBanda} accessibilityRole="header" numberOfLines={2}>
            {nombre}
          </Text>
          <Text style={estilos.subtituloBanda}>Teclea tu PIN de {LONGITUD_PIN} dígitos</Text>
        </View>
      </View>
      <View
        style={[estilos.contenidoPin, esTablet && estilos.contenidoPinTablet, { paddingBottom: ESPACIADO.lg + margenes.bottom }]}
      >
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
        detalle =
          'Te queda 1 intento antes del bloqueo temporal. Si no recuerdas tu PIN, pide a tu supervisor que lo restablezca.';
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
          <Text style={[estilos.tituloAviso, { color: COLORES.discrepanciaTexto }]}>Sin conexión con el servidor</Text>
          <Text style={estilos.detalleAviso}>Tu PIN no se llegó a revisar. Verifica la conexión y vuelve a teclearlo.</Text>
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
    // Texto de lectura: alineado a la izquierda, aunque el resto del paso vaya centrado.
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
    backgroundColor: COLORES.marca,
  },
  paso: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  bandaMarca: {
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xl,
    paddingBottom: ESPACIADO.xxl,
    backgroundColor: COLORES.marca,
  },
  bandaPin: {
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.xl,
  },
  columnaBanda: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_PIN * 2,
    alignSelf: 'center',
    gap: ESPACIADO.xs,
  },
  antetitulo: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaClaro,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tituloBanda: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSobreColor,
  },
  subtituloBanda: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.medio,
    color: COLORES.marcaClaro,
  },

  // Paso 1
  contenidoLista: {
    flexGrow: 1,
    padding: RITMO.margen,
  },
  separacionFilas: {
    gap: SEPARACION_TARJETAS,
  },
  filaColumnas: {
    flexDirection: 'row',
    gap: SEPARACION_TARJETAS,
  },
  filaUsuario: {
    flex: 1,
    minHeight: TAMANO_AVATAR + ESPACIADO.lg * 2,
    justifyContent: 'center',
  },
  filaUsuarioContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.margen,
  },
  avatar: {
    width: TAMANO_AVATAR,
    height: TAMANO_AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.marcaClaro,
    borderRadius: RADIOS.completo,
  },
  textoAvatar: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
  },
  datosUsuario: {
    flex: 1,
  },
  nombreUsuario: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  // El rol se retira: acompaña al nombre, no compite con él.
  rolUsuario: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  flecha: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.regular,
    color: COLORES.marca,
  },
  filaSkeleton: {
    ...ELEVACION[1],
    padding: RITMO.margen,
    borderRadius: RADIOS.grande,
  },
  avatarSkeleton: {
    backgroundColor: COLORES.superficie,
  },

  // Paso 2
  contenidoPin: {
    flex: 1,
    justifyContent: 'space-between',
    padding: RITMO.margen,
    gap: RITMO.margen,
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
    borderRadius: RADIOS.medio,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.marcaOscuro,
  },
  textoBotonVolver: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSobreColor,
  },
  zonaIndicadores: {
    alignItems: 'center',
    gap: RITMO.margen,
  },
  // Altura reservada: que aparezca un aviso no debe mover el teclado bajo el dedo.
  // Cabe el aviso más alto (recuadro de red o PIN con 1 intento).
  zonaAviso: {
    minHeight: ALTO_ZONA_AVISO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVerificando: {
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
  // El fondo ámbar basta para separarlo: sin contorno.
  recuadroRed: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
  },
  panelBloqueo: {
    gap: RITMO.interno,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.error,
    borderRadius: RADIOS.medio,
  },
  tituloPanelBloqueo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.textoSobreColor,
  },
  textoPanelBloqueo: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.regular,
    color: COLORES.textoSobreColor,
  },
  textoPanelAccion: {
    fontWeight: PESOS.semiNegrita,
  },
});
