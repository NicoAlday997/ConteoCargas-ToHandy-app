import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, SectionList, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA, esTipoCarga, type TipoCarga } from '../../src/api/cargas';
import { ETIQUETAS_ROL } from '../../src/api/auth';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useContextoResolucion, useEventoCarga, useFinalizarSesion, useProductosCarga } from '../../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion } from '../../src/api/sesion';
import {
  AccionesHoja,
  BarraAccion,
  BarraAvance,
  BloqueError,
  BloqueEsqueleto,
  Boton,
  Chevron,
  EscudoRuta,
  Encabezado as EncabezadoBase,
  EstadoVacio,
  Esqueleto,
  Glifo,
  Hoja,
  Lapiz,
  LineaEsqueleto,
  Palomita,
  numeroRuta,
  PanelEncabezado,
  Pulsable,
} from '../../src/componentes/base';
import { avisarConteoFinalizado } from '../../src/conteo/aviso-finalizado';
import { actualizarFechaCargaAbierta, olvidarCarga } from '../../src/conteo/almacen-conteo';
import { ModalCambiarFecha } from '../../src/conteo/CambiarFechaCarga';
import { avisarCargaNoDisponible, descartarCargaNoDisponible } from '../../src/conteo/carga-no-disponible';
import { esBorrado, limpiarConteoLocal, type ItemLocal } from '../../src/conteo/almacen-local';
import { conteoDesdeItems, descartarCola, obtenerCola } from '../../src/conteo/cola-sincronizacion';
import {
  admiteSueltas,
  camposDe,
  capturaDe,
  estadoFila,
  fijarCampo,
  fijarCero,
  productosPendientes,
  primerCampo,
  progreso,
  SIN_CAPTURA,
  type CampoCaptura,
  type CapturaProducto,
  type EstadoConteo,
  type ProductoConteo,
} from '../../src/conteo/estado-conteo';
import { EtiquetaFactor, FilaProducto, type EnvioFila } from '../../src/conteo/FilaProducto';
import { formatearNombreFamilia, formatearNombreProducto } from '../../src/conteo/formato-nombre';
import { TecladoCantidad, type UbicacionProducto } from '../../src/conteo/TecladoCantidad';
import { diaDesdeApi, diaNegocio, esDia, textoSalidaCorta } from '../../src/conteo/fecha-operativa';
import { useEstadoSincronizacion, type EstadoSincronizacion } from '../../src/conteo/useEstadoSincronizacion';
import { useLayout } from '../../src/theme/breakpoints';
import { TONOS_COLOR_FAMILIA, type ColorFamilia } from '../../src/theme/colores-familia';
import { sentir } from '../../src/theme/tacto';
import {
  ALTO_CONTROL,
  ANCHO_MAXIMO_LISTA,
  ANCHO_MODAL,
  CIFRAS,
  COLORES,
  ESCALA_PRESIONADO,
  ESCALA_TEXTO,
  ESPACIADO,
  FAMILIA,
  ETIQUETA_DATO,
  FUENTE,
  MOVIMIENTO,
  RADIOS,
  RITMO,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
  ONDA,
} from '../../src/theme/tokens';

/** 9999 piezas sueltas o paquetes ya es un error de dedo, no una carga. */
const MAX_DIGITOS = 4;
const ANCHO_TECLADO_LATERAL = 380;
/** Por debajo, dos columnas aprietan los campos más allá del toque mínimo. */
const ANCHO_MINIMO_FILA = 330;
/** Tras cambiar el alto de la lista (se abre el teclado) hay que esperar al layout. */
const RETRASO_SCROLL_MS = 60;
/** Aire entre el renglón que se captura y el borde del panel lateral: que no lo roce su sombra. */
const HOLGURA_SOBRE_HOJA = ESPACIADO.sm;
/**
 * Entre productos: el triple del aire que hay dentro de cada uno, así cada
 * renglón se lee como un bloque sin líneas. Lo que se agrega aquí sale de
 * adentro de la fila (menos hueco interno, etiqueta del empaque más baja): la
 * lista no pierde productos por pantalla.
 */
const SEPARACION_FILAS = RITMO.relacionado;
/** Filas de relleno del esqueleto: más de las que caben, para que no se vea el final. */
const FILAS_ESQUELETO = 6;

interface Edicion {
  code: string;
  campo: CampoCaptura;
  texto: string;
  reemplazar: boolean;
}

interface SeccionFamilia {
  clave: string;
  titulo: string;
  /** Solo identifica la familia (su banda); nunca el estado de una fila. */
  color: ColorFamilia | null;
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

/** Si el conteo se abrió sin nada detrás (p. ej. al recargar la app), `back` no llevaría a ningún lado. */
function volverAlInicio() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const esNoEncontrado = (error: unknown) => error instanceof ErrorApi && error.estado === 404;

export default function PantallaConteo() {
  const params = useLocalSearchParams<{
    eventoId: string;
    sesionId: string;
    tipo: string;
    fechaOperativa: string;
    ruta: string;
  }>();
  const eventoId = parametro(params.eventoId);
  const sesionId = parametro(params.sesionId);
  const tipo = parametro(params.tipo);
  const fechaOperativa = parametro(params.fechaOperativa);
  const ruta = parametro(params.ruta);

  if (!eventoId || !sesionId) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="lista"
          titulo="No se encontró la sesión de conteo"
          detalle="Vuelve al inicio y entra otra vez a tu carga: lo contado sigue guardado en este teléfono."
          accion={{ texto: 'Volver al inicio', onPress: () => router.replace('/') }}
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
      rutaNombre={ruta || null}
    />
  );
}

interface PropsConteo {
  eventoId: string;
  sesionId: string;
  tituloCarga: string;
  /**
   * `aaaa-mm-dd` de la navegación, para mostrarla sin esperar al servidor. La
   * del servidor manda en cuanto llega: la fecha se puede cambiar.
   */
  fechaOperativa: string | null;
  /** La trae la navegación del contador; la del vendedor se pide al servidor. */
  rutaNombre: string | null;
}

