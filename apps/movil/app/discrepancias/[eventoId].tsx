import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { ETIQUETAS_TIPO_CARGA, esTipoCarga } from '../../src/api/cargas';
import {
  useCapturarDiscrepancia,
  useConfirmarDiscrepancia,
  useContextoResolucion,
  useDiscrepancias,
  type ContextoResolucion,
} from '../../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion } from '../../src/api/sesion';
import {
  BarraAvance,
  BloqueError,
  Boton,
  Datos,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  Glifo,
  Hoja,
  LineaEsqueleto,
  Personas,
  Pulsable,
  Tarjeta,
  TarjetaEsqueleto,
  PanelEncabezado,
} from '../../src/componentes/base';
import { sentir } from '../../src/theme/tacto';
import { IndicadoresPin, LONGITUD_PIN } from '../../src/componentes/IndicadoresPin';
import { TecladoPin } from '../../src/componentes/TecladoPin';
import {
  admitePaquetes,
  camposDe,
  admiteSueltas,
  factorEfectivo,
  primerCampo,
  seVendeCompleto,
  totalPiezas,
  unidadCompleta,
  type CampoCaptura,
  type CapturaProducto,
} from '../../src/conteo/estado-conteo';
import { formatearNombreProducto } from '../../src/conteo/formato-nombre';
import { EtiquetaFactor, nombreCampo } from '../../src/conteo/FilaProducto';
import { formatearEnPaquetes, formatearPiezas, formatearTotalPiezas } from '../../src/conteo/formato-cantidad';
import { TecladoCantidad } from '../../src/conteo/TecladoCantidad';
import { diaDesdeApi, diaNegocio, textoSalidaCorta } from '../../src/conteo/fecha-operativa';
import {
  candidatosConfirmar,
  confirmadorInicial,
  nombreCorto,
  type Participante,
} from '../../src/discrepancias/quien-confirma';
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
import {
  BORDES,
  CIFRAS,
  COLORES,
  ESCALA_TEXTO,
  ANCHO_MAXIMO_LISTA,
  ESPACIADO,
  ETIQUETA_DATO,
  FUENTE,
  ONDA,
  RADIOS,
  RITMO,
  ROTULO,
  TIPOGRAFIA,
  TONOS,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';
import type { ColorEstado } from '../../src/theme/tokens';

/** Igual que en el conteo: 9999 ya es un error de dedo. */
const MAX_DIGITOS = 4;
const ANCHO_TECLADO_LATERAL = 380;
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

/** En la unidad en que se cuenta en bodega; sin factor confirmado, en piezas; completo, en su unidad. */
function enPaquetes(piezas: number, d: Discrepancia): string {
  return formatearEnPaquetes(piezas, factorEfectivo(d.producto), unidadCompleta(d.producto));
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
  const params = useLocalSearchParams<{ eventoId: string; desdeConteo?: string }>();
  const eventoId = parametro(params.eventoId);
  const desdeConteo = parametro(params.desdeConteo) === '1';

  if (!eventoId) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="lista"
          titulo="No se encontró la carga"
          detalle="Vuelve al inicio y entra otra vez desde el acceso a las diferencias por resolver."
          accion={{ texto: 'Volver al inicio', onPress: () => router.replace('/') }}
        />
      </SafeAreaView>
    );
  }

  return <Resolucion eventoId={eventoId} desdeConteo={desdeConteo} />;
}

function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** "Ruta 3" / "Carga inicial · Sale mañana, mar 29 de septiembre": de qué carga se trata. */
function subtituloCarga(contexto: ContextoResolucion | undefined): string | null {
  if (!contexto) return null;
  const tipo = contexto.tipo && esTipoCarga(contexto.tipo) ? ETIQUETAS_TIPO_CARGA[contexto.tipo] : null;
  const dia = diaDesdeApi(contexto.fechaOperativa);
  const salida = dia ? textoSalidaCorta(dia, diaNegocio(new Date())) : null;
  return [tipo, salida].filter(Boolean).join(' · ') || null;
}

/** "Irvin (vendedor) · Juan (contador)": quiénes contaron, que son quienes resuelven. */
function lineaPersonas(participantes: readonly Participante[]): string | null {
  if (participantes.length === 0) return null;
  return participantes
    .map((p) => {
      const rol = etiquetaRol({ tipoSesion: p.tipoSesion, piezas: 0, paquetes: null, sueltas: null }, '');
      return rol ? `${nombreCorto(p.nombre)} (${rol.toLowerCase()})` : nombreCorto(p.nombre);
    })
    .join(' · ');
}

