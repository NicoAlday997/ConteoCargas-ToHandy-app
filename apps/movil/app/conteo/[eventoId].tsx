import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA, esTipoCarga } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useEventoCarga, useFinalizarSesion, useProductosCarga } from '../../src/api/hooks-cargas';
import { obtenerUsuarioSesion } from '../../src/api/sesion';
import { olvidarCarga } from '../../src/conteo/almacen-conteo';
import { esBorrado, limpiarConteoLocal, type ItemLocal } from '../../src/conteo/almacen-local';
import { conteoDesdeItems, descartarCola, obtenerCola } from '../../src/conteo/cola-sincronizacion';
import {
  admitePaquetes,
  capturaDe,
  estadoFila,
  factorEfectivo,
  fijarCampo,
  fijarCero,
  productosPendientes,
  progreso,
  SIN_CAPTURA,
  type CampoCaptura,
  type CapturaProducto,
  type EstadoConteo,
  type ProductoConteo,
} from '../../src/conteo/estado-conteo';
import { EtiquetaFactor, FilaProducto, type EnvioFila } from '../../src/conteo/FilaProducto';
import { TecladoCantidad } from '../../src/conteo/TecladoCantidad';
import { diaDesdeApi, diaNegocio, esDia, textoSalida } from '../../src/conteo/fecha-operativa';
import { useEstadoSincronizacion, type EstadoSincronizacion } from '../../src/conteo/useEstadoSincronizacion';
import { useLayout } from '../../src/theme/breakpoints';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/** 9999 piezas sueltas o paquetes ya es un error de dedo, no una carga. */
const MAX_DIGITOS = 4;
const ANCHO_TECLADO_LATERAL = 380;
/** Por debajo, dos columnas aprietan los campos más allá del toque mínimo. */
const ANCHO_MINIMO_FILA = 330;
/** Tras cambiar el alto de la lista (se abre el teclado) hay que esperar al layout. */
const RETRASO_SCROLL_MS = 60;

interface Edicion {
  code: string;
  campo: CampoCaptura;
  texto: string;
  reemplazar: boolean;
}

interface SeccionFamilia {
  clave: string;
  titulo: string;
  productos: readonly ProductoConteo[];
  /** Filas visuales: 1 o 2 productos según las columnas. */
  data: ProductoConteo[][];
}

function textoAValor(texto: string): number | null {
  return texto === '' ? null : Number(texto);
}

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

/**
 * Por qué no se puede finalizar aunque todo esté capturado. La comparación de
 * conteos ocurre en el servidor: necesita que TODO haya llegado.
 */
type BloqueoFinalizar = 'sesion-expirada' | 'sin-conexion' | 'rechazados' | 'por-enviar' | 'error' | null;

function bloqueoFinalizar(s: EstadoSincronizacion): BloqueoFinalizar {
  if (s.ultimoError?.tipo === 'sesion-expirada') return 'sesion-expirada';
  if (!s.hayConexion) return 'sin-conexion';
  if (s.fallidos > 0) return 'rechazados';
  if (s.pendientes > 0 || s.sincronizando) return 'por-enviar';
  if (s.ultimoError?.tipo === 'rechazo') return 'error';
  return null;
}

function envioDe(item: ItemLocal | undefined): EnvioFila {
  if (!item || esBorrado(item)) return null;
  if (item.error) return 'rechazado';
  return item.sincronizado ? 'enviado' : 'por-enviar';
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export default function PantallaConteo() {
  const params = useLocalSearchParams<{ eventoId: string; sesionId: string; tipo: string; fechaOperativa: string }>();
  const eventoId = parametro(params.eventoId);
  const sesionId = parametro(params.sesionId);
  const tipo = parametro(params.tipo);
  const fechaOperativa = parametro(params.fechaOperativa);

  if (!eventoId || !sesionId) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="No se encontró la sesión de conteo"
          detalle="Vuelve al inicio y entra otra vez a tu carga."
          textoBoton="Volver al inicio"
          onPress={() => router.replace('/')}
        />
      </SafeAreaView>
    );
  }

  return (
    <Conteo
      eventoId={eventoId}
      sesionId={sesionId}
      tituloCarga={esTipoCarga(tipo) ? ETIQUETAS_TIPO_CARGA[tipo] : 'Carga'}
      fechaOperativa={esDia(fechaOperativa) ? fechaOperativa : null}
    />
  );
}

interface PropsConteo {
  eventoId: string;
  sesionId: string;
  tituloCarga: string;
  /** `aaaa-mm-dd`; si no vino en la navegación (el contador entra desde la cola), se pide al servidor. */
  fechaOperativa: string | null;
}

