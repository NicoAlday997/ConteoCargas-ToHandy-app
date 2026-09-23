import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useCapturarDiscrepancia, useConfirmarDiscrepancia, useDiscrepancias } from '../../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion } from '../../src/api/sesion';
import { IndicadoresPin, LONGITUD_PIN } from '../../src/componentes/IndicadoresPin';
import { TecladoPin } from '../../src/componentes/TecladoPin';
import {
  admitePaquetes,
  factorEfectivo,
  totalPiezas,
  type CampoCaptura,
  type CapturaProducto,
} from '../../src/conteo/estado-conteo';
import { EtiquetaFactor } from '../../src/conteo/FilaProducto';
import { formatearEnPaquetes, formatearTotalPiezas } from '../../src/conteo/formato-cantidad';
import { TecladoCantidad } from '../../src/conteo/TecladoCantidad';
import {
  capturaInicial,
  diferencia,
  esAtipica,
  estadoDe,
  etiquetaRol,
  progresoResolucion,
  puedeConfirmar,
  type ConteoLado,
  type Discrepancia,
} from '../../src/discrepancias/estado-discrepancia';
import { useLayout } from '../../src/theme/breakpoints';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/** Igual que en el conteo: 9999 ya es un error de dedo. */
const MAX_DIGITOS = 4;
const ANCHO_TECLADO_LATERAL = 380;
const ANCHO_MAXIMO_LISTA = 720;
const ANCHO_BARRA_ESTADO = 6;
/** Tras abrir el teclado hay que esperar al layout para llevar la tarjeta a la vista. */
const RETRASO_SCROLL_MS = 60;

interface Edicion {
  code: string;
  campo: CampoCaptura;
  texto: string;
  reemplazar: boolean;
  /** Lo capturado hasta ahora en esta tarjeta, sin el campo que se teclea. */
  captura: CapturaProducto;
  /** El teclado se cerró con "Listo": la captura sigue en la tarjeta sin guardar. */
  tecladoAbierto: boolean;
}

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function textoAValor(texto: string): number | null {
  return texto === '' ? null : Number(texto);
}

/** En la unidad en que se cuenta en bodega; sin factor confirmado, en piezas. */
function enPaquetes(piezas: number, d: Discrepancia): string {
  return formatearEnPaquetes(piezas, factorEfectivo(d.producto));
}

/** "(18 piezas)" debajo de la cantidad en paquetes; sin factor sería repetir lo mismo. */
function totalSecundario(piezas: number, d: Discrepancia): string | null {
  return factorEfectivo(d.producto) === null ? null : formatearTotalPiezas(piezas);
}

/** Para lectores de pantalla: "3 paquetes y 2 piezas, 20 piezas en total". */
function vozCantidad(piezas: number, d: Discrepancia): string {
  const texto = enPaquetes(piezas, d);
  return totalSecundario(piezas, d) === null ? texto : `${texto}, ${formatearEnPaquetes(piezas, null)} en total`;
}

/** Captura con lo tecleado aplicado encima. */
function capturaVisible(e: Edicion): CapturaProducto {
  return { ...e.captura, [e.campo]: textoAValor(e.texto) };
}

/** Pasa lo tecleado a la captura de la tarjeta. */
function asentar(e: Edicion): Edicion {
  return { ...e, captura: capturaVisible(e), reemplazar: true };
}