function Resolucion({ eventoId, desdeConteo }: { eventoId: string; desdeConteo: boolean }) {
  const { esTablet, tecladoLateral } = useLayout();
  const consulta = useDiscrepancias(eventoId);
  const contexto = useContextoResolucion(eventoId);
  const contaron = contexto.data?.participantes ?? [];
  const rutaNombre = contexto.data?.rutaNombre?.trim() || null;
  const capturar = useCapturarDiscrepancia(eventoId);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [usuarioNombre, setUsuarioNombre] = useState<string | null>(null);
  // Quien tiene la sesión siempre puede confirmar desde ella (entre dispositivos),
  // haya contado o no esta carga: se suma a la lista si no está.
  const participantes = useMemo(
    () =>
      usuarioId && !contaron.some((p) => p.id === usuarioId)
        ? [...contaron, { id: usuarioId, nombre: usuarioNombre ?? 'Tú', tipoSesion: null }]
        : contaron,
    [contaron, usuarioId, usuarioNombre],
  );
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
      if (!vigente) return;
      setUsuarioId(sesion?.id ?? null);
      setUsuarioNombre(sesion?.nombreCompleto ?? null);
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
    abrirCampo(d.code, primerCampo(d.producto), capturaInicial(d));
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
    const piezas = totalPiezas(captura, d.producto);
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
    const d = discrepancias.find((x) => x.code === actual.code);
    // Mismo ritmo que el conteo: con paquetes tecleados se guarda (las sueltas vacías son 0).
    if (actual.campo === 'paquetes' && actual.texto === '' && d && admiteSueltas(d.producto)) {
      abrirCampo(actual.code, 'sueltas', asentada.captura);
      return;
    }
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
      <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
        <Encabezado variante="marca" titulo="Diferencias por resolver" onVolver={volver} etiquetaVolver="Volver al inicio" />
        <Esqueleto etiqueta="Cargando diferencias" style={estilos.contenidoLista}>
          {[0, 1].map((i) => (
            <View key={i} style={estilos.tarjetaEsqueleto}>
              <LineaEsqueleto nivel="etiqueta" ancho="35%" />
              <TarjetaEsqueleto titulo="subtitulo" lineas={['80%', '80%', '60%']} />
            </View>
          ))}
        </Esqueleto>
      </SafeAreaView>
    );
  }

  if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <SafeAreaView style={estilos.pantalla}>
        <View style={estilos.contenedorAviso}>
          <BloqueError
            titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar las diferencias'}
            detalle={
              sinRed
                ? 'Resolver diferencias necesita señal: cada paso se registra en el servidor.'
                : consulta.error.message || 'Intenta de nuevo en un momento.'
            }
            tono={sinRed ? 'atencion' : 'error'}
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
            secundaria={{ texto: 'Volver', onPress: volver }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { resueltas, total } = progresoResolucion(discrepancias);

  if (total === 0) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="listo"
          tono="capturado"
          titulo="Esta carga no tiene diferencias"
          detalle="Los dos conteos coincidieron producto por producto: no hay nada que resolver."
          accion={{ texto: 'Volver al inicio', onPress: () => router.replace('/') }}
        />
      </SafeAreaView>
    );
  }

  if (enAutorizacion || resueltas === total) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <EstadoVacio
          icono="listo"
          tono="capturado"
          titulo="Diferencias resueltas"
          detalle="La carga pasó a esperar la autorización del supervisor. Aquí ya no queda nada por hacer."
          accion={{ texto: 'Volver al inicio', onPress: () => router.replace('/') }}
        />
      </SafeAreaView>
    );
  }

  const faltan = total - resueltas;
  const editada = edicion ? discrepancias.find((d) => d.code === edicion.code) : undefined;
  const personas = lineaPersonas(contaron);
  // Una sola acción azul en la pantalla: la de la primera diferencia que falta.
  const enFoco = discrepancias.find((d) => estadoDe(d) !== 'confirmada')?.code ?? null;
  // La explicación de cómo se resuelve solo mientras nadie ha empezado.
  const nadieHaCapturado = discrepancias.every((d) => estadoDe(d) === 'sin-capturar');
  const otraPersona = contaron.find((p) => p.id !== usuarioId) ?? null;

  const teclado =
    edicion?.tecladoAbierto && editada ? (
      <TecladoCantidad
        producto={editada.producto}
        campo={edicion.campo}
        texto={edicion.texto}
        reemplazar={edicion.reemplazar}
        captura={capturaVisible(edicion)}
        camposDisponibles={camposDe(editada.producto)}
        onCambiarCampo={(campo) => abrirCampo(edicion.code, campo, asentar(edicion).captura)}
        etiquetaSiguiente={
          edicion.campo === 'paquetes' && edicion.texto === '' && admiteSueltas(editada.producto)
            ? 'Sueltas'
            : capturar.isPending
              ? 'Guardando…'
              : 'Guardar'
        }
        siguienteConChevron={edicion.campo === 'paquetes' && edicion.texto === '' && admiteSueltas(editada.producto)}
        lateral={tecladoLateral}
        teclasGrandes={esTablet}
        areaSegura={!tecladoLateral}
        onDigito={alDigito}
        onBorrar={alBorrar}
        onSiguiente={alSiguiente}
        onListo={cerrarTeclado}
      />
    ) : null;

  return (
    // Con el teclado abajo, él absorbe el área segura; si no, la pantalla.
    <SafeAreaView style={estilos.pantalla} edges={teclado && !tecladoLateral ? ['left', 'right'] : ['left', 'right', 'bottom']}>
      <Encabezado
        variante="marca"
        titulo={rutaNombre ? `Diferencias · ${rutaNombre}` : 'Diferencias por resolver'}
        subtitulo={subtituloCarga(contexto.data)}
        onVolver={volver}
        etiquetaVolver="Volver al inicio"
        inferior={
          <PanelEncabezado>
            <Text
              style={estilos.progreso}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${resueltas} de ${total} resueltas`}
            >
              <Text style={estilos.numeroProgreso}>{resueltas}</Text>
              {` de ${total} ${total === 1 ? 'resuelta' : 'resueltas'}`}
            </Text>
            <BarraAvance actual={resueltas} total={total} />
          </PanelEncabezado>
        }
      >
        {personas && (
          <View style={estilos.lineaPersonas} accessible accessibilityLabel={`Contaron ${personas}`}>
            <Glifo nombre="personas" color={COLORES.marcaTenue} tamano={ESPACIADO.md + ESPACIADO.xs} />
            <Text style={estilos.textoPersonas} numberOfLines={1} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
              {personas}
            </Text>
          </View>
        )}
      </Encabezado>
      {/* Trabajo pendiente: en pastilla tintada, no en texto gris. */}
      <View style={estilos.faltan}>
        <Etiqueta
          texto={faltan === 1 ? 'Falta 1 diferencia por resolver' : `Faltan ${faltan} diferencias por resolver`}
          tono="discrepancia"
        />
      </View>

      <View style={[estilos.cuerpo, tecladoLateral && estilos.cuerpoTablet]}>
        <ScrollView
          ref={lista}
          style={estilos.lista}
          contentContainerStyle={estilos.contenidoLista}
          keyboardShouldPersistTaps="handled"
        >
          {nadieHaCapturado && (
            <PasosCruzados
              titulo={
                desdeConteo
                  ? `${otraPersona ? `Tu conteo y el de ${nombreCorto(otraPersona.nombre)}` : 'Los dos conteos'} no coinciden en ${total} ${total === 1 ? 'producto' : 'productos'}. Resuélvanlo juntos.`
                  : null
              }
            />
          )}
          {discrepancias.map((d) => (
            <View key={d.code} onLayout={(e) => posiciones.current.set(d.code, e.nativeEvent.layout.y)}>
              <TarjetaDiscrepancia
                discrepancia={d}
                usuarioId={usuarioId}
                enFoco={enFoco === d.code}
                candidatos={candidatosConfirmar(participantes, d.capturadaPor, usuarioId)}
                rutaNombre={rutaNombre}
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

        {tecladoLateral ? (
          <View style={estilos.lateral}>
            {teclado ?? (
              <View style={estilos.lateralVacio}>
                <Glifo nombre="caja" color={COLORES.textoSecundario} tamano={ESPACIADO.xxxl} />
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
        candidatos={aConfirmar ? candidatosConfirmar(participantes, aConfirmar.capturadaPor, usuarioId) : []}
        usuarioSesionId={usuarioId}
        usuarioSesionNombre={usuarioNombre}
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

/**
 * La regla, como dos pasos con su número: la secuencia ES la regla (primero
 * uno captura, después otro confirma). Neutra: no es un estado, es cómo se hace.
 */
function PasosCruzados({ titulo }: { titulo: string | null }) {
  return (
    <View
      style={estilos.pasos}
      accessible
      accessibilityLabel={`${titulo ? `${titulo} ` : ''}Cómo se resuelve: 1, una persona captura la cantidad final. 2, otra persona distinta la confirma con su propio PIN, aquí mismo o en su teléfono.`}
    >
      {titulo && <Text style={estilos.tituloPasos}>{titulo}</Text>}
      <Paso numero="1" titulo="Una persona captura" detalle="la cantidad final, tras recontar." />
      <Paso numero="2" titulo="Otra persona confirma" detalle="con su propio PIN, aquí mismo o en su teléfono. Nunca la misma." />
    </View>
  );
}

function Paso({ numero, titulo, detalle }: { numero: string; titulo: string; detalle: string }) {
  return (
    <View style={estilos.paso}>
      <View style={estilos.numeroPaso}>
        <Text style={estilos.textoNumeroPaso} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
          {numero}
        </Text>
      </View>
      <Text style={estilos.textoPaso}>
        <Text style={estilos.tituloPaso}>{titulo} </Text>
        {detalle}
      </Text>
    </View>
  );
}

interface PropsTarjeta {
  discrepancia: Discrepancia;
  usuarioId: string | null;
  /** La primera diferencia que falta: la única con la acción en azul. */
  enFoco: boolean;
  /** Quiénes pueden confirmar en este teléfono (sin quien capturó). */
  candidatos: readonly Participante[];
  rutaNombre: string | null;
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

/** Banda de la tarjeta: ámbar mientras falte algo, verde al quedar confirmada. */
const BANDA_ESTADO: Record<ReturnType<typeof estadoDe>, { titulo: string; tono: ColorEstado }> = {
  'sin-capturar': { titulo: 'Sin cantidad final', tono: 'discrepancia' },
  'por-confirmar': { titulo: 'Espera confirmación', tono: 'discrepancia' },
  confirmada: { titulo: 'Confirmada', tono: 'capturado' },
};

function TarjetaDiscrepancia({
  discrepancia: d,
  usuarioId,
  enFoco,
  candidatos,
  rutaNombre,
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
  const variante = enFoco ? 'primario' : 'secundario';
  // Quien confirmaría si no soy yo: nombrarla dice a quién pasarle el teléfono.
  const otros = candidatos.filter((p) => p.id !== usuarioId);
  const otro = otros.length === 1 ? nombreCorto(otros[0].nombre) : null;
  const dondeInicio = rutaNombre ? `en su Inicio, en «Resolver diferencias» de ${rutaNombre}` : 'en su Inicio, en «Resolver diferencias»';

  return (
    <Tarjeta conAcento={BANDA_ESTADO[estado]} style={estilos.tarjeta}>
      <View style={estilos.lineaProducto}>
        <EtiquetaFactor producto={d.producto} />
        <Text style={estilos.nombreProducto} numberOfLines={2}>
          {formatearNombreProducto(d.producto.nombre)}
        </Text>
      </View>

      <View style={estilos.comparacion}>
        <View style={estilos.ladosConteo}>
          <LadoConteo etiqueta={etiquetaRol(d.primerConteo, 'Primer conteo')} lado={d.primerConteo} d={d} />
          <LadoConteo etiqueta={etiquetaRol(d.segundoConteo, 'Segundo conteo')} lado={d.segundoConteo} d={d} />
        </View>
        <FranjaDiferencia d={d} />
      </View>

      {edicion ? (
        <EditorCantidad d={d} edicion={edicion} ocupado={ocupado} onAbrirCampo={onAbrirCampo} onGuardar={onGuardar} onCancelar={onCancelar} />
      ) : estado === 'sin-capturar' ? (
        <Boton texto="Capturar cantidad final" variante={variante} onPress={onCapturar} deshabilitado={bloqueada} />
      ) : (
        <View style={estilos.final}>
          {d.cantidadFinal !== null && (
            <LineaFinal piezas={d.cantidadFinal} d={d} confirmada={estado === 'confirmada'} />
          )}
          {esAtipica(d) && <Text style={estilos.notaAtipica}>No coincide con ninguno de los dos conteos.</Text>}
          {estado === 'confirmada' ? (
            <Personas
              personas={[
                { rol: 'Capturó', nombre: d.capturadaPorNombre ?? 'otra persona' },
                { rol: 'Confirmó', nombre: d.confirmadaPorNombre ?? 'otra persona' },
              ]}
            />
          ) : (
            <>
              <Datos
                datos={[
                  { rotulo: 'Capturó', valor: soyQuienCapturo ? 'Tú' : (d.capturadaPorNombre ?? 'otra persona') },
                  {
                    rotulo: 'Confirma',
                    valor: puedeConfirmar(d, usuarioId) ? 'Tú, con tu PIN' : null,
                    ausente: otro ? `${otro}, con su PIN` : 'Otra persona',
                  },
                ]}
              />
              {soyQuienCapturo && (
                <View style={estilos.avisoCruzado}>
                  <Glifo nombre="personas" color={COLORES.discrepanciaTexto} tamano={ESPACIADO.xl - ESPACIADO.xs} />
                  <Text style={estilos.textoAvisoCruzado}>
                    Tú la capturaste, así que no puedes confirmarla. {otro ?? 'Otra persona'} la confirma con su propio PIN:
                    aquí mismo, pasándole el teléfono, o desde su teléfono, {dondeInicio}.
                  </Text>
                </View>
              )}
              <View style={estilos.botones}>
                <Boton
                  texto={soyQuienCapturo ? 'Corregir' : 'No coincide, corregir'}
                  variante="secundario"
                  onPress={onCapturar}
                  deshabilitado={bloqueada}
                  style={estilos.botonFila}
                />
                {/* A quien capturó no se le ofrece confirmar él: sí pasar el teléfono. El servidor valida igual. */}
                {puedeConfirmar(d, usuarioId) ? (
                  <Boton texto="Confirmar con mi PIN" variante={variante} onPress={onConfirmar} deshabilitado={bloqueada} style={estilos.botonFila} />
                ) : (
                  otros.length > 0 && (
                    <Boton
                      texto={otro ? `Confirma ${otro} aquí` : 'Confirmar aquí'}
                      variante={variante}
                      onPress={onConfirmar}
                      deshabilitado={bloqueada}
                      accessibilityHint="Pásale el teléfono: confirma con su propio PIN"
                      style={estilos.botonFila}
                    />
                  )
                )}
              </View>
            </>
          )}
        </View>
      )}

      {error && <BloqueError titulo="No se guardó la cantidad" detalle={error} />}
    </Tarjeta>
  );
}

/** "Vendedor contó más": el signo de la diferencia, dicho en palabras. */
function quienContoMas(d: Discrepancia): string | null {
  const { primerConteo: a, segundoConteo: b } = d;
  if (a.piezas === b.piezas) return null;
  const mayor = a.piezas > b.piezas ? etiquetaRol(a, 'Primer conteo') : etiquetaRol(b, 'Segundo conteo');
  return `${mayor}: más`;
}

/** Un conteo como bloque: quién (el rol) arriba y lo que contó, grande, en la unidad en que se contó. */
function LadoConteo({ etiqueta, lado, d }: { etiqueta: string; lado: ConteoLado; d: Discrepancia }) {
  return (
    <View style={estilos.ladoConteo} accessible accessibilityLabel={`${etiqueta}: ${vozCantidad(lado.piezas, d)}`}>
      <Text style={estilos.rotuloLado} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text style={estilos.valorLado}>{enPaquetes(lado.piezas, d)}</Text>
    </View>
  );
}

/**
 * La diferencia: franja ámbar con su rombo (la forma dice "atención" aunque el
 * sol lave el color), la cifra grande y, en palabras, quién contó más.
 */
function FranjaDiferencia({ d }: { d: Discrepancia }) {
  const detalle = [quienContoMas(d), totalSecundario(diferencia(d), d)].filter(Boolean).join(' · ');
  return (
    <View
      style={estilos.franjaDiferencia}
      accessible
      accessibilityLabel={`Diferencia: ${vozCantidad(diferencia(d), d)}. ${quienContoMas(d) ?? ''}`}
    >
      <View style={estilos.circuloRombo}>
        <Glifo nombre="alerta" color={COLORES.discrepanciaTexto} tamano={ESPACIADO.xl - ESPACIADO.xs} />
      </View>
      <View style={estilos.textosDiferencia}>
        <Text style={estilos.rotuloDiferencia}>Diferencia</Text>
        {detalle ? <Text style={estilos.detalleDiferencia}>{detalle}</Text> : null}
      </View>
      <Text style={estilos.valorDiferencia}>{enPaquetes(diferencia(d), d)}</Text>
    </View>
  );
}

/**
 * "Cantidad final / 3 paquetes y 2 piezas / (20 piezas)": la cifra domina, es
 * lo que se carga al camión. Mientras espera confirmación va en un bloque neutro
 * con contorno punteado (una lectura sin respaldo todavía); confirmada, sólida
 * en verde con su palomita.
 */
function LineaFinal({ piezas, d, confirmada }: { piezas: number; d: Discrepancia; confirmada: boolean }) {
  const colores = confirmada ? TONOS.capturado : { fondo: COLORES.superficie, texto: COLORES.texto };
  const detalle = totalSecundario(piezas, d);
  return (
    <View
      style={[estilos.bloqueFinal, { backgroundColor: colores.fondo }, !confirmada && estilos.bloqueFinalPendiente]}
      accessible
      accessibilityLabel={`Cantidad final${confirmada ? ' confirmada' : ', sin confirmar'}: ${vozCantidad(piezas, d)}`}
    >
      <View style={estilos.cabeceraFinal}>
        <Text style={[estilos.etiquetaFinal, { color: colores.texto }]}>
          {confirmada ? 'Cantidad final confirmada' : 'Cantidad final, sin confirmar'}
        </Text>
        {confirmada && <Glifo nombre="listo" color={COLORES.capturadoHondo} tamano={ESPACIADO.xl - ESPACIADO.xs} />}
      </View>
      <Text style={[estilos.valorFinal, { color: colores.texto }]}>{enPaquetes(piezas, d)}</Text>
      {detalle && <Text style={estilos.detalleFinal}>{detalle}</Text>}
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
  const total = totalPiezas(captura, d.producto);
  const campos = (['paquetes', 'sueltas'] as const).filter((campo) =>
    campo === 'paquetes' ? admitePaquetes(d.producto) : admiteSueltas(d.producto),
  );

  return (
    <View style={estilos.editor}>
      <Text style={estilos.etiquetaFinal}>Cantidad final</Text>
      <View style={estilos.camposEditor}>
        {campos.map((campo) => {
          const activo = edicion.tecladoAbierto && edicion.campo === campo;
          const valor = captura[campo];
          return (
            <Pulsable
              key={campo}
              onPress={() => onAbrirCampo(campo)}
              tacto={null}
              repetible
              accessibilityRole="button"
              accessibilityLabel={`${nombreCampo(d.producto, campo)}: ${valor ?? 'sin capturar'}`}
              style={({ pressed }) => [estilos.campoEditor, (activo || pressed) && estilos.campoEditorActivo]}
            >
              {({ pressed }) => (
                <>
                  <Text style={[estilos.etiquetaCampo, (activo || pressed) && estilos.textoInvertido]}>
                    {nombreCampo(d.producto, campo)}
                  </Text>
                  <Text style={[estilos.valorCampo, (activo || pressed) && estilos.textoInvertido]}>{valor ?? '—'}</Text>
                </>
              )}
            </Pulsable>
          );
        })}
        {/* Lo completo ya está en su unidad: repetir "= 5 cajas" no aclara nada. */}
        <Text style={estilos.totalEditor}>
          {total === null || seVendeCompleto(d.producto) ? '' : `= ${formatearPiezas(total)}`}
        </Text>
      </View>
      <View style={estilos.botones}>
        <Boton texto="Cancelar" variante="secundario" onPress={onCancelar} deshabilitado={ocupado} style={estilos.botonFila} />
        <Boton
          texto="Guardar"
          onPress={onGuardar}
          cargando={ocupado}
          textoCargando="Guardando…"
          deshabilitado={total === null}
          style={estilos.botonFila}
        />
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
  /** Quiénes pueden confirmar en este teléfono (nunca quien capturó). */
  candidatos: readonly Participante[];
  /** Quién tiene la sesión abierta en el teléfono. */
  usuarioSesionId: string | null;
  usuarioSesionNombre: string | null;
  onCerrar: () => void;
  onConfirmada: (ultima: boolean) => void;
}

/**
 * Mismo teclado e indicadores que el login. Muestra lo que se confirma (la
 * cantidad y quién la capturó) y la manda junto con el PIN: si alguien la
 * recapturó mientras tanto, el servidor rechaza en vez de confirmar otra.
 *
 * "¿Quién confirma?" arriba: quien tiene la sesión, o la otra persona que
 * contó y está al lado (se le pasa el teléfono y teclea SU PIN). Entre
 * dispositivos no cambia nada: cada quien confirma desde su sesión.
 */
function ModalConfirmar({
  eventoId,
  discrepancia: d,
  candidatos,
  usuarioSesionId,
  usuarioSesionNombre,
  onCerrar,
  onConfirmada,
}: PropsModalConfirmar) {
  const confirmar = useConfirmarDiscrepancia(eventoId);
  const pinRef = useRef('');
  const [cantidad, setCantidad] = useState(0);
  const [claveError, setClaveError] = useState(0);
  const [aviso, setAviso] = useState<AvisoConfirmar | null>(null);

  // Sin participantes (aún no llegan o no se pudieron leer): confirma la sesión, como entre dispositivos.
  const opciones: readonly Participante[] =
    candidatos.length > 0
      ? candidatos
      : usuarioSesionId && d?.capturadaPor !== usuarioSesionId
        ? [{ id: usuarioSesionId, nombre: usuarioSesionNombre ?? 'Tú', tipoSesion: null }]
        : [];
  // Lo elegido a mano vale solo para la diferencia en que se eligió; si no,
  // manda la elección inicial (y se recalcula cuando llega la lista de personas).
  const [eleccion, setEleccion] = useState<{ code: string; id: string } | null>(null);
  const elegido =
    d && eleccion?.code === d.code ? eleccion.id : d ? confirmadorInicial(opciones, usuarioSesionId) : null;

  const persona = opciones.find((p) => p.id === elegido) ?? null;
  const esSesion = persona !== null && persona.id === usuarioSesionId;

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

  const elegir = (id: string) => {
    if (enviando || id === elegido) return;
    limpiarPin();
    setAviso(null);
    if (d) setEleccion({ code: d.code, id });
  };

  const enviar = (pin: string) => {
    if (!d || d.cantidadFinal === null || !persona) return;
    confirmar.mutate(
      {
        productoCode: d.code,
        cantidadFinal: d.cantidadFinal,
        pin,
        // Otra persona en este teléfono: el servidor verifica SU PIN y que no haya capturado.
        confirmaUsuarioAppId: esSesion ? undefined : persona.id,
      },
      {
        onSuccess: (respuesta) => {
          limpiarPin();
          setAviso(null);
          sentir('exito');
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
              sentir('error');
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
    if (enviando || definitivo || !persona || pinRef.current.length >= LONGITUD_PIN) return;
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

  const titulo = !persona ? '¿Quién confirma?' : esSesion ? 'Confirma con tu PIN' : `${nombreCorto(persona.nombre)}, confirma con tu PIN`;
  const detalle = !persona
    ? 'Elige tu nombre. Quien capturó la cantidad no puede confirmarla.'
    : esSesion
      ? `Confirmas como ${persona.nombre}.`
      : `Confirmas como ${persona.nombre}, en el teléfono de ${usuarioSesionNombre ? nombreCorto(usuarioSesionNombre) : 'otra persona'}.`;

  return (
    <Hoja
      visible={d !== null}
      onCerrar={cerrar}
      bloqueada={enviando}
      titulo={titulo}
      detalle={detalle}
      pie={<Boton texto={definitivo ? 'Cerrar' : 'Cancelar'} variante="secundario" onPress={cerrar} deshabilitado={enviando} />}
    >
      {opciones.length > 1 && (
        <View style={estilos.quienConfirma} accessibilityRole="radiogroup" accessibilityLabel="¿Quién confirma?">
          {opciones.map((p) => {
            const activo = p.id === elegido;
            const rol = etiquetaRol({ tipoSesion: p.tipoSesion, piezas: 0, paquetes: null, sueltas: null }, '');
            return (
              <Pulsable
                key={p.id}
                onPress={() => elegir(p.id)}
                tacto="seleccion"
                onda={activo ? ONDA.sobreColor : ONDA.sobreClaro}
                disabled={enviando}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo, disabled: enviando }}
                accessibilityLabel={`${p.nombre}${rol ? `, ${rol.toLowerCase()}` : ''}${p.id === usuarioSesionId ? ', tu sesión' : ''}`}
                style={[estilos.opcionPersona, activo && estilos.opcionPersonaActiva]}
              >
                <Glifo nombre="persona" color={activo ? COLORES.textoSobreColor : COLORES.textoSecundario} tamano={ESPACIADO.lg + ESPACIADO.xs} />
                <View style={estilos.textosPersona}>
                  <Text style={[estilos.nombrePersona, activo && estilos.textoInvertido]} numberOfLines={1}>
                    {p.id === usuarioSesionId ? `${nombreCorto(p.nombre)} (tú)` : nombreCorto(p.nombre)}
                  </Text>
                  {rol ? (
                    <Text style={[estilos.rolPersona, activo && estilos.rolPersonaActiva]} numberOfLines={1}>
                      {rol}
                    </Text>
                  ) : null}
                </View>
              </Pulsable>
            );
          })}
        </View>
      )}

      {d && (
        <Tarjeta elevacion={0} compacta>
          <View style={estilos.lineaProducto}>
            <EtiquetaFactor producto={d.producto} />
            <Text style={estilos.nombreProductoModal} numberOfLines={2}>
              {formatearNombreProducto(d.producto.nombre)}
            </Text>
          </View>
          {d.cantidadFinal !== null && <LineaFinal piezas={d.cantidadFinal} d={d} confirmada={false} />}
          <Text style={estilos.detalleModal}>
            Capturó {d.capturadaPorNombre ?? 'otra persona'}. Al confirmar, respaldas esta cantidad con tu nombre.
          </Text>
        </Tarjeta>
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
      ) : opciones.length === 0 ? (
        <View style={estilos.panelDefinitivo} accessibilityRole="alert">
          <Text style={estilos.textoDefinitivo}>
            Nadie más que contó esta carga puede confirmar en este teléfono. La confirma otra persona desde su propia sesión.
          </Text>
        </View>
      ) : (
        <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando || !persona} />
      )}
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  // Los dos conteos lado a lado y la diferencia debajo: se comparan de un vistazo.
  comparacion: {
    gap: ESPACIADO.sm,
  },
  ladosConteo: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  ladoConteo: {
    flex: 1,
    gap: 2,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.control,
  },
  rotuloLado: ETIQUETA_DATO,
  valorLado: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 18,
    lineHeight: 24,
    color: COLORES.texto,
    ...CIFRAS,
  },
  franjaDiferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm + 2,
    paddingLeft: ESPACIADO.sm + 2,
    paddingRight: ESPACIADO.lg,
    backgroundColor: COLORES.discrepanciaFondo,
    borderWidth: BORDES.fino,
    borderColor: COLORES.discrepanciaHonda,
    borderRadius: RADIOS.completo,
  },
  circuloRombo: {
    width: ESPACIADO.xxl + ESPACIADO.sm,
    height: ESPACIADO.xxl + ESPACIADO.sm,
    borderRadius: RADIOS.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
  },
  textosDiferencia: {
    flex: 1,
  },
  rotuloDiferencia: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.extraNegrita,
    color: COLORES.discrepanciaTexto,
  },
  detalleDiferencia: {
    ...TIPOGRAFIA.micro,
    color: COLORES.discrepanciaTexto,
    ...CIFRAS,
  },
  valorDiferencia: {
    flexShrink: 1,
    ...TIPOGRAFIA.titulo,
    fontSize: 20,
    lineHeight: 26,
    color: COLORES.discrepanciaTexto,
    textAlign: 'right',
    ...CIFRAS,
  },
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenedorAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  tarjetaEsqueleto: {
    gap: RITMO.interno,
  },

  // La línea toma el alto del número grande para que no se recorte.
  progreso: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.medio,
    color: COLORES.marcaTenue,
    ...CIFRAS,
  },
  // Lo que se busca al levantar la vista: cuántas van.
  numeroProgreso: {
    ...TIPOGRAFIA.avance,
    color: COLORES.textoSobreColor,
  },
  faltan: {
    alignItems: 'flex-start',
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.sm,
  },

  // Cuerpo: se lee con calma, una diferencia a la vez.
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
    // Más aire entre diferencias que entre los grupos de cada una.
    gap: ESPACIADO.xxl,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  pasos: {
    gap: ESPACIADO.sm,
  },
  tituloPasos: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
    marginBottom: ESPACIADO.xs,
  },
  lineaPersonas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
    marginTop: 2,
  },
  textoPersonas: {
    flexShrink: 1,
    ...TIPOGRAFIA.micro,
    color: COLORES.marcaTenue,
  },
  // ¿Quién confirma?: dos o tres personas, cada una un bloque que se toca con el pulgar.
  quienConfirma: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ESPACIADO.sm,
  },
  opcionPersona: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  opcionPersonaActiva: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
  },
  textosPersona: {
    flex: 1,
  },
  nombrePersona: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  rolPersona: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  rolPersonaActiva: {
    color: COLORES.marcaTenue,
  },
  paso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
  },
  numeroPaso: {
    width: ESPACIADO.xl + ESPACIADO.xs,
    height: ESPACIADO.xl + ESPACIADO.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.accion,
  },
  textoNumeroPaso: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.textoSobreColor,
  },
  textoPaso: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  tituloPaso: {
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    backgroundColor: COLORES.fondo,
  },
  lateralVacio: {
    flex: 1,
    justifyContent: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.xl,
  },
  textoLateralVacio: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },

  // Entre producto, conteos y resultado, aire de grupo: tres bloques sin líneas.
  tarjeta: {
    gap: RITMO.grupo,
  },
  lineaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  nombreProducto: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  final: {
    gap: RITMO.relacionado,
  },
  // Rótulo pegado a la cifra: un solo bloque.
  bloqueFinal: {
    padding: RITMO.margen,
    borderRadius: RADIOS.medio,
    borderWidth: BORDES.medio,
    borderColor: COLORES.capturadoHondo,
  },
  bloqueFinalPendiente: {
    borderStyle: 'dashed',
    borderColor: COLORES.borde,
  },
  cabeceraFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
  },
  etiquetaFinal: ETIQUETA_DATO,
  // El único número grande de la tarjeta: lo que se carga al camión.
  valorFinal: {
    ...TIPOGRAFIA.display,
    fontFamily: FUENTE.extraNegrita,
    ...CIFRAS,
  },
  detalleFinal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
  // Discreta a propósito: es un dato, no un error.
  notaAtipica: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
  },
  avisoCruzado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
  },
  textoAvisoCruzado: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.discrepanciaTexto,
  },
  // Bloque tintado, no texto de color: se lee de reojo.
  error: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.errorFondo,
    borderRadius: RADIOS.medio,
    overflow: 'hidden',
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.negrita,
    color: COLORES.errorTexto,
    textAlign: 'center',
  },

  // Editor
  // Lo que se edita lleva la marca (Regla del Azul Es la Mano).
  editor: {
    gap: RITMO.interno,
    padding: RITMO.relacionado,
    backgroundColor: COLORES.marcaTinte,
    borderRadius: RADIOS.medio,
    borderWidth: BORDES.medio,
    borderColor: COLORES.accion,
  },
  camposEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
  },
  campoEditor: {
    minWidth: ESPACIADO.xxxl * 2,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  // Lo que se está editando lleva la marca, relleno completo como en el conteo.
  // Mismo grosor de contorno en ambos estados: el campo no salta al activarse.
  campoEditorActivo: {
    borderColor: COLORES.accion,
    backgroundColor: COLORES.accion,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  etiquetaCampo: {
    ...ROTULO,
    textAlign: 'right',
  },
  valorCampo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
    textAlign: 'right',
    ...CIFRAS,
  },
  totalEditor: {
    flexShrink: 1,
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.accionHonda,
    ...CIFRAS,
  },

  // Botones
  botonFila: {
    flex: 1,
  },
  botones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },

  // Modal de confirmación
  detalleModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  nombreProductoModal: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  zonaIndicadores: {
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  // Altura reservada: un aviso no debe mover el teclado bajo el dedo.
  zonaAviso: {
    minHeight: ESPACIADO.xxxl + ESPACIADO.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVerificando: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.medio,
    color: COLORES.textoSecundario,
  },
  avisoRed: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
    overflow: 'hidden',
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.discrepanciaTexto,
    textAlign: 'center',
  },
  panelDefinitivo: {
    padding: RITMO.margen,
    backgroundColor: COLORES.error,
    borderRadius: RADIOS.medio,
  },
  textoDefinitivo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSobreColor,
  },
});
