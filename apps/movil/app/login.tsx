import { useEffect, useRef, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, View } from 'react-native';
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
import {
  BloqueError,
  Chevron,
  Esqueleto,
  EstadoVacio,
  LineaEsqueleto,
  MarcaApp,
  Pulsable,
  SEPARACION_TARJETAS,
  Tarjeta,
} from '../src/componentes/base';
import { IndicadoresPin, LONGITUD_PIN } from '../src/componentes/IndicadoresPin';
import { TecladoPin } from '../src/componentes/TecladoPin';
import { useLayout } from '../src/theme/breakpoints';
import { useBarraEstado } from '../src/theme/barra-estado';
import { sentir } from '../src/theme/tacto';
import { COLORES, ELEVACION, ESPACIADO, ETIQUETA_DATO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

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
  useBarraEstado('light');

  const elegir = (u: UsuarioElegible) => {
    setDireccion('adelante');
    setUsuario(u);
  };

  const volver = () => {
    setDireccion('atras');
    setUsuario(null);
  };

  // Sin bloque azul: la entrada va sobre el fondo de pantalla, con el título grande.
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
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

/**
 * Encabezado de la entrada: la identidad de la app (el camión y su nombre, en
 * tinta, como la placa de una báscula) y la instrucción grande.
 */
function BandaMarca({ titulo }: { titulo: string }) {
  const margenes = useSafeAreaInsets();
  return (
    <View style={[estilos.bandaMarca, { paddingTop: margenes.top + ESPACIADO.lg }]}>
      <View style={estilos.columnaBanda}>
        <View style={estilos.identidad} accessibilityRole="header" accessibilityLabel="Conteo de Cargas">
          <MarcaApp invertida tamano={ESPACIADO.xxl + ESPACIADO.xs} />
          <Text style={estilos.nombreApp}>Conteo de Cargas</Text>
        </View>
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

  const encabezado = <BandaMarca titulo="Selecciona tu nombre" />;

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
        {rol && <Text style={estilos.rolUsuario}>{rol}</Text>}
        <Text style={estilos.nombreUsuario} numberOfLines={2}>
          {nombre}
        </Text>
      </View>
      <Chevron />
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
          sentir('exito');
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
          if (clasificado.tipo === 'pin-incorrecto') {
            sentir('error');
            setClaveError((c) => c + 1);
          }
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
    <View style={[estilos.paso, estilos.pasoPin]}>
      <View style={[estilos.bandaMarca, estilos.bandaPin, { paddingTop: margenes.top + ESPACIADO.sm }]}>
        {/* En tablet, la misma columna que el teclado: nombre y teclas alineados. */}
        <View style={[estilos.columnaBanda, esTablet && estilos.columnaPin]}>
          <Pulsable
            onPress={onVolver}
            accessibilityRole="button"
            accessibilityLabel="Volver y elegir otro usuario"
            style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
          >
            <Chevron direccion="izquierda" color={COLORES.textoSobreColor} />
            <Text style={estilos.textoBotonVolver}>Elegir otro usuario</Text>
          </Pulsable>
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
          <IndicadoresPin cantidad={cantidad} claveError={claveError} oscuro />
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
          <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando} oscuro />
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
        <View accessibilityRole="alert" style={estilos.recuadroError}>
          <Text style={[estilos.tituloAviso, { color: COLORES.errorTexto }]}>PIN incorrecto</Text>
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
        <View accessibilityRole="alert" style={estilos.recuadroError}>
          <Text style={[estilos.tituloAviso, { color: COLORES.errorTexto }]}>No se pudo iniciar sesión</Text>
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
    backgroundColor: COLORES.fondo,
  },
  paso: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  // El letrero de la entrada: asfalto a todo el ancho y a escuadra.
  bandaMarca: {
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xl,
    paddingBottom: ESPACIADO.xl,
    backgroundColor: COLORES.marca,
  },
  bandaPin: {
    paddingBottom: ESPACIADO.sm,
  },
  // El paso del PIN es todo asfalto: la entrada se siente como un tablero.
  pasoPin: {
    backgroundColor: COLORES.marca,
  },
  columnaBanda: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_PIN * 2,
    alignSelf: 'center',
    gap: ESPACIADO.xs,
  },
  // El teclado mide ANCHO_MAXIMO_PIN con su relleno adentro; la banda lo pone afuera.
  columnaPin: {
    maxWidth: ANCHO_MAXIMO_PIN - RITMO.margen * 2,
  },
  identidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    marginBottom: ESPACIADO.xl,
  },
  nombreApp: {
    fontFamily: FUENTE.titular,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORES.textoSobreColor,
  },
  tituloBanda: {
    ...TIPOGRAFIA.display,
    fontSize: 40,
    lineHeight: 44,
    color: COLORES.textoSobreColor,
  },
  subtituloBanda: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.medio,
    color: COLORES.marcaTenue,
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
  // Placa de iniciales: asfalto con letra blanca, como el gafete de un turno.
  avatar: {
    width: TAMANO_AVATAR,
    height: TAMANO_AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.marca,
    borderRadius: RADIOS.medio,
  },
  textoAvatar: {
    fontFamily: FUENTE.extraNegrita,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.5,
    color: COLORES.textoSobreColor,
  },
  datosUsuario: {
    flex: 1,
  },
  // El nombre es lo que se busca: domina la fila.
  nombreUsuario: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  // El rol es su rótulo, arriba y pegado: se retira.
  rolUsuario: ETIQUETA_DATO,
  filaSkeleton: {
    ...ELEVACION[1],
    padding: RITMO.margen,
    borderRadius: RADIOS.grande,
  },
  avatarSkeleton: {
    backgroundColor: COLORES.superficieHonda,
  },

  // Paso 2
  // Indicadores, aviso y teclado juntos abajo, donde está el pulgar: el ojo no
  // viaja de los puntos a las teclas, y el aviso aparece junto al dedo.
  contenidoPin: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: RITMO.margen,
    gap: RITMO.margen,
  },
  // En tablet sobra alto: el bloque va al centro, no pegado al borde.
  contenidoPinTablet: {
    justifyContent: 'center',
    width: '100%',
    maxWidth: ANCHO_MAXIMO_PIN,
    alignSelf: 'center',
  },
  botonVolver: {
    minHeight: TOQUE_MINIMO,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    marginLeft: -ESPACIADO.md,
    borderRadius: RADIOS.medio,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.marcaHonda,
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
    fontFamily: FUENTE.medio,
    color: COLORES.marcaTenue,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    textAlign: 'center',
  },
  detalleAviso: {
    marginTop: ESPACIADO.xs,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
    textAlign: 'center',
  },
  // Un aviso es un bloque tintado de su estado, no texto de color: se lee de
  // reojo. El fondo basta para separarlo: sin contorno.
  recuadroRed: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
    borderWidth: 1,
    borderColor: COLORES.discrepanciaHonda,
  },
  recuadroError: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.errorFondo,
    borderRadius: RADIOS.medio,
    borderWidth: 1,
    borderColor: COLORES.error,
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
    fontFamily: FUENTE.regular,
    color: COLORES.textoSobreColor,
  },
  textoPanelAccion: {
    fontFamily: FUENTE.semiNegrita,
  },
});