export default function PantallaDiscrepancias() {
  const params = useLocalSearchParams<{ eventoId: string }>();
  const eventoId = parametro(params.eventoId);

  if (!eventoId) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="No se encontró la carga"
          detalle="Vuelve al inicio y entra otra vez."
          textoBoton="Volver al inicio"
          onPress={() => router.replace('/')}
        />
      </SafeAreaView>
    );
  }

  return <Resolucion eventoId={eventoId} />;
}

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function Resolucion({ eventoId }: { eventoId: string }) {
  const { esTablet } = useLayout();
  const consulta = useDiscrepancias(eventoId);
  const capturar = useCapturarDiscrepancia(eventoId);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const edicionRef = useRef<Edicion | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  /** Foto de lo que se confirma: si la cantidad cambia mientras se teclea el PIN, se confirma esta y el servidor rechaza. */
  const [aConfirmar, setAConfirmar] = useState<Discrepancia | null>(null);
  /** El servidor ya dijo que pasó a autorización: no esperar al siguiente refresco. */
  const [enAutorizacion, setEnAutorizacion] = useState(false);

  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente) setUsuarioId(sesion?.id ?? null);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [sesionVencida]);

  const fijarEdicion = useCallback((nueva: Edicion | null) => {
    edicionRef.current = nueva;
    setEdicion(nueva);
  }, []);

  const fijarError = (code: string, mensaje: string | null) =>
    setErrores((actuales) => {
      const { [code]: _anterior, ...resto } = actuales;
      return mensaje ? { ...resto, [code]: mensaje } : resto;
    });

  // ---- Captura (paso A) --------------------------------------------------

  const abrirCampo = (code: string, campo: CampoCaptura, base: CapturaProducto) => {
    const valor = base[campo];
    fijarEdicion({ code, campo, texto: valor === null ? '' : String(valor), reemplazar: true, captura: base, tecladoAbierto: true });
  };

  const empezarCaptura = (d: Discrepancia) => {
    fijarError(d.code, null);
    abrirCampo(d.code, admitePaquetes(d.producto) ? 'paquetes' : 'sueltas', capturaInicial(d));
  };

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

  const cerrarTeclado = useCallback(() => {
    const actual = edicionRef.current;
    if (actual) fijarEdicion({ ...asentar(actual), tecladoAbierto: false });
  }, [fijarEdicion]);

  const cancelar = () => fijarEdicion(null);

  const guardar = (d: Discrepancia, captura: CapturaProducto) => {
    const piezas = totalPiezas(captura, factorEfectivo(d.producto));
    if (piezas === null) {
      fijarError(d.code, 'Captura cuántos paquetes o sueltas hay antes de guardar.');
      return;
    }
    fijarError(d.code, null);
    capturar.mutate(
      { productoCode: d.code, cantidadFinal: piezas },
      {
        onSuccess: () => fijarEdicion(null),
        onError: (e) => {
          if (e instanceof ErrorApi && e.estado === 401) {
            void cerrarSesion().then(() => router.replace('/login'));
            return;
          }
          fijarError(
            d.code,
            e instanceof ErrorRed ? 'Sin conexión: la cantidad no se guardó. Inténtalo cuando haya señal.' : e.message || 'No se pudo guardar.',
          );
        },
      },
    );
  };

  const discrepancias = consulta.data ?? [];

  const alSiguiente = () => {
    const actual = edicionRef.current;
    if (!actual) return;
    const asentada = asentar(actual);
    if (actual.campo === 'paquetes') {
      abrirCampo(actual.code, 'sueltas', asentada.captura);
      return;
    }
    const d = discrepancias.find((x) => x.code === actual.code);
    fijarEdicion({ ...asentada, tecladoAbierto: false });
    if (d) guardar(d, asentada.captura);
  };

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (aConfirmar) return false;
      if (!edicionRef.current?.tecladoAbierto) return false;
      cerrarTeclado();
      return true;
    });
    return () => suscripcion.remove();
  }, [aConfirmar, cerrarTeclado]);

  // ---- Llevar la tarjeta en edición a la vista ---------------------------

  const lista = useRef<ScrollView>(null);
  const posiciones = useRef(new Map<string, number>());
  const codeEditado = edicion?.tecladoAbierto ? edicion.code : null;
  useEffect(() => {
    if (!codeEditado) return;
    const y = posiciones.current.get(codeEditado);
    if (y === undefined) return;
    const t = setTimeout(() => lista.current?.scrollTo({ y: Math.max(0, y - ESPACIADO.md), animated: true }), RETRASO_SCROLL_MS);
    return () => clearTimeout(t);
  }, [codeEditado]);

  // ---- Estados generales ---------------------------------------------------

  if (consulta.isPending) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <View style={estilos.centrado} accessibilityLabel="Cargando diferencias" accessibilityState={{ busy: true }}>
          <ActivityIndicator size="large" color={COLORES.texto} />
        </View>
      </SafeAreaView>
    );
  }

  if (consulta.isError && !consulta.data) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="No se pudieron cargar las diferencias"
          detalle={
            consulta.error instanceof ErrorRed
              ? 'Sin conexión. Resolver diferencias necesita señal: cada paso se registra en el servidor.'
              : consulta.error.message || 'Intenta de nuevo.'
          }
          textoBoton={consulta.isFetching ? 'Cargando…' : 'Reintentar'}
          onPress={() => void consulta.refetch()}
          textoSecundario="Volver"
          onSecundario={volver}
        />
      </SafeAreaView>
    );
  }

  const { resueltas, total } = progresoResolucion(discrepancias);

  if (total === 0) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="Esta carga no tiene diferencias"
          detalle="Los dos conteos coincidieron."
          textoBoton="Volver al inicio"
          onPress={() => router.replace('/')}
        />
      </SafeAreaView>
    );
  }

  if (enAutorizacion || resueltas === total) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoCentral
          titulo="Diferencias resueltas"
          detalle="La carga pasó a esperar la autorización del supervisor. Aquí ya no queda nada por hacer."
          textoBoton="Volver al inicio"
          onPress={() => router.replace('/')}
          exito
        />
      </SafeAreaView>
    );
  }

  const faltan = total - resueltas;
  const editada = edicion ? discrepancias.find((d) => d.code === edicion.code) : undefined;

  const teclado =
    edicion?.tecladoAbierto && editada ? (
      <TecladoCantidad
        producto={editada.producto}
        campo={edicion.campo}
        texto={edicion.texto}
        reemplazar={edicion.reemplazar}
        captura={capturaVisible(edicion)}
        etiquetaSiguiente={edicion.campo === 'paquetes' ? 'Sueltas ›' : capturar.isPending ? 'Guardando…' : 'Guardar'}
        lateral={esTablet}
        onDigito={alDigito}
        onBorrar={alBorrar}
        onSiguiente={alSiguiente}
        onListo={cerrarTeclado}
      />
    ) : null;

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.encabezado}>
        <View style={estilos.filaEncabezado}>
          <Pressable
            onPress={volver}
            accessibilityRole="button"
            accessibilityLabel="Volver al inicio"
            hitSlop={ESPACIADO.sm}
            style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
          >
            {({ pressed }) => <Text style={[estilos.textoVolver, pressed && estilos.textoInvertido]}>‹</Text>}
          </Pressable>
          <View style={estilos.titulos}>
            <Text style={estilos.titulo} accessibilityRole="header" numberOfLines={1}>
              Diferencias por resolver
            </Text>
            <Text style={estilos.subtitulo} accessibilityLiveRegion="polite">
              {faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`} de {total}
            </Text>
          </View>
        </View>
        <View style={estilos.barra} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: resueltas }}>
          <View style={[estilos.rellenoBarra, { width: `${(resueltas / total) * 100}%` }]} />
        </View>
      </View>

      <View style={[estilos.cuerpo, esTablet && estilos.cuerpoTablet]}>
        <ScrollView
          ref={lista}
          style={estilos.lista}
          contentContainerStyle={estilos.contenidoLista}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={estilos.instruccion}>
            Una persona captura la cantidad final y otra distinta la confirma con su propio PIN.
          </Text>
          {discrepancias.map((d) => (
            <View key={d.code} onLayout={(e) => posiciones.current.set(d.code, e.nativeEvent.layout.y)}>
              <TarjetaDiscrepancia
                discrepancia={d}
                usuarioId={usuarioId}
                edicion={edicion?.code === d.code ? edicion : null}
                ocupado={capturar.isPending && capturar.variables?.productoCode === d.code}
                bloqueada={edicion !== null && edicion.code !== d.code}
                error={errores[d.code] ?? null}
                onCapturar={() => empezarCaptura(d)}
                onAbrirCampo={(campo) => edicion && abrirCampo(d.code, campo, capturaVisible(edicion))}
                onGuardar={() => edicion && guardar(d, capturaVisible(edicion))}
                onCancelar={cancelar}
                onConfirmar={() => {
                  fijarError(d.code, null);
                  setAConfirmar(d);
                }}
              />
            </View>
          ))}
        </ScrollView>

        {esTablet ? (
          <View style={estilos.lateral}>
            {teclado ?? (
              <View style={estilos.lateralVacio}>
                <Text style={estilos.textoLateralVacio}>Toca «Capturar cantidad final» en una diferencia.</Text>
              </View>
            )}
          </View>
        ) : (
          teclado
        )}
      </View>

      <ModalConfirmar
        eventoId={eventoId}
        discrepancia={aConfirmar}
        onCerrar={() => setAConfirmar(null)}
        onConfirmada={(ultima) => {
          setAConfirmar(null);
          if (ultima) setEnAutorizacion(true);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------

interface PropsTarjeta {
  discrepancia: Discrepancia;
  usuarioId: string | null;
  edicion: Edicion | null;
  ocupado: boolean;
  /** Se captura otra tarjeta: una a la vez. */
  bloqueada: boolean;
  error: string | null;
  onCapturar: () => void;
  onAbrirCampo: (campo: CampoCaptura) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}

const COLOR_ESTADO = {
  'sin-capturar': COLORES.discrepancia,
  'por-confirmar': COLORES.discrepancia,
  confirmada: COLORES.capturado,
} as const;

function TarjetaDiscrepancia({
  discrepancia: d,
  usuarioId,
  edicion,
  ocupado,
  bloqueada,
  error,
  onCapturar,
  onAbrirCampo,
  onGuardar,
  onCancelar,
  onConfirmar,
}: PropsTarjeta) {
  const estado = estadoDe(d);
  const soyQuienCapturo = d.capturadaPor !== null && d.capturadaPor === usuarioId;

  return (
    <View style={[estilos.tarjeta, estado === 'confirmada' && estilos.tarjetaConfirmada]}>
      <View style={[estilos.barraEstado, { backgroundColor: COLOR_ESTADO[estado] }]} />
      <View style={estilos.cuerpoTarjeta}>
        <View style={estilos.lineaProducto}>
          <EtiquetaFactor producto={d.producto} grande />
          <Text style={estilos.nombreProducto} numberOfLines={2}>
            {d.producto.nombre}
          </Text>
        </View>

        <View style={estilos.conteos}>
          <RenglonConteo etiqueta={etiquetaRol(d.primerConteo, 'Primer conteo')} lado={d.primerConteo} d={d} />
          <RenglonConteo etiqueta={etiquetaRol(d.segundoConteo, 'Segundo conteo')} lado={d.segundoConteo} d={d} />
          <View
            style={[estilos.renglon, estilos.renglonDiferencia]}
            accessible
            accessibilityLabel={`Diferencia: ${vozCantidad(diferencia(d), d)}`}
          >
            <Text style={[estilos.rolRenglon, estilos.textoDiferencia]}>Diferencia</Text>
            <View style={estilos.columnaCantidad}>
              <Text style={[estilos.cantidadRenglon, estilos.textoDiferencia]}>{enPaquetes(diferencia(d), d)}</Text>
              {totalSecundario(diferencia(d), d) && (
                <Text style={estilos.totalPiezas}>{totalSecundario(diferencia(d), d)}</Text>
              )}
            </View>
          </View>
        </View>

        {edicion ? (
          <EditorCantidad d={d} edicion={edicion} ocupado={ocupado} onAbrirCampo={onAbrirCampo} onGuardar={onGuardar} onCancelar={onCancelar} />
        ) : estado === 'sin-capturar' ? (
          <Boton texto="Capturar cantidad final" principal onPress={onCapturar} deshabilitado={bloqueada} />
        ) : (
          <View style={estilos.final}>
            {d.cantidadFinal !== null && <LineaFinal piezas={d.cantidadFinal} d={d} />}
            {esAtipica(d) && <Text style={estilos.notaAtipica}>No coincide con ninguno de los dos conteos.</Text>}
            {estado === 'confirmada' ? (
              <Text style={estilos.estadoConfirmada}>
                ✓ Capturó {d.capturadaPorNombre ?? 'otra persona'} · confirmó {d.confirmadaPorNombre ?? 'otra persona'}
              </Text>
            ) : (
              <>
                <Text style={estilos.estadoEspera} accessibilityLiveRegion="polite">
                  Esperando confirmación · capturó {soyQuienCapturo ? 'tú' : (d.capturadaPorNombre ?? 'otra persona')}
                </Text>
                {soyQuienCapturo && (
                  <Text style={estilos.aviso}>Otra persona debe confirmarla con su propio PIN.</Text>
                )}
                <View style={estilos.botones}>
                  <Boton texto={soyQuienCapturo ? 'Corregir' : 'No coincide, corregir'} onPress={onCapturar} deshabilitado={bloqueada} />
                  {/* A quien capturó ni se le ofrece: el servidor lo rechazaría igual. */}
                  {puedeConfirmar(d, usuarioId) && (
                    <Boton texto="Confirmar con mi PIN" principal onPress={onConfirmar} deshabilitado={bloqueada} />
                  )}
                </View>
              </>
            )}
          </View>
        )}

        {error && (
          <Text style={estilos.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

/** "Vendedor   5 paquetes y 2 piezas": en la unidad en que se contó, sin dividir de cabeza. */
function RenglonConteo({ etiqueta, lado, d }: { etiqueta: string; lado: ConteoLado; d: Discrepancia }) {
  return (
    <View style={estilos.renglon} accessible accessibilityLabel={`${etiqueta}: ${vozCantidad(lado.piezas, d)}`}>
      <Text style={estilos.rolRenglon} numberOfLines={1}>
        {etiqueta}
      </Text>
      <View style={estilos.columnaCantidad}>
        <Text style={estilos.cantidadRenglon}>{enPaquetes(lado.piezas, d)}</Text>
      </View>
    </View>
  );
}

/** "Cantidad final  3 paquetes y 2 piezas  (20 piezas)". */
function LineaFinal({ piezas, d }: { piezas: number; d: Discrepancia }) {
  const total = totalSecundario(piezas, d);
  return (
    <View style={estilos.lineaFinal} accessible accessibilityLabel={`Cantidad final: ${vozCantidad(piezas, d)}`}>
      <Text style={estilos.etiquetaFinal}>Cantidad final</Text>
      <Text style={estilos.valorFinal}>{enPaquetes(piezas, d)}</Text>
      {total && <Text style={estilos.piezasFinal}>{total}</Text>}
    </View>
  );
}

function EditorCantidad({
  d,
  edicion,
  ocupado,
  onAbrirCampo,
  onGuardar,
  onCancelar,
}: {
  d: Discrepancia;
  edicion: Edicion;
  ocupado: boolean;
  onAbrirCampo: (campo: CampoCaptura) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const captura = capturaVisible(edicion);
  const total = totalPiezas(captura, factorEfectivo(d.producto));
  const campos: CampoCaptura[] = admitePaquetes(d.producto) ? ['paquetes', 'sueltas'] : ['sueltas'];

  return (
    <View style={estilos.editor}>
      <Text style={estilos.etiquetaFinal}>Cantidad final</Text>
      <View style={estilos.camposEditor}>
        {campos.map((campo) => {
          const activo = edicion.tecladoAbierto && edicion.campo === campo;
          const valor = captura[campo];
          return (
            <Pressable
              key={campo}
              onPress={() => onAbrirCampo(campo)}
              accessibilityRole="button"
              accessibilityLabel={`${campo === 'paquetes' ? 'Paquetes' : 'Sueltas'}: ${valor ?? 'sin capturar'}`}
              style={[estilos.campoEditor, activo && estilos.campoEditorActivo]}
            >
              <Text style={estilos.etiquetaCampo}>{campo === 'paquetes' ? 'Paquetes' : 'Sueltas'}</Text>
              <Text style={estilos.valorCampo}>{valor ?? '—'}</Text>
            </Pressable>
          );
        })}
        <Text style={estilos.totalEditor}>{total === null ? '' : `= ${total} pzas`}</Text>
      </View>
      <View style={estilos.botones}>
        <Boton texto="Cancelar" onPress={onCancelar} deshabilitado={ocupado} />
        <Boton texto={ocupado ? 'Guardando…' : 'Guardar'} principal onPress={onGuardar} deshabilitado={ocupado || total === null} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Confirmación con PIN (paso B)
// ---------------------------------------------------------------------------

type AvisoConfirmar =
  | { tipo: 'pin'; mensaje: string }
  /** No hay nada más que teclear: bloqueo, autoconfirmación o la cantidad cambió. */
  | { tipo: 'definitivo'; mensaje: string }
  | { tipo: 'red' };

interface PropsModalConfirmar {
  eventoId: string;
  discrepancia: Discrepancia | null;
  onCerrar: () => void;
  onConfirmada: (ultima: boolean) => void;
}

/**
 * Mismo teclado e indicadores que el login. Muestra lo que se confirma (la
 * cantidad y quién la capturó) y la manda junto con el PIN: si alguien la
 * recapturó mientras tanto, el servidor rechaza en vez de confirmar otra.
 */
function ModalConfirmar({ eventoId, discrepancia: d, onCerrar, onConfirmada }: PropsModalConfirmar) {
  const confirmar = useConfirmarDiscrepancia(eventoId);
  const pinRef = useRef('');
  const [cantidad, setCantidad] = useState(0);
  const [claveError, setClaveError] = useState(0);
  const [aviso, setAviso] = useState<AvisoConfirmar | null>(null);

  const enviando = confirmar.isPending;
  const definitivo = aviso?.tipo === 'definitivo';

  const limpiarPin = () => {
    pinRef.current = '';
    setCantidad(0);
  };

  const cerrar = () => {
    if (enviando) return;
    limpiarPin();
    setAviso(null);
    onCerrar();
  };

  const enviar = (pin: string) => {
    if (!d || d.cantidadFinal === null) return;
    confirmar.mutate(
      { productoCode: d.code, cantidadFinal: d.cantidadFinal, pin },
      {
        onSuccess: (respuesta) => {
          limpiarPin();
          setAviso(null);
          onConfirmada(respuesta?.enEsperaAutorizacion === true);
        },
        onError: (e) => {
          limpiarPin();
          if (e instanceof ErrorRed) {
            setAviso({ tipo: 'red' });
            return;
          }
          if (e instanceof ErrorApi) {
            if (e.estado === 401) {
              void cerrarSesion().then(() => router.replace('/login'));
              return;
            }
            // El mensaje del servidor tal cual: dice exactamente qué pasó.
            if (e.cuerpo?.codigo === 'PIN_INCORRECTO') {
              setClaveError((c) => c + 1);
              setAviso({ tipo: 'pin', mensaje: e.message });
              return;
            }
          }
          setAviso({ tipo: 'definitivo', mensaje: e.message || 'No se pudo confirmar.' });
        },
      },
    );
  };

  const alDigito = (digito: string) => {
    if (enviando || definitivo || pinRef.current.length >= LONGITUD_PIN) return;
    const nuevo = pinRef.current + digito;
    pinRef.current = nuevo;
    setCantidad(nuevo.length);
    if (aviso?.tipo !== 'pin') setAviso(null);
    if (nuevo.length === LONGITUD_PIN) enviar(nuevo);
  };

  const alBorrar = () => {
    if (enviando || definitivo) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setCantidad(pinRef.current.length);
  };

  return (
    <Modal visible={d !== null} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondoModal}>
        <ScrollView contentContainerStyle={estilos.contenidoFondoModal} bounces={false}>
          <View style={[estilos.modal, estilos.modalPin]}>
            <Text style={estilos.tituloModal} accessibilityRole="header">
              Confirma con tu PIN
            </Text>
            {d && (
              <View style={estilos.resumenConfirmar}>
                <View style={estilos.lineaProducto}>
                  <EtiquetaFactor producto={d.producto} />
                  <Text style={estilos.nombreProductoModal} numberOfLines={2}>
                    {d.producto.nombre}
                  </Text>
                </View>
                {d.cantidadFinal !== null && <LineaFinal piezas={d.cantidadFinal} d={d} />}
                <Text style={estilos.detalleModal}>Capturó {d.capturadaPorNombre ?? 'otra persona'}. Al confirmar respaldas esta cantidad.</Text>
              </View>
            )}

            <View style={estilos.zonaIndicadores}>
              <IndicadoresPin cantidad={cantidad} claveError={claveError} />
              <View style={estilos.zonaAviso} accessibilityLiveRegion="polite">
                {enviando ? (
                  <Text style={estilos.textoVerificando}>Verificando…</Text>
                ) : aviso?.tipo === 'pin' ? (
                  <Text style={estilos.error} accessibilityRole="alert">
                    {aviso.mensaje}
                  </Text>
                ) : aviso?.tipo === 'red' ? (
                  <Text style={estilos.avisoRed} accessibilityRole="alert">
                    Sin conexión con el servidor: tu PIN no se llegó a revisar. Vuelve a teclearlo cuando haya señal.
                  </Text>
                ) : null}
              </View>
            </View>

            {definitivo ? (
              // Ocupa el lugar del teclado: no hay nada que teclear.
              <View style={estilos.panelDefinitivo} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Text style={estilos.textoDefinitivo}>{aviso.mensaje}</Text>
              </View>
            ) : (
              <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando} />
            )}

            <View style={estilos.botones}>
              <Boton texto={definitivo ? 'Cerrar' : 'Cancelar'} onPress={cerrar} deshabilitado={enviando} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function Boton({
  texto,
  onPress,
  principal = false,
  deshabilitado = false,
}: {
  texto: string;
  onPress: () => void;
  principal?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.boton,
        principal && estilos.botonPrincipal,
        pressed && estilos.botonPresionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {({ pressed }) => <Text style={[estilos.textoBoton, (principal || pressed) && estilos.textoInvertido]}>{texto}</Text>}
    </Pressable>
  );
}

function EstadoCentral({
  titulo,
  detalle,
  textoBoton,
  onPress,
  textoSecundario,
  onSecundario,
  exito = false,
}: {
  titulo: string;
  detalle: string;
  textoBoton: string;
  onPress: () => void;
  textoSecundario?: string;
  onSecundario?: () => void;
  exito?: boolean;
}) {
  return (
    <View style={estilos.centrado}>
      <Text style={[estilos.tituloModal, estilos.textoCentrado, exito && estilos.tituloExito]} accessibilityRole="header">
        {exito ? '✓ ' : ''}
        {titulo}
      </Text>
      <Text style={[estilos.detalleModal, estilos.textoCentrado]}>{detalle}</Text>
      <View style={[estilos.botones, estilos.botonCentral]}>
        {textoSecundario && onSecundario && <Boton texto={textoSecundario} onPress={onSecundario} />}
        <Boton texto={textoBoton} onPress={onPress} principal />
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
    maxWidth: 420,
    width: '100%',
    marginTop: ESPACIADO.md,
    alignItems: 'stretch',
  },
  tituloExito: {
    color: COLORES.capturado,
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
  subtitulo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.discrepancia,
  },
  barra: {
    height: 10,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.completo,
    overflow: 'hidden',
  },
  rellenoBarra: {
    height: '100%',
    backgroundColor: COLORES.capturado,
  },

  // Cuerpo
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
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.md,
    paddingBottom: ESPACIADO.xxxl,
  },
  instruccion: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    borderLeftWidth: 2,
    borderLeftColor: COLORES.texto,
  },
  lateralVacio: {
    flex: 1,
    justifyContent: 'center',
    padding: ESPACIADO.xl,
  },
  textoLateralVacio: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },

  // Tarjeta
  tarjeta: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
    overflow: 'hidden',
    backgroundColor: COLORES.fondo,
  },
  tarjetaConfirmada: {
    borderColor: COLORES.borde,
  },
  barraEstado: {
    width: ANCHO_BARRA_ESTADO,
  },
  cuerpoTarjeta: {
    flex: 1,
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
  },
  lineaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  nombreProducto: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  // Tabla de dos columnas: rol · cantidad en paquetes.
  conteos: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.md,
  },
  renglon: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
  },
  renglonDiferencia: {
    marginTop: ESPACIADO.xs,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  rolRenglon: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  columnaCantidad: {
    flex: 2,
    alignItems: 'flex-end',
  },
  cantidadRenglon: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  totalPiezas: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  textoDiferencia: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.discrepancia,
  },
  final: {
    gap: ESPACIADO.sm,
    paddingTop: ESPACIADO.sm,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  lineaFinal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: ESPACIADO.sm,
  },
  etiquetaFinal: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textTransform: 'uppercase',
  },
  valorFinal: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    fontVariant: ['tabular-nums'],
  },
  piezasFinal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
    fontVariant: ['tabular-nums'],
  },
  // Discreta a propósito: es un dato, no un error.
  notaAtipica: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  estadoEspera: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.discrepancia,
  },
  estadoConfirmada: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.capturado,
  },
  aviso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  error: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
    textAlign: 'center',
  },

  // Editor
  editor: {
    gap: ESPACIADO.sm,
    paddingTop: ESPACIADO.sm,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  camposEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  campoEditor: {
    minWidth: 96,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    borderWidth: 2,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
  },
  campoEditorActivo: {
    borderColor: COLORES.texto,
    borderWidth: 3,
  },
  etiquetaCampo: {
    fontSize: TIPOGRAFIA.tamanos.xs,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  valorCampo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  totalEditor: {
    flexShrink: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    fontVariant: ['tabular-nums'],
  },

  // Botones
  botones: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
  },
  boton: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPrincipal: {
    backgroundColor: COLORES.texto,
  },
  botonPresionado: {
    backgroundColor: COLORES.textoSecundario,
    borderColor: COLORES.textoSecundario,
  },
  textoBoton: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },

  // Modal de confirmación
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  contenidoFondoModal: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: ESPACIADO.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.lg,
  },
  modalPin: {
    maxWidth: 440,
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
  resumenConfirmar: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.md,
  },
  nombreProductoModal: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  zonaIndicadores: {
    alignItems: 'center',
    gap: ESPACIADO.md,
  },
  // Altura reservada: un aviso no debe mover el teclado bajo el dedo.
  zonaAviso: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVerificando: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  avisoRed: {
    paddingVertical: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
    borderRadius: RADIOS.md,
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
    textAlign: 'center',
  },
  panelDefinitivo: {
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.error,
    borderRadius: RADIOS.md,
  },
  textoDefinitivo: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSobreColor,
    textAlign: 'center',
  },
});
