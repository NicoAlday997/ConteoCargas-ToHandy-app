import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useCapturarDiscrepancia, useConfirmarDiscrepancia, useDiscrepancias } from '../../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Boton,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  FilaDato,
  LineaEsqueleto,
  Personas,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { IndicadoresPin, LONGITUD_PIN } from '../../src/componentes/IndicadoresPin';
import { TecladoPin } from '../../src/componentes/TecladoPin';
import {
  admitePaquetes,
  admiteSueltas,
  factorEfectivo,
  primerCampo,
  seVendeCompleto,
  totalPiezas,
  unidadCompleta,
  type CampoCaptura,
  type CapturaProducto,
} from '../../src/conteo/estado-conteo';
import { EtiquetaFactor, nombreCampo } from '../../src/conteo/FilaProducto';
import { formatearEnPaquetes, formatearPiezas, formatearTotalPiezas } from '../../src/conteo/formato-cantidad';
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
import {
  ANCHO_MODAL,
  BORDES,
  CIFRAS,
  COLORES,
  ESPACIADO,
  PESOS,
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
const ANCHO_MAXIMO_LISTA = 720;
/** Tras abrir el teclado hay que esperar al layout para llevar la tarjeta a la vista. */
const RETRASO_SCROLL_MS = 60;
/** El modal del PIN es más angosto que los demás: el teclado se ve como el del login. */
const ANCHO_MODAL_PIN = ANCHO_MODAL - ESPACIADO.xl - ESPACIADO.lg;

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
  const params = useLocalSearchParams<{ eventoId: string }>();
  const eventoId = parametro(params.eventoId);

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
    if (actual.campo === 'paquetes' && d && admiteSueltas(d.producto)) {
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
      <SafeAreaView style={estilos.pantalla}>
        <Encabezado titulo="Diferencias por resolver" marca lineasTitulo={1} onVolver={volver} etiquetaVolver="Volver al inicio" />
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

  const teclado =
    edicion?.tecladoAbierto && editada ? (
      <TecladoCantidad
        producto={editada.producto}
        campo={edicion.campo}
        texto={edicion.texto}
        reemplazar={edicion.reemplazar}
        captura={capturaVisible(edicion)}
        etiquetaSiguiente={
          edicion.campo === 'paquetes' && admiteSueltas(editada.producto)
            ? 'Sueltas ›'
            : capturar.isPending
              ? 'Guardando…'
              : 'Guardar'
        }
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
        titulo="Diferencias por resolver"
        marca
        lineasTitulo={1}
        onVolver={volver}
        etiquetaVolver="Volver al inicio"
        inferior={
          <>
            <Text
              style={estilos.progreso}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`} de ${total}`}
            >
              <Text style={estilos.numeroProgreso}>{faltan}</Text>
              {`  ${faltan === 1 ? 'falta' : 'faltan'} de `}
              <Text style={estilos.totalProgreso}>{total}</Text>
            </Text>
            <View style={estilos.barra} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: resueltas }}>
              <View style={[estilos.rellenoBarra, { width: `${(resueltas / total) * 100}%` }]} />
            </View>
          </>
        }
      />

      <View style={[estilos.cuerpo, esTablet && estilos.cuerpoTablet]}>
        <ScrollView
          ref={lista}
          style={estilos.lista}
          contentContainerStyle={estilos.contenidoLista}
          keyboardShouldPersistTaps="handled"
        >
          <Tarjeta elevacion={0} tintada="marca" compacta>
            <Text style={estilos.instruccion}>
              Una persona captura la cantidad final y otra distinta la confirma con su propio PIN.
            </Text>
          </Tarjeta>
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