function Conteo({ eventoId, sesionId, tituloCarga, fechaOperativa: fechaNavegacion, rutaNombre: rutaNavegacion }: PropsConteo) {
  const { esTablet, tecladoLateral, ancho } = useLayout();
  // Todos ven qué ruta cuentan: con la del vendedor también se evita contar la carga equivocada.
  const contexto = useContextoResolucion(rutaNavegacion ? '' : eventoId);
  const rutaNombre = rutaNavegacion ?? (contexto.data?.rutaNombre?.trim() || null);
  // Siempre: además de la fecha trae el estado, que decide si se puede cambiar el día.
  const evento = useEventoCarga(eventoId, true);
  const fechaOperativa = diaDesdeApi(evento.data?.evento?.fechaOperativa) ?? fechaNavegacion;
  const tipoEvento = evento.data?.evento?.tipo ?? null;
  const consulta = useProductosCarga(eventoId);
  const productos = useMemo(() => consulta.data?.productos ?? [], [consulta.data]);
  const familias = useMemo(() => consulta.data?.familias ?? [], [consulta.data]);

  // Primero lo del dispositivo; la cola reconcilia después con el servidor.
  // Vive fuera de la pantalla: salir al inicio no detiene el envío.
  const cola = useMemo(() => obtenerCola(eventoId, sesionId), [eventoId, sesionId]);
  const estadoCola = useSyncExternalStore(cola.suscribir, cola.obtenerEstado);
  const sincronizacion = useEstadoSincronizacion(cola);
  const bloqueo = bloqueoFinalizar(sincronizacion);

  // El evento se canceló o se borró en el servidor: lo guardado aquí ya no
  // tiene a dónde ir. Se quita del teléfono y el inicio explica por qué.
  const noExiste =
    esNoEncontrado(consulta.error) || esNoEncontrado(evento.error) || evento.data?.evento?.estado === 'CANCELADA';
  useEffect(() => {
    if (!noExiste) return;
    void (async () => {
      const sesion = await obtenerUsuarioSesion().catch(() => null);
      await descartarCargaNoDisponible(sesion?.id ?? null, { eventoId, sesionId });
      avisarCargaNoDisponible();
      volverAlInicio();
    })();
  }, [noExiste, eventoId, sesionId]);

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
  const [usuario, setUsuario] = useState<{ id: string; nombre: string | null; rol: string | null } | null>(null);
  const [cambiandoFecha, setCambiandoFecha] = useState(false);
  const [panel, setPanel] = useState<'ninguno' | 'pendientes' | 'bloqueo' | 'confirmar'>('ninguno');

  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente && sesion) setUsuario({ id: sesion.id, nombre: sesion.nombreCompleto, rol: sesion.rolApp });
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

  /** El producto que sigue en la lista, en su primer campo; `null` al final. */
  const productoSiguiente = useCallback(
    (code: string): { code: string; campo: CampoCaptura } | null => {
      const siguiente = productos[productos.findIndex((p) => p.code === code) + 1];
      return siguiente ? { code: siguiente.code, campo: primerCampo(siguiente) } : null;
    },
    [productos],
  );

  /**
   * "Revisado, no lleva". Desde el teclado o desde el 0 de la fila que se
   * teclea: el cero gana sobre lo tecleado y se pasa al siguiente producto sin
   * cerrar el teclado, que es lo que mantiene el ritmo. Desde el 0 de otra
   * fila: se marca esa y el teclado sigue donde estaba.
   */
  const marcarCero = useCallback(
    (code: string) => {
      const producto = productos.find((p) => p.code === code);
      const base = conteoRef.current;
      if (!producto || !base) return;
      const enEdicion = edicionRef.current?.code === code;
      aplicar(fijarCero(base, producto));
      if (!enEdicion) return;
      const destino = productoSiguiente(code);
      if (!destino) {
        fijarEdicion(null);
        return;
      }
      const valor = capturaDe(conteoRef.current ?? {}, destino.code)[destino.campo];
      fijarEdicion({ ...destino, texto: valor === null ? '' : String(valor), reemplazar: true });
    },
    [aplicar, fijarEdicion, productoSiguiente, productos],
  );

  const alNoLleva = useCallback(() => {
    const actual = edicionRef.current;
    if (actual) marcarCero(actual.code);
  }, [marcarCero]);

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

  /**
   * El recorrido. Con paquetes tecleados se salta al siguiente producto: las
   * sueltas sin capturar cuentan como 0 y casi nunca hay. Con Paquetes vacío,
   * lo que se quiere contar son sueltas: se va a ellas. Para agregar sueltas a
   * un producto con paquetes está el selector del teclado.
   */
  const destinoSiguiente = useCallback(
    (actual: Edicion): { code: string; campo: CampoCaptura } | null => {
      const producto = productos.find((p) => p.code === actual.code);
      if (actual.campo === 'paquetes' && actual.texto === '' && producto && admiteSueltas(producto)) {
        return { code: actual.code, campo: 'sueltas' };
      }
      return productoSiguiente(actual.code);
    },
    [productos, productoSiguiente],
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

  const anchoLista = tecladoLateral ? ancho - ANCHO_TECLADO_LATERAL : ancho;
  const columnas = tecladoLateral && anchoLista >= ANCHO_MINIMO_FILA * 2 + ESPACIADO.md * 3 ? 2 : 1;

  const secciones = useMemo<SeccionFamilia[]>(
    () =>
      familias.map((f, i) => {
        const data: ProductoConteo[][] = [];
        for (let j = 0; j < f.productos.length; j += columnas) {
          data.push(f.productos.slice(j, j + columnas));
        }
        return {
          clave: f.familia ?? `sin-familia-${i}`,
          titulo: f.familia ?? 'Sin familia',
          color: f.color,
          productos: f.productos,
          data,
        };
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

  /**
   * Familia y avance en ella de cada producto, para el encabezado del teclado.
   * Mismo cálculo que el encabezado de familia de la lista: "1 de 2" dice lo
   * mismo en los dos lugares (cuántos van contados, no en qué lugar va este).
   */
  const ubicacionesFamilia = useMemo(() => {
    const mapa = new Map<string, UbicacionProducto>();
    familias.forEach((f) => {
      const familia = formatearNombreFamilia(f.familia ?? 'Sin familia');
      const { capturados, total } = progreso(f.productos, conteo ?? {});
      f.productos.forEach((p) => mapa.set(p.code, { familia, contados: capturados, total }));
    });
    return mapa;
  }, [familias, conteo]);

  const lista = useRef<SectionList<ProductoConteo[], SeccionFamilia>>(null);
  /** El último producto al que se desplazó la lista: si el intento falla, se reintenta con él. */
  const destinoScroll = useRef<{ code: string; posicion: number } | null>(null);
  /**
   * Lleva un renglón a la vista. `posicion` es la de SectionList: 1 lo deja
   * con su borde de abajo sobre el borde de abajo de la lista, 0.5 al centro.
   */
  const irAProducto = useCallback(
    (code: string, posicion = 1) => {
      const ubicacion = ubicaciones.get(code);
      if (!ubicacion) return;
      destinoScroll.current = { code, posicion };
      lista.current?.scrollToLocation({
        ...ubicacion,
        // itemIndex + 1: en SectionList el índice 0 de cada sección es su encabezado.
        itemIndex: ubicacion.itemIndex + 1,
        viewPosition: posicion,
        // Negativo: sube el renglón ese tanto sobre el borde de abajo.
        viewOffset: posicion === 1 ? -HOLGURA_SOBRE_HOJA : 0,
      });
    },
    [ubicaciones],
  );

  /*
   * Con el teclado en panel lateral (tablet), la lista sigue a la vista junto
   * a él: el renglón que se captura se mantiene visible.
   *
   * Con el teclado en hoja (celular), la hoja es la única que dice qué se
   * cuenta y la lista de atrás va bajo un velo: no se desplaza mientras se
   * teclea. Al cerrar, si con «Siguiente» (o desde pendientes) se llegó a otro
   * producto, la lista se centra en el último: se ve lo que se acaba de contar.
   */
  const codeEditado = edicion?.code ?? null;
  /** Hoja abierta: el producto con el que se abrió (`null` si se abrió desde pendientes) y el último editado. */
  const recorridoHoja = useRef<{ abiertaEn: string | null; ultimo: string } | null>(null);
  /** `irAPendiente` abre la hoja en un producto que puede no estar a la vista. */
  const abiertaDesdePendientes = useRef(false);
  useEffect(() => {
    if (tecladoLateral) {
      recorridoHoja.current = null;
      if (!codeEditado) return;
      const espera = setTimeout(() => irAProducto(codeEditado), RETRASO_SCROLL_MS);
      return () => clearTimeout(espera);
    }
    if (codeEditado) {
      recorridoHoja.current = recorridoHoja.current
        ? { ...recorridoHoja.current, ultimo: codeEditado }
        : { abiertaEn: abiertaDesdePendientes.current ? null : codeEditado, ultimo: codeEditado };
      abiertaDesdePendientes.current = false;
      return;
    }
    const recorrido = recorridoHoja.current;
    recorridoHoja.current = null;
    if (!recorrido || recorrido.ultimo === recorrido.abiertaEn) return;
    // Al cerrar, la lista recupera el alto de la hoja: se desplaza ya medida.
    const espera = setTimeout(() => irAProducto(recorrido.ultimo, 0.5), RETRASO_SCROLL_MS);
    return () => clearTimeout(espera);
  }, [codeEditado, tecladoLateral, irAProducto]);
  const altoLista = useRef(0);
  const alMedirLista = useCallback(
    (e: LayoutChangeEvent) => {
      const alto = e.nativeEvent.layout.height;
      if (alto === altoLista.current) return;
      altoLista.current = alto;
      const actual = edicionRef.current;
      if (actual && tecladoLateral) irAProducto(actual.code);
    },
    [irAProducto, tecladoLateral],
  );

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

  // Se ve solo un instante, mientras se limpia y se regresa; el botón es por si el regreso no ocurre.
  if (noExiste) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="lista"
          titulo="Esta carga ya no está disponible"
          detalle="Se canceló o se eliminó. Vuelve al inicio para empezar de nuevo."
          accion={{ texto: 'Volver al inicio', onPress: volverAlInicio }}
        />
      </SafeAreaView>
    );
  }

  if (consulta.isPending || conteo === null) {
    return <EsqueletoConteo titulo={tituloCarga} />;
  }

  if (consulta.isError) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <SafeAreaView style={estilos.pantalla}>
        <View style={estilos.contenedorAviso}>
          <BloqueError
            titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar la lista de productos'}
            detalle={
              sinRed
                ? 'La lista de productos se descarga la primera vez que abres la carga; después ya puedes contar sin señal.'
                : consulta.error.message || 'Revisa la conexión y vuelve a intentarlo.'
            }
            tono={sinRed ? 'atencion' : 'error'}
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
            secundaria={{ texto: 'Volver al inicio', onPress: volverAlInicio }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (productos.length === 0) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="caja"
          titulo="Esta carga no tiene productos"
          detalle="La plantilla de tu ruta está vacía, así que no hay nada que contar. Avisa a tu supervisor para que la revise."
          accion={{ texto: 'Volver al inicio', onPress: volverAlInicio }}
        />
      </SafeAreaView>
    );
  }

  const { capturados, total } = progreso(productos, conteo);
  const pendientes = productosPendientes(productos, conteo);
  const productoEditado = edicion ? productos.find((p) => p.code === edicion.code) : undefined;

  const rechazados = productos.filter((p) => estadoCola.items[p.code]?.error);

  // Solo el vendedor y solo mientras cuenta (BORRADOR): después, el contador
  // puede haber contado y mover la fecha sería una escapatoria si no cuadra.
  const puedeCambiarFecha =
    usuario?.rol === 'VENDEDOR' && evento.data?.evento?.estado === 'BORRADOR' && fechaOperativa !== null;

  const intentarFinalizar = () => {
    cerrarTeclado();
    setPanel(pendientes.length > 0 ? 'pendientes' : bloqueo ? 'bloqueo' : 'confirmar');
  };

  const irAPendiente = (producto: ProductoConteo) => {
    setPanel('ninguno');
    abiertaDesdePendientes.current = true;
    abrirCampo(producto.code, primerCampo(producto));
  };

  const destino = edicion ? destinoSiguiente(edicion) : null;
  const siguienteEsSueltas = edicion !== null && destino?.code === edicion.code;
  const teclado =
    edicion && productoEditado ? (
      <TecladoCantidad
        producto={productoEditado}
        ubicacion={ubicacionesFamilia.get(productoEditado.code) ?? null}
        campo={edicion.campo}
        camposDisponibles={camposDe(productoEditado)}
        texto={edicion.texto}
        reemplazar={edicion.reemplazar}
        captura={capturaVisible(edicion.code)}
        etiquetaSiguiente={siguienteEsSueltas ? 'Sueltas' : destino ? 'Siguiente' : 'Terminar'}
        siguienteConChevron={destino !== null}
        lateral={tecladoLateral}
        teclasGrandes={esTablet}
        onDigito={alDigito}
        onBorrar={alBorrar}
        onSiguiente={alSiguiente}
        onNoLleva={alNoLleva}
        onCambiarCampo={(campo) => abrirCampo(edicion.code, campo)}
        onListo={cerrarTeclado}
      />
    ) : null;
  /** Hoja del teclado abierta en celular: la lista de atrás va bajo el velo. */
  const listaVelada = teclado !== null && !tecladoLateral;

  const razon = razonNoFinalizar(pendientes.length, bloqueo);
  const quienCuenta = usuario?.nombre
    ? `${usuario.nombre}${usuario.rol && usuario.rol in ETIQUETAS_ROL ? ` · ${ETIQUETAS_ROL[usuario.rol as keyof typeof ETIQUETAS_ROL]}` : ''}`
    : null;

  // Abajo, al alcance del pulgar: Finalizar y, sobre él, por qué aún no se
  // puede. En celular se esconde mientras el teclado ocupa ese lugar.
  const barraFinalizar = (
    <BarraAccion nota={razon}>
      <Boton
        texto="Finalizar conteo"
        variante={razon ? 'secundario' : 'primario'}
        onPress={intentarFinalizar}
        tacto={razon ? 'aviso' : 'toque'}
        accessibilityLabel={razon ? `Finalizar conteo. Aún no se puede: ${razon}` : 'Finalizar conteo'}
        accessibilityHint={razon ? 'Muestra qué falta' : undefined}
        style={estilos.botonFinalizar}
      />
    </BarraAccion>
  );

  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
      <Encabezado
        titulo={tituloCarga}
        rutaNombre={rutaNombre}
        quienCuenta={quienCuenta}
        fechaOperativa={fechaOperativa}
        capturados={capturados}
        total={total}
        sincronizacion={sincronizacion}
        onReintentar={() => cola.sincronizarAhora()}
        onCambiarFecha={
          puedeCambiarFecha
            ? () => {
                cerrarTeclado();
                setCambiandoFecha(true);
              }
            : undefined
        }
        onVolver={() => {
          cerrarTeclado();
          volverAlInicio();
        }}
      />

      <View style={[estilos.cuerpo, tecladoLateral && estilos.cuerpoTablet]}>
        <View style={estilos.columnaLista}>
          <SectionList<ProductoConteo[], SeccionFamilia>
            ref={lista}
            key={`columnas-${columnas}`}
            style={estilos.lista}
            onLayout={alMedirLista}
            // Bajo el velo tampoco se lee en voz alta: la hoja dice qué se cuenta.
            accessibilityElementsHidden={listaVelada}
            importantForAccessibility={listaVelada ? 'no-hide-descendants' : 'auto'}
            sections={secciones}
            keyExtractor={(fila) => fila.map((p) => p.code).join('|')}
            extraData={{ conteo, edicion, items: estadoCola.items }}
            stickySectionHeadersEnabled
            initialNumToRender={total}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[estilos.contenidoLista, esTablet && !tecladoLateral && estilos.contenidoListaMedio]}
            onScrollToIndexFailed={() => {
              const destino = destinoScroll.current;
              if (destino) setTimeout(() => irAProducto(destino.code, destino.posicion), RETRASO_SCROLL_MS * 4);
            }}
            renderSectionHeader={({ section }) => <EncabezadoFamilia seccion={section} conteo={conteo} />}
            renderSectionFooter={() => <View style={estilos.pieFamilia} />}
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
          {(tecladoLateral || !teclado) && barraFinalizar}
          {/*
            Con la hoja abierta la lista se apaga: se intuye, no se lee. Sin
            filas a medias que parezcan la que se teclea. Tocarlo cierra la hoja.
          */}
          {listaVelada && (
            <Animated.View
              entering={FadeIn.duration(MOVIMIENTO.rapido)}
              exiting={FadeOut.duration(MOVIMIENTO.rapido)}
              style={[StyleSheet.absoluteFill, estilos.velo]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={cerrarTeclado}
                accessibilityRole="button"
                accessibilityLabel="Cerrar teclado"
              />
            </Animated.View>
          )}
        </View>

        {tecladoLateral ? (
          <View style={estilos.lateral}>
            {teclado ?? (
              <View style={estilos.lateralVacio}>
                <Glifo nombre="caja" color={COLORES.textoSecundario} tamano={ESPACIADO.xxxl} />
                <Text style={estilos.textoLateralVacio}>Toca Paquetes o Sueltas de un producto para capturar.</Text>
                <Text style={estilos.detalleLateralVacio}>Si no lleva, toca su botón 0 o «No lleva» en el teclado.</Text>
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
      {fechaOperativa !== null && (
        <ModalCambiarFecha
          visible={cambiandoFecha}
          eventoId={eventoId}
          tipo={tipoEvento}
          diaActual={fechaOperativa}
          productosContados={capturados}
          motivoMinimo={null}
          onCambiada={(dia) => {
            setCambiandoFecha(false);
            // La navegación y "Continuar carga" del inicio también traían la fecha vieja.
            router.setParams({ fechaOperativa: dia });
            if (usuario) void actualizarFechaCargaAbierta(usuario.id, eventoId, dia).catch(() => undefined);
          }}
          onCerrar={() => setCambiandoFecha(false)}
          onSesionVencida={() => {
            void cerrarSesion().then(() => router.replace('/login'));
          }}
        />
      )}
      <PanelConfirmar
        visible={panel === 'confirmar'}
        eventoId={eventoId}
        sesionId={sesionId}
        productos={productos}
        conteo={conteo}
        bloqueo={bloqueo}
        usuarioId={usuario?.id ?? null}
        tipo={tipoEvento}
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
  rutaNombre: string | null;
  /** Quién cuenta en este teléfono ("Irvin Alday · Vendedor"). */
  quienCuenta: string | null;
  fechaOperativa: string | null;
  capturados: number;
  total: number;
  sincronizacion: EstadoSincronizacion;
  onReintentar: () => void;
  /** Solo si se puede mover la carga de día: la línea de la fecha se vuelve tocable. */
  onCambiarFecha?: () => void;
  onVolver: () => void;
}

/**
 * Por qué todavía no se puede finalizar, en una línea sobre el botón. Que no
 * se pueda no es lo mismo que no saber por qué. `null`: ya se puede.
 */
function razonNoFinalizar(faltan: number, bloqueo: BloqueoFinalizar): string | null {
  if (faltan > 0) return faltan === 1 ? 'Falta 1 producto por contar.' : `Faltan ${faltan} productos por contar.`;
  switch (bloqueo) {
    case 'sin-conexion':
      return 'Sin señal: lo que llevas está guardado en este teléfono y se manda solo cuando vuelva.';
    case 'por-enviar':
      return 'Guardando lo que llevas contado…';
    case 'rechazados':
      return 'Hay productos que no se aceptaron: vuelve a capturarlos.';
    case 'sesion-expirada':
      return 'Tu sesión venció: entra de nuevo para finalizar.';
    case 'error':
      return 'No se pudo guardar tu conteo.';
    case null:
      return null;
  }
}

/**
 * Bloque azul: qué se cuenta (tipo, ruta, día de salida), quién cuenta, y un
 * panel con la lectura del avance, la barra y el estado de envío. Finalizar
 * no vive aquí: va abajo, donde llega el pulgar.
 */
function Encabezado({
  titulo,
  rutaNombre,
  quienCuenta,
  fechaOperativa,
  capturados,
  total,
  sincronizacion,
  onReintentar,
  onCambiarFecha,
  onVolver,
}: PropsEncabezado) {
  // Siempre a la vista: quien cuenta debe saber para qué día es la carga.
  const salida = fechaOperativa ? textoSalidaCorta(fechaOperativa, diaNegocio(new Date())) : null;
  const completo = capturados === total;

  return (
    <EncabezadoBase
      variante="marca"
      titulo={rutaNombre ? `${titulo} · ${rutaNombre}` : titulo}
      subtitulo={onCambiarFecha ? null : salida}
      onVolver={onVolver}
      etiquetaVolver="Volver al inicio. Lo contado queda guardado."
      accion={numeroRuta(rutaNombre) ? <EscudoRuta numero={numeroRuta(rutaNombre)!} accessibilityLabel={rutaNombre ?? undefined} /> : undefined}
      inferior={
        <PanelEncabezado>
          <View style={estilos.filaProgreso}>
            <Text
              style={estilos.textoProgreso}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${capturados} de ${total} ${plural(total, 'producto contado', 'productos contados')}`}
              maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
            >
              <Text style={estilos.numeroProgreso}>{capturados}</Text>
              {` de ${total} ${plural(total, 'producto', 'productos')}`}
            </Text>
            <IndicadorSincronizacion estado={sincronizacion} onReintentar={onReintentar} />
          </View>
          <BarraAvance actual={capturados} total={total} />
          {completo && (
            <View style={estilos.lineaCompleto}>
              <Palomita color={COLORES.cian} tamano={ESPACIADO.lg} />
              <Text style={estilos.textoCompleto} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
                Todo contado. Revisa y finaliza abajo.
              </Text>
            </View>
          )}
        </PanelEncabezado>
      }
    >
      {onCambiarFecha && salida && (
        // Subrayada y con lápiz: se ve que se toca. Mismo lugar que el subtítulo normal.
        <Pulsable
          onPress={onCambiarFecha}
          hitSlop={{ top: ESPACIADO.md, bottom: ESPACIADO.md, left: ESPACIADO.sm, right: ESPACIADO.sm }}
          accessibilityRole="button"
          accessibilityLabel={`${salida}. Cambiar la fecha`}
          accessibilityHint="Lo contado se conserva"
          style={({ pressed }) => [estilos.fechaTocable, pressed && estilos.fechaTocablePresionada]}
        >
          <Text style={estilos.textoFechaTocable} numberOfLines={1} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
            {salida}
          </Text>
          <Lapiz color={COLORES.marcaTenue} tamano={ESPACIADO.md + ESPACIADO.xs} />
        </Pulsable>
      )}
      {quienCuenta && (
        <View style={estilos.lineaPersona} accessible accessibilityLabel={`Cuenta ${quienCuenta}`}>
          <Glifo nombre="persona" color={COLORES.marcaTenue} tamano={ESPACIADO.md + ESPACIADO.xs} />
          <Text style={estilos.textoPersona} numberOfLines={1} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
            Cuenta {quienCuenta}
          </Text>
        </View>
      )}
    </EncabezadoBase>
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
      <Pulsable
        onPress={() => router.replace('/login')}
        accessibilityRole="button"
        hitSlop={ESPACIADO.sm}
        style={[estilos.pildoraEstado, estilos.pildoraError]}
      >
        <Text style={[estilos.guardado, estilos.guardadoError]} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
          Sesión vencida · entra de nuevo
        </Text>
        <Chevron color={COLORES.errorTexto} tamano={ESPACIADO.lg} />
      </Pulsable>
    );
  }

  let texto: string;
  let tono: 'normal' | 'atencion' | 'error' = 'normal';
  if (!hayConexion) {
    texto = pendientes > 0 ? `Sin conexión · ${pendientes} por enviar` : 'Sin conexión · todo enviado';
    tono = 'atencion';
  } else if (fallidos > 0) {
    texto = `${fallidos} ${plural(fallidos, 'producto no aceptado', 'productos no aceptados')}`;
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
    texto = 'Al día';
  }

  const reintentable = hayConexion && !sincronizando && (pendientes > 0 || ultimoError?.tipo === 'rechazo');
  // Al día, en el tono del panel: no pide nada. Con algo pendiente, pastilla tintada del estado.
  const pildora = [
    estilos.pildoraEstado,
    tono === 'atencion' && estilos.pildoraAtencion,
    tono === 'error' && estilos.pildoraError,
  ];
  const colorIcono =
    tono === 'atencion' ? COLORES.discrepanciaTexto : tono === 'error' ? COLORES.errorTexto : COLORES.textoSobreColor;
  const alDia = tono === 'normal' && !sincronizando;
  const contenido = (
    <>
      {alDia && <Palomita color={COLORES.cian} tamano={ESPACIADO.lg} />}
      {!hayConexion && <Glifo nombre="sinSenal" color={colorIcono} tamano={ESPACIADO.lg} />}
      <Text
        style={[estilos.guardado, tono === 'atencion' && estilos.guardadoAtencion, tono === 'error' && estilos.guardadoError]}
        numberOfLines={2}
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
      >
        {texto}
      </Text>
      {reintentable && <Chevron color={colorIcono} tamano={ESPACIADO.lg} />}
    </>
  );

  if (!reintentable) return <View style={pildora}>{contenido}</View>;
  return (
    <Pulsable
      onPress={onReintentar}
      accessibilityRole="button"
      accessibilityLabel={`${texto}. Reintentar ahora`}
      hitSlop={ESPACIADO.sm}
      style={pildora}
    >
      {contenido}
    </Pulsable>
  );
}

/**
 * Banda a todo el ancho, fija arriba mientras se recorre su familia: con 60
 * productos, es lo que dice en qué parte de la lista vas. Una cápsula en el
 * tinte de la familia (lo da el supervisor) con un punto de su color sólido,
 * el nombre en su tono fuerte y el avance en una pastilla blanca: identifica,
 * no comunica estado, y no toca las filas. Sin color, gris azulado. Completa,
 * el avance pasa a "Completa" en verde con su palomita.
 */
function EncabezadoFamilia({ seccion, conteo }: { seccion: SeccionFamilia; conteo: EstadoConteo }) {
  const { capturados, total } = progreso(seccion.productos, conteo);
  const completa = capturados === total;
  const tonos = seccion.color ? TONOS_COLOR_FAMILIA[seccion.color] : null;
  const fondoBanda = tonos?.tinte ?? COLORES.superficieHonda;
  // Sin color, la línea toma el fondo de la banda: todas miden lo mismo.
  const linea = tonos?.solido ?? fondoBanda;
  const textoNombre = tonos?.texto ?? COLORES.texto;
  const textoPastilla = completa ? COLORES.capturadoHondo : (tonos?.texto ?? COLORES.textoSecundario);
  return (
    <View style={estilos.encabezadoFamilia} accessibilityRole="header">
      <View style={[estilos.bandaFamilia, { backgroundColor: fondoBanda }]}>
        <View style={[estilos.puntoFamilia, { backgroundColor: linea === fondoBanda ? COLORES.textoTerciario : linea }]} />
        <Text style={[estilos.nombreFamilia, { color: textoNombre }]} numberOfLines={1}>
          {formatearNombreFamilia(seccion.titulo)}
        </Text>
        <View style={[estilos.pastillaFamilia, completa && estilos.pastillaFamiliaCompleta]}>
          {completa && <Palomita color={COLORES.capturadoHondo} tamano={ESPACIADO.md + ESPACIADO.xs} />}
          <Text
            style={[estilos.conteoFamilia, { color: textoPastilla }]}
            accessibilityLabel={completa ? `Familia completa, ${total} de ${total}` : `${capturados} de ${total} capturados`}
          >
            {completa ? 'Completa' : `${capturados} de ${total}`}
          </Text>
        </View>
      </View>
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
    <Hoja
      visible={visible}
      onCerrar={onCerrar}
      cerrarAlTocarFondo
      titulo={n === 1 ? 'Falta 1 producto' : `Faltan ${n} productos`}
      detalle="Cuéntalos, o márcalos en 0 si no llevan, antes de finalizar. Toca uno para ir a él."
      estiloContenido={estilos.contenidoListaModal}
      pie={<Boton texto="Seguir contando" variante="secundario" onPress={onCerrar} />}
    >
      {porFamilia.map(([familia, productos]) => (
        <View key={familia} style={estilos.grupoModal}>
          <Text style={estilos.familiaModal}>{formatearNombreFamilia(familia)}</Text>
          {productos.map((p) => (
            <RenglonIrAProducto key={p.code} producto={p} onIr={onIr} />
          ))}
        </View>
      ))}
    </Hoja>
  );
}

/** Un producto al que se puede saltar: factor, nombre y flecha. */
function RenglonIrAProducto({ producto, onIr }: { producto: ProductoConteo; onIr: (producto: ProductoConteo) => void }) {
  const nombre = formatearNombreProducto(producto.nombre);
  return (
    <Pulsable
      onPress={() => onIr(producto)}
      onda={ONDA.sobreClaro}
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${nombre}`}
      style={({ pressed }) => [estilos.pendiente, pressed && estilos.pendientePresionado]}
    >
      <EtiquetaFactor producto={producto} />
      <Text style={estilos.nombrePendiente} numberOfLines={2}>
        {nombre}
      </Text>
      <Chevron />
    </Pulsable>
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
    'Para comparar tu conteo con el otro, primero tiene que guardarse completo.';

  let titulo: string;
  let detalle: string;
  let accion: { texto: string; onPress: () => void } | null = null;

  switch (bloqueo) {
    case 'sin-conexion':
      titulo = 'Sin conexión';
      detalle =
        (pendientes > 0
          ? `Tu conteo está guardado en este teléfono, pero ${pendientes} ${plural(pendientes, 'cambio falta', 'cambios faltan')} por mandarse. `
          : 'Tu conteo ya está guardado, pero finalizar también necesita señal. ') +
        `${porqueServidor} Acércate a donde haya señal: lo pendiente se envía solo.`;
      break;
    case 'por-enviar':
      titulo = pendientes > 0 ? `Faltan ${pendientes} por guardarse` : 'Revisando que todo esté guardado…';
      detalle = `${porqueServidor} ${sincronizando ? 'Enviando ahora…' : 'Se reintentará solo en unos segundos.'}`;
      if (!sincronizando) accion = { texto: 'Reintentar ahora', onPress: onReintentar };
      break;
    case 'rechazados':
      titulo = `No se ${plural(rechazados.length, 'aceptó', 'aceptaron')} ${rechazados.length} ${plural(rechazados.length, 'producto', 'productos')}`;
      detalle = 'Vuelve a capturarlos (por ejemplo, en piezas sueltas) para poder finalizar. Toca uno para ir a él.';
      break;
    case 'sesion-expirada':
      titulo = 'Tu sesión venció';
      detalle = 'Entra de nuevo con tu PIN: lo contado sigue guardado en este teléfono y se enviará al volver.';
      accion = { texto: 'Entrar', onPress: () => router.replace('/login') };
      break;
    case 'error':
      titulo = 'No se pudo guardar tu conteo';
      detalle = ultimoError?.mensaje ?? 'Intenta de nuevo.';
      accion = { texto: 'Reintentar', onPress: onReintentar };
      break;
    case null:
      titulo = 'Tu conteo está guardado';
      detalle = 'Ya puedes finalizar tu conteo.';
      accion = { texto: 'Continuar', onPress: onContinuar };
      break;
  }

  return (
    <Hoja
      visible={visible}
      onCerrar={onCerrar}
      titulo={titulo}
      detalle={detalle}
      pie={
        <AccionesHoja>
          <Boton texto="Seguir contando" variante="secundario" onPress={onCerrar} />
          {accion && <Boton texto={accion.texto} onPress={accion.onPress} />}
        </AccionesHoja>
      }
    >
      {bloqueo === 'rechazados' && rechazados.map((p) => <RenglonIrAProducto key={p.code} producto={p} onIr={onIr} />)}
    </Hoja>
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
  tipo: TipoCarga | null;
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
  tipo,
  onCerrar,
}: PropsPanelConfirmar) {
  const mutacion = useFinalizarSesion();
  const [fase, setFase] = useState<'confirmando' | 'finalizando'>('confirmando');
  const [error, setError] = useState<string | null>(null);

  const conCantidad = productos.filter((p) => estadoFila(capturaDe(conteo, p.code), p) === 'con-cantidad').length;
  const enCero = productos.filter((p) => estadoFila(capturaDe(conteo, p.code), p) === 'en-cero').length;

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
          sentir('exito');
          onCerrar();
          // Fue el segundo conteo y hubo diferencias: resolverlas es lo siguiente,
          // con la otra persona al lado. Se reemplaza el conteo: ya no se puede volver a él.
          if (respuesta?.evento?.estado === 'CONFLICTOS_PENDIENTES') {
            // `desdeConteo`: la pantalla abre diciendo qué pasó ("no coinciden en 3 productos").
            router.replace({ pathname: '/discrepancias/[eventoId]', params: { eventoId, desdeConteo: '1' } });
            return;
          }
          // El inicio confirma que llegó y dice qué sigue: el cierre del conteo.
          avisarConteoFinalizado({ tipo, estado: respuesta?.evento?.estado ?? null, productos: productos.length });
          volverAlInicio();
        },
        onError: (e) => {
          setFase('confirmando');
          sentir('error');
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
    <Hoja
      visible={visible}
      onCerrar={cerrar}
      bloqueada={ocupado}
      titulo="¿Finalizar tu conteo?"
      detalle="Después de finalizar ya no podrás cambiarlo."
      pie={
        <AccionesHoja>
          <Boton texto="Seguir contando" variante="secundario" onPress={cerrar} deshabilitado={ocupado} />
          <Boton
            texto="Finalizar conteo"
            onPress={finalizar}
            cargando={fase === 'finalizando'}
            textoCargando="Finalizando…"
            deshabilitado={!puedeFinalizar}
          />
        </AccionesHoja>
      }
    >
      {/* El resumen como lectura: tres cifras que se comparan de un vistazo. */}
      <View style={estilos.resumen} accessible accessibilityLabel={`${productos.length} productos revisados: ${conCantidad} con cantidad y ${enCero} en cero`}>
        <CifraResumen valor={productos.length} rotulo="Revisados" />
        <CifraResumen valor={conCantidad} rotulo="Con cantidad" tono="capturado" />
        <CifraResumen valor={enCero} rotulo="No llevan" tono="pendiente" />
      </View>

      {!puedeFinalizar && !error && (
        <BloqueError
          tono="atencion"
          titulo={bloqueo === 'sin-conexion' ? 'Se perdió la conexión' : 'Falta enviar parte del conteo'}
          detalle={
            bloqueo === 'sin-conexion'
              ? 'Para finalizar necesitas señal: así se comparan los dos conteos.'
              : 'Espera un momento: lo que contaste se está guardando solo.'
          }
        />
      )}

      {error && <BloqueError titulo="No se pudo finalizar" detalle={error} />}
    </Hoja>
  );
}

/** Una cifra del resumen: el número domina, el rótulo debajo. */
function CifraResumen({ valor, rotulo, tono }: { valor: number; rotulo: string; tono?: 'capturado' | 'pendiente' }) {
  const color = tono === 'capturado' ? COLORES.capturadoHondo : tono === 'pendiente' ? COLORES.pendiente : COLORES.texto;
  return (
    <View style={estilos.cifraResumen}>
      <Text style={[estilos.numeroResumen, { color }]} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
        {valor}
      </Text>
      <Text style={estilos.rotuloResumen} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
        {rotulo}
      </Text>
    </View>
  );
}

/**
 * La forma del conteo mientras llega la lista: el encabezado con su título y
 * los primeros productos, del mismo alto que las filas reales.
 */
function EsqueletoConteo({ titulo }: { titulo: string }) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
      <EncabezadoBase
        variante="marca"
        titulo={titulo}
        onVolver={volverAlInicio}
        etiquetaVolver="Volver al inicio"
        inferior={
          <PanelEncabezado>
            <View style={estilos.filaProgreso}>
              <Text style={estilos.textoProgreso}>
                <Text style={estilos.numeroProgreso}>–</Text>
              </Text>
            </View>
            <BarraAvance actual={0} total={1} />
          </PanelEncabezado>
        }
      />
      <Esqueleto etiqueta="Cargando productos" style={estilos.contenidoLista}>
        <View style={estilos.encabezadoFamilia}>
          <LineaEsqueleto nivel="subtitulo" ancho="40%" />
        </View>
        {Array.from({ length: FILAS_ESQUELETO }, (_, i) => (
          <View key={i} style={[estilos.filaColumnas, estilos.filaEsqueleto]}>
            <View style={estilos.cuerpoFilaEsqueleto}>
              <LineaEsqueleto nivel="titulo" ancho="70%" />
              <BloqueEsqueleto alto={ALTO_CONTROL} />
            </View>
          </View>
        ))}
      </Esqueleto>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenedorAviso: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },

  // Encabezado (azul)
  botonFinalizar: {
    flex: 1,
  },
  lineaPersona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
    marginTop: 2,
  },
  textoPersona: {
    flexShrink: 1,
    ...TIPOGRAFIA.micro,
    color: COLORES.marcaTenue,
  },
  lineaCompleto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
  },
  textoCompleto: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSobreColor,
  },
  fechaTocable: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: ESPACIADO.xs,
  },
  fechaTocablePresionada: {
    opacity: 0.7,
  },
  textoFechaTocable: {
    ...TIPOGRAFIA.micro,
    color: COLORES.marcaTenue,
    textDecorationLine: 'underline',
    flexShrink: 1,
  },
  filaProgreso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
  },
  textoProgreso: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.medio,
    color: COLORES.marcaTenue,
    ...CIFRAS,
  },
  // Lo que se busca al levantar la vista: cuántos van.
  numeroProgreso: {
    ...TIPOGRAFIA.avance,
    color: COLORES.textoSobreColor,
  },
  pildoraEstado: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs + 2,
    // En un renglón se ve como pastilla (el radio se topa en la mitad del alto);
    // si el texto baja a dos, queda un bloque redondeado y no un óvalo.
    borderRadius: RADIOS.control,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  pildoraAtencion: {
    backgroundColor: COLORES.discrepanciaFondo,
  },
  pildoraError: {
    backgroundColor: COLORES.errorFondo,
  },
  guardado: {
    flexShrink: 1,
    textAlign: 'right',
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  guardadoAtencion: {
    color: COLORES.discrepanciaTexto,
  },
  guardadoError: {
    color: COLORES.errorTexto,
  },

  // Lista (densa: ver SEPARACION_FILAS)
  cuerpo: {
    flex: 1,
  },
  cuerpoTablet: {
    flexDirection: 'row',
  },
  columnaLista: {
    flex: 1,
  },
  velo: {
    backgroundColor: COLORES.velo,
  },
  lista: {
    flex: 1,
  },
  contenidoLista: {
    paddingHorizontal: ESPACIADO.md,
    paddingBottom: ESPACIADO.xl,
  },
  // Tablet en vertical: una columna, pero no de 800 de ancho; el ojo no viaja de más.
  contenidoListaMedio: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
  },
  // A todo el ancho (sin los márgenes de la lista) y opaca: tapa las filas al fijarse arriba.
  encabezadoFamilia: {
    marginHorizontal: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.xs,
    backgroundColor: COLORES.fondo,
  },
  bandaFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm + 2,
    minHeight: ESPACIADO.xxxl - ESPACIADO.xs,
    paddingLeft: ESPACIADO.lg,
    paddingRight: ESPACIADO.xs + 2,
    borderRadius: RADIOS.completo,
  },
  puntoFamilia: {
    width: ESPACIADO.md,
    height: ESPACIADO.md,
    borderRadius: RADIOS.completo,
  },
  nombreFamilia: {
    flex: 1,
    ...FAMILIA,
  },
  pastillaFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs + 2,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.superficie,
  },
  pastillaFamiliaCompleta: {
    backgroundColor: COLORES.capturadoFondo,
  },
  // Aire entre la última fila de una familia y la banda de la siguiente.
  pieFamilia: {
    height: ESPACIADO.lg,
  },
  conteoFamilia: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.extraNegrita,
    ...CIFRAS,
  },
  // Más aire entre productos que dentro de cada uno: un renglón no se confunde con el siguiente.
  filaColumnas: {
    flexDirection: 'row',
    gap: SEPARACION_FILAS,
    paddingTop: SEPARACION_FILAS,
  },
  huecoColumna: {
    flex: 1,
  },
  filaEsqueleto: {
    flexDirection: 'column',
  },
  cuerpoFilaEsqueleto: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.pieza,
    boxShadow: SOMBRAS.tarjeta,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    backgroundColor: COLORES.fondo,
  },
  lateralVacio: {
    flex: 1,
    justifyContent: 'center',
    gap: RITMO.interno,
    padding: ESPACIADO.xl,
  },
  textoLateralVacio: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalleLateralVacio: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },

  // Paneles
  resumen: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  cifraResumen: {
    flex: 1,
    gap: 2,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.control,
  },
  numeroResumen: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.extraNegrita,
    ...CIFRAS,
  },
  rotuloResumen: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  contenidoListaModal: {
    gap: RITMO.grupo,
  },
  grupoModal: {
    gap: ESPACIADO.xs,
  },
  familiaModal: ETIQUETA_DATO,
  // Renglón sobre fondo gris claro: se distingue del blanco del panel sin contorno.
  pendiente: {
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.control,
  },
  pendientePresionado: {
    backgroundColor: COLORES.marcaTinte,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  nombrePendiente: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
});