function Conteo({ eventoId, sesionId, tituloCarga, fechaOperativa: fechaNavegacion }: PropsConteo) {
  const { esTablet, ancho } = useLayout();
  const evento = useEventoCarga(eventoId, fechaNavegacion === null);
  const fechaOperativa = fechaNavegacion ?? diaDesdeApi(evento.data?.evento?.fechaOperativa);
  const consulta = useProductosCarga(eventoId);
  const productos = useMemo(() => consulta.data?.productos ?? [], [consulta.data]);
  const familias = useMemo(() => consulta.data?.familias ?? [], [consulta.data]);

  // Primero lo del dispositivo; la cola reconcilia después con el servidor.
  // Vive fuera de la pantalla: salir al inicio no detiene el envío.
  const cola = useMemo(() => obtenerCola(eventoId, sesionId), [eventoId, sesionId]);
  const estadoCola = useSyncExternalStore(cola.suscribir, cola.obtenerEstado);
  const sincronizacion = useEstadoSincronizacion(cola);
  const bloqueo = bloqueoFinalizar(sincronizacion);

  // `null` mientras se lee la copia local: nada se captura antes de tenerla.
  const conteo = useMemo(
    () => (estadoCola.cargado ? conteoDesdeItems(estadoCola.items) : null),
    [estadoCola.cargado, estadoCola.items],
  );
  const conteoRef = useRef<EstadoConteo | null>(null);
  useEffect(() => {
    conteoRef.current = conteo;
  }, [conteo]);

  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const edicionRef = useRef<Edicion | null>(null);
  const [usuario, setUsuario] = useState<{ id: string; nombre: string | null } | null>(null);
  const [panel, setPanel] = useState<'ninguno' | 'pendientes' | 'bloqueo' | 'confirmar'>('ninguno');

  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente && sesion) setUsuario({ id: sesion.id, nombre: sesion.nombreCompleto });
    });
    return () => {
      vigente = false;
    };
  }, []);

  // Para decir "llevas X de Y" al cerrar sesión, aun sin red.
  useEffect(() => {
    if (estadoCola.cargado && productos.length > 0) cola.fijarTotalProductos(productos.length);
  }, [cola, estadoCola.cargado, productos.length]);

  /** Cada producto que cambió se encola: primero al dispositivo, luego a la red. */
  const aplicar = useCallback(
    (nuevo: EstadoConteo) => {
      const anterior = conteoRef.current;
      if (!anterior || nuevo === anterior) return;
      conteoRef.current = nuevo;
      for (const code of new Set([...Object.keys(anterior), ...Object.keys(nuevo)])) {
        if (anterior[code] !== nuevo[code]) cola.capturar(code, nuevo[code] ?? SIN_CAPTURA);
      }
    },
    [cola],
  );

  const fijarEdicion = useCallback((nueva: Edicion | null) => {
    edicionRef.current = nueva;
    setEdicion(nueva);
  }, []);

  /** Guardado automático al salir de cada campo. */
  const confirmarEdicion = useCallback(() => {
    const actual = edicionRef.current;
    const base = conteoRef.current;
    if (!actual || !base) return;
    aplicar(fijarCampo(base, actual.code, actual.campo, textoAValor(actual.texto)));
  }, [aplicar]);

  const abrirCampo = useCallback(
    (code: string, campo: CampoCaptura) => {
      confirmarEdicion();
      const valor = capturaDe(conteoRef.current ?? {}, code)[campo];
      fijarEdicion({ code, campo, texto: valor === null ? '' : String(valor), reemplazar: true });
    },
    [confirmarEdicion, fijarEdicion],
  );

  const cerrarTeclado = useCallback(() => {
    confirmarEdicion();
    fijarEdicion(null);
  }, [confirmarEdicion, fijarEdicion]);

  const marcarCero = useCallback(
    (code: string) => {
      const producto = productos.find((p) => p.code === code);
      if (!producto) return;
      // Si se tecleaba en esta misma fila el cero gana; si era otra, se guarda lo tecleado.
      if (edicionRef.current?.code !== code) confirmarEdicion();
      fijarEdicion(null);
      const base = conteoRef.current;
      if (base) aplicar(fijarCero(base, producto));
    },
    [aplicar, confirmarEdicion, fijarEdicion, productos],
  );

  const alDigito = useCallback(
    (digito: string) => {
      const actual = edicionRef.current;
      if (!actual) return;
      let texto = actual.reemplazar ? digito : actual.texto + digito;
      if (texto.length > 1) texto = texto.replace(/^0+(?=\d)/, '');
      if (texto.length > MAX_DIGITOS) return;
      fijarEdicion({ ...actual, texto, reemplazar: false });
    },
    [fijarEdicion],
  );

  const alBorrar = useCallback(() => {
    const actual = edicionRef.current;
    if (!actual) return;
    fijarEdicion({ ...actual, texto: actual.reemplazar ? '' : actual.texto.slice(0, -1), reemplazar: false });
  }, [fijarEdicion]);

  /** Paquetes → Sueltas → siguiente producto: el orden del recorrido. */
  const destinoSiguiente = useCallback(
    (actual: Edicion): { code: string; campo: CampoCaptura } | null => {
      if (actual.campo === 'paquetes') return { code: actual.code, campo: 'sueltas' };
      const indice = productos.findIndex((p) => p.code === actual.code);
      const siguiente = productos[indice + 1];
      if (!siguiente) return null;
      return { code: siguiente.code, campo: admitePaquetes(siguiente) ? 'paquetes' : 'sueltas' };
    },
    [productos],
  );

  const alSiguiente = useCallback(() => {
    const actual = edicionRef.current;
    if (!actual) return;
    const destino = destinoSiguiente(actual);
    if (destino) abrirCampo(destino.code, destino.campo);
    else cerrarTeclado();
  }, [abrirCampo, cerrarTeclado, destinoSiguiente]);

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!edicionRef.current) return false;
      cerrarTeclado();
      return true;
    });
    return () => suscripcion.remove();
  }, [cerrarTeclado]);

  // ---- Lista -----------------------------------------------------------

  const anchoLista = esTablet ? ancho - ANCHO_TECLADO_LATERAL : ancho;
  const columnas = esTablet && anchoLista >= ANCHO_MINIMO_FILA * 2 + ESPACIADO.md * 3 ? 2 : 1;

  const secciones = useMemo<SeccionFamilia[]>(
    () =>
      familias.map((f, i) => {
        const data: ProductoConteo[][] = [];
        for (let j = 0; j < f.productos.length; j += columnas) {
          data.push(f.productos.slice(j, j + columnas));
        }
        return { clave: f.familia ?? `sin-familia-${i}`, titulo: f.familia ?? 'Sin familia', productos: f.productos, data };
      }),
    [familias, columnas],
  );

  const ubicaciones = useMemo(() => {
    const mapa = new Map<string, { sectionIndex: number; itemIndex: number }>();
    secciones.forEach((s, sectionIndex) =>
      s.data.forEach((fila, itemIndex) => fila.forEach((p) => mapa.set(p.code, { sectionIndex, itemIndex }))),
    );
    return mapa;
  }, [secciones]);

  const lista = useRef<SectionList<ProductoConteo[], SeccionFamilia>>(null);
  const irAProducto = useCallback(
    (code: string) => {
      const ubicacion = ubicaciones.get(code);
      if (!ubicacion) return;
      setTimeout(() => {
        // itemIndex + 1: en SectionList el índice 0 de cada sección es su encabezado.
        lista.current?.scrollToLocation({ ...ubicacion, itemIndex: ubicacion.itemIndex + 1, viewPosition: 0.4 });
      }, RETRASO_SCROLL_MS);
    },
    [ubicaciones],
  );

  const codeEditado = edicion?.code ?? null;
  useEffect(() => {
    if (codeEditado) irAProducto(codeEditado);
  }, [codeEditado, irAProducto]);

  /** Lo que se ve en la fila: el conteo con lo que se está tecleando encima. */
  const capturaVisible = useCallback(
    (code: string): CapturaProducto => {
      const base = capturaDe(conteo ?? {}, code);
      if (!edicion || edicion.code !== code) return base;
      return { ...base, [edicion.campo]: textoAValor(edicion.texto) };
    },
    [conteo, edicion],
  );

  // ---- Estado general ---------------------------------------------------

  if (consulta.isPending || conteo === null) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <View style={estilos.centrado} accessibilityLabel="Cargando productos" accessibilityState={{ busy: true }}>
          <ActivityIndicator size="large" color={COLORES.texto} />
        </View>
      </SafeAreaView>
    );
  }

  if (consulta.isError) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="No se pudo cargar la lista de productos"
          detalle={
            consulta.error instanceof ErrorRed
              ? 'Sin conexión. La lista de productos se descarga la primera vez que abres la carga; después ya puedes contar sin señal.'
              : consulta.error.message || 'Revisa la conexión y vuelve a intentarlo.'
          }
          textoBoton={consulta.isFetching ? 'Cargando…' : 'Reintentar'}
          onPress={() => void consulta.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (productos.length === 0) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="Esta carga no tiene productos"
          detalle="La plantilla de tu ruta está vacía. Avisa a tu supervisor."
          textoBoton="Volver al inicio"
          onPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const { capturados, total } = progreso(productos, conteo);
  const pendientes = productosPendientes(productos, conteo);
  const productoEditado = edicion ? productos.find((p) => p.code === edicion.code) : undefined;

  const rechazados = productos.filter((p) => estadoCola.items[p.code]?.error);

  const intentarFinalizar = () => {
    cerrarTeclado();
    setPanel(pendientes.length > 0 ? 'pendientes' : bloqueo ? 'bloqueo' : 'confirmar');
  };

  const irAPendiente = (producto: ProductoConteo) => {
    setPanel('ninguno');
    abrirCampo(producto.code, admitePaquetes(producto) ? 'paquetes' : 'sueltas');
  };

  const teclado =
    edicion && productoEditado ? (
      <TecladoCantidad
        producto={productoEditado}
        campo={edicion.campo}
        texto={edicion.texto}
        reemplazar={edicion.reemplazar}
        captura={capturaVisible(edicion.code)}
        etiquetaSiguiente={edicion.campo === 'paquetes' ? 'Sueltas ›' : destinoSiguiente(edicion) ? 'Siguiente ›' : 'Terminar'}
        lateral={esTablet}
        onDigito={alDigito}
        onBorrar={alBorrar}
        onSiguiente={alSiguiente}
        onListo={cerrarTeclado}
      />
    ) : null;

  return (
    <SafeAreaView style={estilos.pantalla}>
      <Encabezado
        titulo={tituloCarga}
        fechaOperativa={fechaOperativa}
        subtitulo={usuario?.nombre ?? null}
        capturados={capturados}
        total={total}
        sincronizacion={sincronizacion}
        bloqueo={bloqueo}
        onReintentar={() => cola.sincronizarAhora()}
        faltan={pendientes.length}
        onFinalizar={intentarFinalizar}
        onVolver={() => {
          cerrarTeclado();
          router.back();
        }}
      />

      <View style={[estilos.cuerpo, esTablet && estilos.cuerpoTablet]}>
        <SectionList<ProductoConteo[], SeccionFamilia>
          ref={lista}
          key={`columnas-${columnas}`}
          style={estilos.lista}
          sections={secciones}
          keyExtractor={(fila) => fila.map((p) => p.code).join('|')}
          extraData={{ conteo, edicion, items: estadoCola.items }}
          stickySectionHeadersEnabled
          initialNumToRender={total}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={estilos.contenidoLista}
          onScrollToIndexFailed={() => {
            if (codeEditado) setTimeout(() => irAProducto(codeEditado), RETRASO_SCROLL_MS * 4);
          }}
          renderSectionHeader={({ section }) => <EncabezadoFamilia seccion={section} conteo={conteo} />}
          renderItem={({ item: fila }) => (
            <View style={estilos.filaColumnas}>
              {fila.map((producto) => (
                <FilaProducto
                  key={producto.code}
                  producto={producto}
                  captura={capturaVisible(producto.code)}
                  campoActivo={edicion?.code === producto.code ? edicion.campo : null}
                  envio={envioDe(estadoCola.items[producto.code])}
                  errorEnvio={estadoCola.items[producto.code]?.error ?? null}
                  onAbrirCampo={abrirCampo}
                  onCero={marcarCero}
                />
              ))}
              {fila.length < columnas && <View style={estilos.huecoColumna} />}
            </View>
          )}
        />

        {esTablet ? (
          <View style={estilos.lateral}>
            {teclado ?? (
              <View style={estilos.lateralVacio}>
                <Text style={estilos.textoLateralVacio}>Toca Paquetes o Sueltas de un producto para capturar.</Text>
                <Text style={estilos.detalleLateralVacio}>Si no lleva, toca su botón 0.</Text>
              </View>
            )}
          </View>
        ) : (
          teclado
        )}
      </View>

      <PanelPendientes
        visible={panel === 'pendientes'}
        pendientes={pendientes}
        onIr={irAPendiente}
        onCerrar={() => setPanel('ninguno')}
      />
      <PanelBloqueo
        visible={panel === 'bloqueo'}
        bloqueo={bloqueo}
        sincronizacion={sincronizacion}
        rechazados={rechazados}
        onReintentar={() => cola.sincronizarAhora()}
        onIr={irAPendiente}
        onContinuar={() => setPanel('confirmar')}
        onCerrar={() => setPanel('ninguno')}
      />
      <PanelConfirmar
        visible={panel === 'confirmar'}
        eventoId={eventoId}
        sesionId={sesionId}
        productos={productos}
        conteo={conteo}
        bloqueo={bloqueo}
        usuarioId={usuario?.id ?? null}
        onCerrar={() => setPanel('ninguno')}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Encabezado fijo
// ---------------------------------------------------------------------------

interface PropsEncabezado {
  titulo: string;
  fechaOperativa: string | null;
  subtitulo: string | null;
  capturados: number;
  total: number;
  sincronizacion: EstadoSincronizacion;
  bloqueo: BloqueoFinalizar;
  onReintentar: () => void;
  faltan: number;
  onFinalizar: () => void;
  onVolver: () => void;
}

function Encabezado({
  titulo,
  fechaOperativa,
  subtitulo,
  capturados,
  total,
  sincronizacion,
  bloqueo,
  onReintentar,
  faltan,
  onFinalizar,
  onVolver,
}: PropsEncabezado) {
  const completo = faltan === 0;
  const listo = completo && bloqueo === null;
  const fraccion = total > 0 ? capturados / total : 0;

  return (
    <View style={estilos.encabezado}>
      <View style={estilos.filaEncabezado}>
        <Pressable
          onPress={onVolver}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio. Lo contado queda guardado."
          hitSlop={ESPACIADO.sm}
          style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
        >
          {({ pressed }) => <Text style={[estilos.textoVolver, pressed && estilos.textoInvertido]}>‹</Text>}
        </Pressable>
        <View style={estilos.titulos}>
          <Text style={estilos.titulo} accessibilityRole="header" numberOfLines={1}>
            {titulo}
          </Text>
          {/* Siempre a la vista: quien cuenta debe saber para qué día es la carga. */}
          {fechaOperativa && (
            <Text style={estilos.fechaOperativa} numberOfLines={2}>
              {textoSalida(fechaOperativa, diaNegocio(new Date()))}
            </Text>
          )}
          {subtitulo && (
            <Text style={estilos.subtitulo} numberOfLines={1}>
              {subtitulo}
            </Text>
          )}
        </View>
        {/* Se ve deshabilitado pero responde: al tocarlo dice CUÁLES faltan, o por qué aún no se puede. */}
        <Pressable
          onPress={onFinalizar}
          accessibilityRole="button"
          accessibilityLabel={
            listo
              ? 'Finalizar conteo'
              : !completo
                ? `Finalizar. Faltan ${faltan} productos`
                : 'Finalizar. Aún no se puede: falta enviar el conteo al servidor'
          }
          accessibilityState={{ disabled: !listo }}
          style={({ pressed }) => [
            estilos.botonFinalizar,
            listo ? estilos.botonFinalizarListo : estilos.botonFinalizarBloqueado,
            pressed && estilos.botonFinalizarPresionado,
          ]}
        >
          <Text style={[estilos.textoFinalizar, listo && estilos.textoInvertido]}>Finalizar</Text>
        </Pressable>
      </View>

      <View style={estilos.filaProgreso}>
        <Text style={estilos.textoProgreso} accessibilityLiveRegion="polite">
          <Text style={estilos.numeroProgreso}>{capturados}</Text> de {total} capturados
        </Text>
        <IndicadorSincronizacion estado={sincronizacion} onReintentar={onReintentar} />
      </View>
      <View
        style={estilos.barra}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: capturados }}
      >
        <View
          style={[
            estilos.rellenoBarra,
            { width: `${fraccion * 100}%` },
            completo && estilos.rellenoBarraCompleto,
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Siempre visible, en una línea junto al progreso: se lee sin buscarlo y no
 * quita espacio a la lista. Con pendientes, tocarlo reintenta sin esperar.
 */
function IndicadorSincronizacion({ estado, onReintentar }: { estado: EstadoSincronizacion; onReintentar: () => void }) {
  const { hayConexion, pendientes, fallidos, sincronizando, ultimoError } = estado;

  if (ultimoError?.tipo === 'sesion-expirada') {
    return (
      <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" hitSlop={ESPACIADO.sm}>
        <Text style={[estilos.guardado, estilos.guardadoError]}>Sesión vencida · entra de nuevo ›</Text>
      </Pressable>
    );
  }

  let texto: string;
  let tono: 'normal' | 'atencion' | 'error' = 'normal';
  if (!hayConexion) {
    texto = pendientes > 0 ? `Sin conexión · ${pendientes} por enviar` : 'Sin conexión · todo enviado';
    tono = 'atencion';
  } else if (fallidos > 0) {
    texto = `${fallidos} ${plural(fallidos, 'rechazado', 'rechazados')} por el servidor`;
    tono = 'error';
  } else if (ultimoError?.tipo === 'rechazo') {
    texto = `No se envió: ${ultimoError.mensaje}`;
    tono = 'error';
  } else if (sincronizando) {
    texto = 'Sincronizando…';
  } else if (pendientes > 0) {
    texto = `${pendientes} por enviar · reintentando`;
    tono = 'atencion';
  } else {
    texto = '✓ Al día';
  }

  const reintentable = hayConexion && !sincronizando && (pendientes > 0 || ultimoError?.tipo === 'rechazo');
  const contenido = (
    <Text
      style={[estilos.guardado, tono === 'atencion' && estilos.guardadoAtencion, tono === 'error' && estilos.guardadoError]}
      numberOfLines={2}
      accessibilityLiveRegion="polite"
    >
      {texto}
      {reintentable ? ' ›' : ''}
    </Text>
  );

  if (!reintentable) return contenido;
  return (
    <Pressable
      onPress={onReintentar}
      accessibilityRole="button"
      accessibilityLabel={`${texto}. Reintentar ahora`}
      hitSlop={ESPACIADO.sm}
      style={estilos.indicadorPresionable}
    >
      {contenido}
    </Pressable>
  );
}

function EncabezadoFamilia({ seccion, conteo }: { seccion: SeccionFamilia; conteo: EstadoConteo }) {
  const { capturados, total } = progreso(seccion.productos, conteo);
  const completa = capturados === total;
  return (
    <View style={estilos.encabezadoFamilia} accessibilityRole="header">
      <Text style={estilos.nombreFamilia} numberOfLines={1}>
        {seccion.titulo}
      </Text>
      <Text style={[estilos.conteoFamilia, completa && estilos.conteoFamiliaCompleta]}>
        {completa ? '✓ ' : ''}
        {capturados} de {total}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Paneles de finalizar
// ---------------------------------------------------------------------------

interface PropsPanelPendientes {
  visible: boolean;
  pendientes: readonly ProductoConteo[];
  onIr: (producto: ProductoConteo) => void;
  onCerrar: () => void;
}

/** Dice CUÁLES faltan, por nombre y con su empaque; tocar uno lleva a él. */
function PanelPendientes({ visible, pendientes, onIr, onCerrar }: PropsPanelPendientes) {
  const porFamilia = useMemo(() => {
    const grupos = new Map<string, ProductoConteo[]>();
    for (const p of pendientes) {
      const clave = p.familia ?? 'Sin familia';
      grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
    }
    return [...grupos.entries()];
  }, [pendientes]);

  const n = pendientes.length;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondoModal}>
        <View style={estilos.modal}>
          <Text style={estilos.tituloModal} accessibilityRole="header">
            {n === 1 ? 'Falta 1 producto' : `Faltan ${n} productos`}
          </Text>
          <Text style={estilos.detalleModal}>Cuéntalos, o márcalos en 0 si no llevan, antes de finalizar.</Text>
          <ScrollView style={estilos.listaModal} contentContainerStyle={estilos.contenidoListaModal}>
            {porFamilia.map(([familia, productos]) => (
              <View key={familia} style={estilos.grupoModal}>
                <Text style={estilos.familiaModal}>{familia}</Text>
                {productos.map((p) => (
                  <Pressable
                    key={p.code}
                    onPress={() => onIr(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ir a ${p.nombre}`}
                    style={({ pressed }) => [estilos.pendiente, pressed && estilos.pendientePresionado]}
                  >
                    <EtiquetaFactor producto={p} />
                    <Text style={estilos.nombrePendiente} numberOfLines={2}>
                      {p.nombre}
                    </Text>
                    <Text style={estilos.flechaPendiente}>›</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={estilos.botonesModal}>
            <BotonModal texto="Seguir contando" onPress={onCerrar} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PropsPanelBloqueo {
  visible: boolean;
  bloqueo: BloqueoFinalizar;
  sincronizacion: EstadoSincronizacion;
  rechazados: readonly ProductoConteo[];
  onReintentar: () => void;
  onIr: (producto: ProductoConteo) => void;
  onContinuar: () => void;
  onCerrar: () => void;
}

/**
 * Todo está capturado pero aún no se puede finalizar. Dice por qué en vez de
 * fallar en silencio, y se actualiza solo: si vuelve la señal y termina el
 * envío, ofrece seguir a finalizar.
 */
function PanelBloqueo({
  visible,
  bloqueo,
  sincronizacion,
  rechazados,
  onReintentar,
  onIr,
  onContinuar,
  onCerrar,
}: PropsPanelBloqueo) {
  const { pendientes, sincronizando, ultimoError } = sincronizacion;
  const porqueServidor =
    'La comparación con el otro conteo ocurre en el servidor y necesita que todo tu conteo haya llegado.';

  let titulo: string;
  let detalle: string;
  let accion: { texto: string; onPress: () => void } | null = null;

  switch (bloqueo) {
    case 'sin-conexion':
      titulo = 'Sin conexión';
      detalle =
        (pendientes > 0
          ? `Tu conteo está guardado en este teléfono, pero ${pendientes} ${plural(pendientes, 'cambio no ha', 'cambios no han')} llegado al servidor. `
          : 'Tu conteo ya está en el servidor, pero finalizar también necesita señal. ') +
        `${porqueServidor} Acércate a donde haya señal: lo pendiente se envía solo.`;
      break;
    case 'por-enviar':
      titulo = pendientes > 0 ? `Faltan ${pendientes} por llegar al servidor` : 'Comprobando con el servidor…';
      detalle = `${porqueServidor} ${sincronizando ? 'Enviando ahora…' : 'Se reintentará solo en unos segundos.'}`;
      if (!sincronizando) accion = { texto: 'Reintentar ahora', onPress: onReintentar };
      break;
    case 'rechazados':
      titulo = `El servidor no aceptó ${rechazados.length} ${plural(rechazados.length, 'producto', 'productos')}`;
      detalle = 'Vuelve a capturarlos (por ejemplo, en piezas sueltas) para poder finalizar. Toca uno para ir a él.';
      break;
    case 'sesion-expirada':
      titulo = 'Tu sesión venció';
      detalle = 'Entra de nuevo con tu PIN: lo contado sigue guardado en este teléfono y se enviará al volver.';
      accion = { texto: 'Entrar', onPress: () => router.replace('/login') };
      break;
    case 'error':
      titulo = 'El servidor no aceptó el conteo';
      detalle = ultimoError?.mensaje ?? 'Intenta de nuevo.';
      accion = { texto: 'Reintentar', onPress: onReintentar };
      break;
    case null:
      titulo = 'Todo llegó al servidor';
      detalle = 'Ya puedes finalizar tu conteo.';
      accion = { texto: 'Continuar', onPress: onContinuar };
      break;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondoModal}>
        <View style={estilos.modal}>
          <Text style={estilos.tituloModal} accessibilityRole="header" accessibilityLiveRegion="polite">
            {titulo}
          </Text>
          <Text style={estilos.detalleModal}>{detalle}</Text>
          {bloqueo === 'rechazados' && (
            <ScrollView style={estilos.listaModal} contentContainerStyle={estilos.contenidoListaModal}>
              {rechazados.map((p) => (
                <Pressable
                  key={p.code}
                  onPress={() => onIr(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ir a ${p.nombre}`}
                  style={({ pressed }) => [estilos.pendiente, pressed && estilos.pendientePresionado]}
                >
                  <EtiquetaFactor producto={p} />
                  <Text style={estilos.nombrePendiente} numberOfLines={2}>
                    {p.nombre}
                  </Text>
                  <Text style={estilos.flechaPendiente}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={estilos.botonesModal}>
            <BotonModal texto="Seguir contando" onPress={onCerrar} />
            {accion && <BotonModal texto={accion.texto} onPress={accion.onPress} principal />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PropsPanelConfirmar {
  visible: boolean;
  eventoId: string;
  sesionId: string;
  productos: readonly ProductoConteo[];
  conteo: EstadoConteo;
  bloqueo: BloqueoFinalizar;
  usuarioId: string | null;
  onCerrar: () => void;
}

function PanelConfirmar({
  visible,
  eventoId,
  sesionId,
  productos,
  conteo,
  bloqueo,
  usuarioId,
  onCerrar,
}: PropsPanelConfirmar) {
  const mutacion = useFinalizarSesion();
  const [fase, setFase] = useState<'confirmando' | 'finalizando'>('confirmando');
  const [error, setError] = useState<string | null>(null);

  const conCantidad = productos.filter((p) => estadoFila(capturaDe(conteo, p.code), factorEfectivo(p)) === 'con-cantidad').length;
  const enCero = productos.filter((p) => estadoFila(capturaDe(conteo, p.code), factorEfectivo(p)) === 'en-cero').length;

  const ocupado = fase !== 'confirmando';
  // Pudo perderse la señal con el panel abierto.
  const puedeFinalizar = bloqueo === null;

  const cerrar = () => {
    if (ocupado) return;
    setError(null);
    onCerrar();
  };

  const finalizar = () => {
    if (!puedeFinalizar) return;
    setError(null);
    setFase('finalizando');
    mutacion.mutate(
      { eventoId, sesionId },
      {
        onSuccess: async (respuesta) => {
          descartarCola(eventoId, sesionId);
          await (usuarioId ? olvidarCarga(usuarioId, { eventoId, sesionId }) : limpiarConteoLocal(eventoId, sesionId)).catch(
            () => undefined,
          );
          setFase('confirmando');
          onCerrar();
          // Fue el segundo conteo y hubo diferencias: resolverlas es lo siguiente,
          // con la otra persona al lado. Se reemplaza el conteo: ya no se puede volver a él.
          if (respuesta?.evento?.estado === 'CONFLICTOS_PENDIENTES') {
            router.replace({ pathname: '/discrepancias/[eventoId]', params: { eventoId } });
            return;
          }
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
        onError: (e) => {
          setFase('confirmando');
          if (e instanceof ErrorApi && e.estado === 401) {
            setError('Tu sesión venció. Entra de nuevo: lo contado sigue guardado en este dispositivo.');
          } else if (e instanceof ErrorRed) {
            setError('Sin conexión: no se pudo finalizar. Tu conteo sigue guardado en este teléfono; inténtalo cuando haya señal.');
          } else {
            setError(e.message || 'No se pudo finalizar el conteo.');
          }
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondoModal}>
        <View style={estilos.modal}>
          <Text style={estilos.tituloModal} accessibilityRole="header">
            ¿Finalizar tu conteo?
          </Text>
          <Text style={estilos.detalleModal}>
            {productos.length} productos revisados: {conCantidad} con cantidad y {enCero} en cero.
          </Text>
          <Text style={estilos.detalleModal}>Después de finalizar ya no podrás cambiarlo.</Text>

          {!puedeFinalizar && !error && (
            <Text style={estilos.errorModal} accessibilityRole="alert">
              {bloqueo === 'sin-conexion'
                ? 'Se perdió la conexión. Para finalizar necesitas señal: la comparación de conteos ocurre en el servidor.'
                : 'Espera a que todo el conteo llegue al servidor.'}
            </Text>
          )}

          {error && (
            <Text style={estilos.errorModal} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <View style={estilos.botonesModal}>
            <BotonModal texto="Seguir contando" onPress={cerrar} deshabilitado={ocupado} />
            <BotonModal
              texto={fase === 'finalizando' ? 'Finalizando…' : 'Finalizar conteo'}
              onPress={finalizar}
              deshabilitado={ocupado || !puedeFinalizar}
              principal
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PropsBotonModal {
  texto: string;
  onPress: () => void;
  deshabilitado?: boolean;
  principal?: boolean;
}

function BotonModal({ texto, onPress, deshabilitado = false, principal = false }: PropsBotonModal) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado, busy: deshabilitado && principal }}
      style={({ pressed }) => [
        estilos.botonModal,
        principal && estilos.botonModalPrincipal,
        pressed && estilos.botonModalPresionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {({ pressed }) => (
        <Text style={[estilos.textoBotonModal, (principal || pressed) && estilos.textoInvertido]}>{texto}</Text>
      )}
    </Pressable>
  );
}

function EstadoCentral({
  titulo,
  detalle,
  textoBoton,
  onPress,
}: {
  titulo: string;
  detalle: string;
  textoBoton: string;
  onPress: () => void;
}) {
  return (
    <View style={estilos.centrado}>
      <Text style={estilos.tituloModal}>{titulo}</Text>
      <Text style={[estilos.detalleModal, estilos.textoCentrado]}>{detalle}</Text>
      <View style={[estilos.botonesModal, estilos.botonCentral]}>
        <BotonModal texto={textoBoton} onPress={onPress} principal />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.xl,
  },
  textoCentrado: {
    textAlign: 'center',
  },
  botonCentral: {
    alignSelf: 'stretch',
    maxWidth: 360,
    marginTop: ESPACIADO.md,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  deshabilitado: {
    opacity: 0.5,
  },

  // Encabezado
  encabezado: {
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORES.texto,
    backgroundColor: COLORES.fondo,
  },
  filaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  botonVolver: {
    width: TOQUE_MINIMO,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -ESPACIADO.sm,
    borderRadius: RADIOS.md,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.texto,
  },
  textoVolver: {
    fontSize: TIPOGRAFIA.tamanos.xxxl,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  titulos: {
    flex: 1,
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  fechaOperativa: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  subtitulo: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  botonFinalizar: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.md,
    borderWidth: 2,
  },
  botonFinalizarListo: {
    backgroundColor: COLORES.capturado,
    borderColor: COLORES.capturado,
  },
  botonFinalizarBloqueado: {
    borderColor: COLORES.borde,
    opacity: 0.5,
  },
  botonFinalizarPresionado: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
    opacity: 1,
  },
  textoFinalizar: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  filaProgreso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
  },
  textoProgreso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.texto,
  },
  numeroProgreso: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    fontVariant: ['tabular-nums'],
  },
  guardado: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  guardadoAtencion: {
    color: COLORES.discrepancia,
    fontWeight: TIPOGRAFIA.pesos.negrita,
  },
  guardadoError: {
    color: COLORES.error,
    fontWeight: TIPOGRAFIA.pesos.negrita,
  },
  indicadorPresionable: {
    flexShrink: 1,
  },
  barra: {
    height: 10,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.completo,
    overflow: 'hidden',
  },
  rellenoBarra: {
    height: '100%',
    backgroundColor: COLORES.texto,
  },
  rellenoBarraCompleto: {
    backgroundColor: COLORES.capturado,
  },

  // Lista
  cuerpo: {
    flex: 1,
  },
  cuerpoTablet: {
    flexDirection: 'row',
  },
  lista: {
    flex: 1,
  },
  contenidoLista: {
    paddingHorizontal: ESPACIADO.md,
    paddingBottom: ESPACIADO.xxxl,
  },
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
    marginHorizontal: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  nombreFamilia: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textTransform: 'uppercase',
  },
  conteoFamilia: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    fontVariant: ['tabular-nums'],
  },
  conteoFamiliaCompleta: {
    color: COLORES.capturado,
  },
  filaColumnas: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
    paddingTop: ESPACIADO.sm,
  },
  huecoColumna: {
    flex: 1,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    borderLeftWidth: 2,
    borderLeftColor: COLORES.texto,
  },
  lateralVacio: {
    flex: 1,
    justifyContent: 'center',
    gap: ESPACIADO.sm,
    padding: ESPACIADO.xl,
  },
  textoLateralVacio: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  detalleLateralVacio: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },

  // Paneles
  fondoModal: {
    flex: 1,
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.lg,
  },
  tituloModal: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  detalleModal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  errorModal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
  },
  listaModal: {
    flexGrow: 0,
  },
  contenidoListaModal: {
    gap: ESPACIADO.md,
  },
  grupoModal: {
    gap: ESPACIADO.xs,
  },
  familiaModal: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  pendiente: {
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.sm,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  pendientePresionado: {
    backgroundColor: COLORES.superficie,
  },
  nombrePendiente: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  flechaPendiente: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    color: COLORES.texto,
  },
  botonesModal: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
  },
  botonModal: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonModalPrincipal: {
    backgroundColor: COLORES.texto,
  },
  botonModalPresionado: {
    backgroundColor: COLORES.textoSecundario,
    borderColor: COLORES.textoSecundario,
  },
  textoBotonModal: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
});