/** Banda de la tarjeta: ámbar mientras falte algo, verde al quedar confirmada. */
const BANDA_ESTADO: Record<ReturnType<typeof estadoDe>, { titulo: string; tono: ColorEstado }> = {
  'sin-capturar': { titulo: 'Sin cantidad final', tono: 'discrepancia' },
  'por-confirmar': { titulo: 'Espera confirmación', tono: 'discrepancia' },
  confirmada: { titulo: 'Confirmada', tono: 'capturado' },
};

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
    <Tarjeta conAcento={BANDA_ESTADO[estado]} style={estilos.tarjeta}>
      <View style={estilos.lineaProducto}>
        <EtiquetaFactor producto={d.producto} />
        <Text style={estilos.nombreProducto} numberOfLines={2}>
          {d.producto.nombre}
        </Text>
      </View>

      <Tarjeta elevacion={0} compacta>
        <RenglonConteo etiqueta={etiquetaRol(d.primerConteo, 'Primer conteo')} lado={d.primerConteo} d={d} />
        <RenglonConteo etiqueta={etiquetaRol(d.segundoConteo, 'Segundo conteo')} lado={d.segundoConteo} d={d} />
        <FilaDato
          etiqueta="Diferencia"
          valor={enPaquetes(diferencia(d), d)}
          detalle={totalSecundario(diferencia(d), d)}
          tono="discrepancia"
          separado
          accessibilityLabel={`Diferencia: ${vozCantidad(diferencia(d), d)}`}
        />
      </Tarjeta>

      {edicion ? (
        <EditorCantidad d={d} edicion={edicion} ocupado={ocupado} onAbrirCampo={onAbrirCampo} onGuardar={onGuardar} onCancelar={onCancelar} />
      ) : estado === 'sin-capturar' ? (
        <Boton texto="Capturar cantidad final" onPress={onCapturar} deshabilitado={bloqueada} />
      ) : (
        <View style={estilos.final}>
          {d.cantidadFinal !== null && (
            <LineaFinal piezas={d.cantidadFinal} d={d} tono={estado === 'confirmada' ? 'capturado' : 'marca'} />
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
              <Personas personas={[{ rol: 'Capturó', nombre: soyQuienCapturo ? 'Tú' : (d.capturadaPorNombre ?? 'otra persona') }]} />
              {soyQuienCapturo && (
                <Text style={estilos.aviso}>Otra persona debe confirmarla con su propio PIN.</Text>
              )}
              <View style={estilos.botones}>
                <Boton
                  texto={soyQuienCapturo ? 'Corregir' : 'No coincide, corregir'}
                  variante="secundario"
                  onPress={onCapturar}
                  deshabilitado={bloqueada}
                  style={estilos.botonFila}
                />
                {/* A quien capturó ni se le ofrece: el servidor lo rechazaría igual. */}
                {puedeConfirmar(d, usuarioId) && (
                  <Boton texto="Confirmar con mi PIN" onPress={onConfirmar} deshabilitado={bloqueada} style={estilos.botonFila} />
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

/** "Vendedor   5 paquetes y 2 piezas": en la unidad en que se contó, sin dividir de cabeza. */
function RenglonConteo({ etiqueta, lado, d }: { etiqueta: string; lado: ConteoLado; d: Discrepancia }) {
  return (
    <FilaDato
      etiqueta={etiqueta}
      valor={enPaquetes(lado.piezas, d)}
      accessibilityLabel={`${etiqueta}: ${vozCantidad(lado.piezas, d)}`}
    />
  );
}

/**
 * "Cantidad final / 3 paquetes y 2 piezas / (20 piezas)" en un bloque tintado:
 * la cifra domina, es lo que se carga al camión. Azul mientras espera, verde confirmada.
 */
function LineaFinal({ piezas, d, tono }: { piezas: number; d: Discrepancia; tono: 'marca' | 'capturado' }) {
  const colores = TONOS[tono];
  const detalle = totalSecundario(piezas, d);
  return (
    <View
      style={[estilos.bloqueFinal, { backgroundColor: colores.fondo }]}
      accessible
      accessibilityLabel={`Cantidad final: ${vozCantidad(piezas, d)}`}
    >
      <Text style={[estilos.etiquetaFinal, { color: colores.texto }]}>Cantidad final</Text>
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
            <Pressable
              key={campo}
              onPress={() => onAbrirCampo(campo)}
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
            </Pressable>
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
            <Encabezado titulo="Confirma con tu PIN" variante="plano" />
            {d && (
              <Tarjeta elevacion={0} compacta>
                <View style={estilos.lineaProducto}>
                  <EtiquetaFactor producto={d.producto} />
                  <Text style={estilos.nombreProductoModal} numberOfLines={2}>
                    {d.producto.nombre}
                  </Text>
                </View>
                {d.cantidadFinal !== null && <LineaFinal piezas={d.cantidadFinal} d={d} tono="marca" />}
                <Text style={estilos.detalleModal}>Capturó {d.capturadaPorNombre ?? 'otra persona'}. Al confirmar respaldas esta cantidad.</Text>
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
            ) : (
              <TecladoPin onDigito={alDigito} onBorrar={alBorrar} deshabilitado={enviando} />
            )}

            <View style={estilos.botones}>
              <Boton
                texto={definitivo ? 'Cerrar' : 'Cancelar'}
                variante="secundario"
                onPress={cerrar}
                deshabilitado={enviando}
                style={estilos.botonFila}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
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

  // Sobre el azul del encabezado.
  // La línea toma el alto del número grande para que no se recorte.
  progreso: {
    ...TIPOGRAFIA.cuerpo,
    lineHeight: 36,
    color: COLORES.marcaClaro,
    ...CIFRAS,
  },
  // Lo que se busca al levantar la vista: cuántas faltan.
  numeroProgreso: {
    ...TIPOGRAFIA.display,
    lineHeight: 36,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  totalProgreso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  barra: {
    height: ESPACIADO.sm,
    backgroundColor: COLORES.marcaOscuro,
    borderRadius: RADIOS.completo,
    overflow: 'hidden',
  },
  rellenoBarra: {
    height: '100%',
    backgroundColor: COLORES.capturadoFondo,
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
  instruccion: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.marcaOscuro,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    backgroundColor: COLORES.fondoPantalla,
    borderLeftWidth: BORDES.grueso,
    borderLeftColor: COLORES.marca,
  },
  lateralVacio: {
    flex: 1,
    justifyContent: 'center',
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
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  final: {
    gap: RITMO.relacionado,
  },
  // Rótulo pegado a la cifra: un solo bloque.
  bloqueFinal: {
    padding: RITMO.margen,
    borderRadius: RADIOS.medio,
  },
  etiquetaFinal: ROTULO,
  // El único número grande de la tarjeta: lo que se carga al camión.
  valorFinal: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
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
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  aviso: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  // Bloque tintado, no texto de color: se lee de reojo.
  error: {
    paddingVertical: RITMO.interno,
    paddingHorizontal: RITMO.relacionado,
    backgroundColor: COLORES.errorFondo,
    borderRadius: RADIOS.medio,
    overflow: 'hidden',
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    color: COLORES.errorTexto,
    textAlign: 'center',
  },

  // Editor
  editor: {
    gap: RITMO.interno,
    padding: RITMO.relacionado,
    backgroundColor: COLORES.marcaClaro,
    borderRadius: RADIOS.medio,
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
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  // Lo que se está editando lleva la marca, relleno completo como en el conteo.
  // Mismo grosor de contorno en ambos estados: el campo no salta al activarse.
  campoEditorActivo: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marca,
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
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
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
  fondoModal: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  contenidoFondoModal: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
  },
  modal: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.grande,
  },
  modalPin: {
    maxWidth: ANCHO_MODAL_PIN,
  },
  detalleModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  nombreProductoModal: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
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
    fontWeight: PESOS.medio,
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
