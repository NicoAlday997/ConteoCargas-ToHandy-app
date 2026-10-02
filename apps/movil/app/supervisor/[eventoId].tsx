import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useDetalleHistorial } from '../../src/api/hooks-historial';
import {
  useAutorizarCarga,
  useRechazarProductos,
} from '../../src/api/hooks-supervisor';
import { cerrarSesion } from '../../src/api/sesion';
import {
  Boton,
  CampoTexto,
  Chevron,
  EstadoVacio,
  Glifo,
  Palomita,
  Pulsable,
  Tarjeta,
  useListaConFormulario,
} from '../../src/componentes/base';
import {
  ANCHO_MAXIMO_LISTA,
  BarraSuperior,
  volver,
} from '../../src/historial/ComponentesHistorial';
import {
  estadoDeCarga,
  type CargaDetalle,
  type ProductoDetalle,
} from '../../src/historial/modelo-historial';
import {
  CargaIlegible,
  EncabezadoFamilia,
  ErrorCarga,
  EsqueletoCarga,
  estilosVistaCarga,
  ResumenCarga,
  seccionesDeCarga,
  TarjetaProducto,
  titulosCarga,
  type SeccionFamilia,
} from '../../src/historial/VistaCarga';
import { dejarAviso } from '../../src/supervisor/aviso-cola';
import { CambiarFechaSupervisor } from '../../src/supervisor/CambiarFechaSupervisor';
import { CancelarCargaSupervisor } from '../../src/supervisor/CancelarCargaSupervisor';
import {
  AvisoEnvio,
  ESTADOS_ENVIABLES,
  ModalEnviar,
  textoBotonEnvio,
  useEnvioHandy,
} from '../../src/supervisor/EnvioHandy';
import { ModalConfirmacion } from '../../src/supervisor/ModalConfirmacion';
import { ModalModificar } from '../../src/supervisor/ModalModificar';
import {
  accionCancelacion,
  MOTIVO_MINIMO,
  puedeCambiarFecha,
  motivoValido,
  rechazosParaEnviar,
} from '../../src/supervisor/modelo-supervisor';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import {
  diaNegocio,
  diaRelativo,
  formatearDia,
} from '../../src/conteo/fecha-operativa';
import { formatearCifra } from '../../src/conteo/formato-cantidad';
import { formatearNombreProducto } from '../../src/conteo/formato-nombre';
import { sentir } from '../../src/theme/tacto';
import {
  BARRA_INFERIOR,
  BORDES,
  CIFRAS,
  COLORES,
  ESPACIADO,
  ETIQUETA_DATO,
  FUENTE,
  ONDA,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';

/**
 * Revisión de una carga que espera el visto bueno del supervisor. Como una
 * báscula: primero la lectura (¿cuadró?), luego solo lo que cambió, y la
 * lista completa a un toque — misma vista consolidada que el historial, con
 * el mismo detalle cuadre o no. La salida esperada es una: autorizar y enviar
 * a Handy en una sola decisión; «Solo autorizar» queda dentro de esa hoja y
 * las excepciones (rechazar, modificar, cambiar fecha, cancelar) tras «Más
 * acciones».
 */

/**
 * - revisar: lectura, con las tres acciones abajo.
 * - rechazar: cada producto se puede marcar, con su motivo.
 * - modificar: cada producto ofrece «Modificar cantidad»; solo uno por ronda.
 */
type Modo = 'revisar' | 'rechazar' | 'modificar';

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

function sesionVencida() {
  void cerrarSesion().then(() => router.replace('/login'));
}

/** Tras rechazar o modificar la carga ya no está en la cola: se vuelve a ella con el aviso listo. */
function volverACola() {
  if (router.canGoBack()) router.back();
  else router.replace('/supervisor');
}

function mensajeError(
  e: unknown,
  porDefecto: string,
): { titulo: string; detalle: string; tono?: 'atencion' } {
  if (e instanceof ErrorRed) {
    return {
      titulo: 'Sin conexión',
      detalle: 'No se registró nada. Inténtalo cuando haya señal.',
      tono: 'atencion',
    };
  }
  if (e instanceof ErrorApi && e.estado === 409) {
    return {
      titulo: 'La carga ya no espera tu autorización',
      detalle:
        'Otro supervisor pudo haber actuado sobre ella hace un momento. Cierra para ver cómo quedó.',
    };
  }
  return {
    titulo: porDefecto,
    detalle:
      e instanceof Error && e.message
        ? e.message
        : 'Intenta de nuevo en un momento.',
  };
}

export default function PantallaAutorizacion() {
  const params = useLocalSearchParams<{ eventoId: string }>();
  const eventoId = parametro(params.eventoId);
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla titulo="Autorizar carga">
        <EsqueletoCarga />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla titulo="Autorizar carga">
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="La autorización de cargas la da un supervisor. Si crees que deberías tener acceso, avisa al administrador."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  if (!eventoId) {
    return (
      <Pantalla titulo="Autorizar carga">
        <EstadoVacio
          icono="lista"
          titulo="No se encontró la carga"
          detalle="El enlace no trae qué carga abrir. Vuelve a la lista y elígela de nuevo."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Revision eventoId={eventoId} />;
}

function Revision({ eventoId }: { eventoId: string }) {
  const consulta = useDetalleHistorial(eventoId);
  const autorizar = useAutorizarCarga(eventoId);
  const rechazar = useRechazarProductos(eventoId);
  const carga = consulta.data ?? null;
  const envio = useEnvioHandy(eventoId, carga, sesionVencida);

  const [refrescando, setRefrescando] = useState(false);
  const [modoElegido, setModo] = useState<Modo>('revisar');
  /** Código → motivo de lo marcado para rechazar. */
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [intentoRechazo, setIntentoRechazo] = useState(false);
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false);
  const [errorRechazo, setErrorRechazo] = useState<ReturnType<
    typeof mensajeError
  > | null>(null);
  const [confirmandoAutorizacion, setConfirmandoAutorizacion] = useState(false);
  const [errorAutorizacion, setErrorAutorizacion] = useState<ReturnType<
    typeof mensajeError
  > | null>(null);
  const [aModificar, setAModificar] = useState<ProductoDetalle | null>(null);
  /** Las acciones de excepción se guardan tras «Más acciones»: la barra no se come la lista. */
  const [masAcciones, setMasAcciones] = useState(false);
  /** Lo que coincidió se colapsa: el camino feliz no pide leer, pero está a un toque. */
  const [verTodo, setVerTodo] = useState(false);
  const lista = useRef<SectionList<ProductoDetalle, SeccionFamilia>>(null);
  // Al rechazar, el motivo de cada producto abre el teclado sobre la barra
  // fija: la lista crece abajo lo que tapa el teclado y el renglón enfocado
  // sube arriba de él. La barra no se mueve.
  const desplazarA = useCallback(
    (y: number) =>
      lista.current?.getScrollResponder()?.scrollTo({ y, animated: true }),
    [],
  );
  const teclado = useListaConFormulario(desplazarA);

  const vencida =
    consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const estado = carga?.evento.estado ?? null;
  // Lo que se envía aparece arriba de la lista: al cambiar, se lleva ahí la vista.
  useEffect(() => {
    if (envio.resultado)
      lista.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
  }, [envio.resultado]);

  // Si la carga deja de esperar autorización (otro supervisor actuó), no queda modo que sostener.
  const modo: Modo =
    estado === 'EN_ESPERA_AUTORIZACION' ? modoElegido : 'revisar';

  const secciones = useMemo(() => seccionesDeCarga(carga), [carga]);
  const conCambio = useMemo(
    () =>
      secciones.flatMap((s) => s.data.filter((p) => p.discrepancia !== null)),
    [secciones],
  );
  // Lo que coincidió, por familia (lo que cambió ya va arriba, no se repite).
  const coincidieron = useMemo(
    () =>
      secciones
        .map((s) => ({
          ...s,
          data: s.data.filter((p) => p.discrepancia === null),
        }))
        .filter((s) => s.data.length > 0),
    [secciones],
  );

  if (consulta.isPending) {
    return (
      <Pantalla titulo="Autorizar carga">
        <EsqueletoCarga />
      </Pantalla>
    );
  }

  if (consulta.isError && !carga) {
    return (
      <Pantalla titulo="Autorizar carga">
        <ErrorCarga
          error={consulta.error}
          onReintentar={() => void consulta.refetch()}
        />
      </Pantalla>
    );
  }

  if (!carga) {
    return (
      <Pantalla titulo="Autorizar carga">
        <CargaIlegible
          onReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      </Pantalla>
    );
  }

  const enEspera = estado === 'EN_ESPERA_AUTORIZACION';
  const enviable = estado !== null && ESTADOS_ENVIABLES.has(estado);
  // Cambiar la fecha ya no vive aquí: va junto a la fecha, al frente (BloqueSalida).
  const hayMasAcciones = enEspera || accionCancelacion(estado) !== null;
  const marcados = Object.keys(seleccion).length;

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setMasAcciones(false);
    setSeleccion({});
    setIntentoRechazo(false);
    setErrorRechazo(null);
  };

  const alternar = (code: string) =>
    setSeleccion((actual) => {
      if (code in actual) {
        const { [code]: _quitado, ...resto } = actual;
        return resto;
      }
      return { ...actual, [code]: '' };
    });

  const pedirRechazo = () => {
    setIntentoRechazo(true);
    if (rechazosParaEnviar(seleccion)) {
      setErrorRechazo(null);
      setConfirmandoRechazo(true);
    }
  };

  const confirmarRechazo = () => {
    const productos = rechazosParaEnviar(seleccion);
    if (!productos) return;
    rechazar.mutate(productos, {
      onSuccess: () => {
        setConfirmandoRechazo(false);
        dejarAviso({
          tipo: 'rechazada',
          ruta: carga.evento.rutaNombre,
          productos: productos.length,
        });
        volverACola();
      },
      onError: (e) => {
        if (e instanceof ErrorApi && e.estado === 401) return sesionVencida();
        setErrorRechazo(
          mensajeError(e, 'No se pudieron rechazar los productos'),
        );
      },
    });
  };

  /**
   * Autorizar y enviar son una sola decisión: la hoja sigue abierta hasta que
   * Handy responde. Si el envío falla, la carga ya quedó autorizada y la
   * pantalla dice qué pasó y ofrece reintentar el envío.
   */
  const confirmarAutorizacion = (enviarTambien: boolean) => {
    autorizar.mutate(undefined, {
      onSuccess: () => {
        setErrorAutorizacion(null);
        if (!enviarTambien) {
          sentir('exito');
          setConfirmandoAutorizacion(false);
          return;
        }
        envio.confirmar(() => setConfirmandoAutorizacion(false));
      },
      onError: (e) => {
        if (e instanceof ErrorApi && e.estado === 401) return sesionVencida();
        sentir('error');
        setErrorAutorizacion(mensajeError(e, 'No se pudo autorizar'));
      },
    });
  };

  const renderProducto = (producto: ProductoDetalle) => {
    if (modo === 'rechazar') {
      const marcado = producto.code in seleccion;
      const motivo = seleccion[producto.code] ?? '';
      return (
        <TarjetaProducto
          producto={producto}
          tintada={marcado ? 'error' : undefined}
          pie={
            <ControlRechazo
              nombre={producto.nombre}
              marcado={marcado}
              motivo={motivo}
              error={intentoRechazo && marcado && !motivoValido(motivo)}
              onAlternar={() => alternar(producto.code)}
              onMotivo={(texto) =>
                setSeleccion((actual) => ({
                  ...actual,
                  [producto.code]: texto,
                }))
              }
            />
          }
        />
      );
    }
    if (modo === 'modificar') {
      return (
        <TarjetaProducto
          producto={producto}
          pie={
            <Boton
              texto="Modificar cantidad"
              variante="secundario"
              onPress={() => setAModificar(producto)}
              accessibilityLabel={`Modificar cantidad de ${producto.nombre}`}
              style={estilos.botonPie}
            />
          }
        />
      );
    }
    return <TarjetaProducto producto={producto} />;
  };

  // Para rechazar o modificar se elige entre todos: la lista completa, sin colapsar.
  const colapsado = modo === 'revisar' && !verTodo && carga.totalProductos > 0;
  const seccionesVisibles =
    modo !== 'revisar' ? secciones : verTodo ? coincidieron : [];
  const nCoincidieron = carga.totalProductos - conCambio.length;

  return (
    <Pantalla {...titulosCarga(carga)}>
      <teclado.Proveedor value={teclado.mostrarCampo}>
        <View style={estilos.marcoLista} {...teclado.propsMarco}>
          <SectionList<ProductoDetalle, SeccionFamilia>
            ref={lista}
            {...teclado.propsLista}
            style={estilosVistaCarga.lista}
            contentContainerStyle={[
              estilosVistaCarga.contenidoLista,
              teclado.rellenoInferior > 0 && {
                paddingBottom: ESPACIADO.xxxl + teclado.rellenoInferior,
              },
            ]}
            sections={seccionesVisibles}
            extraData={{ modo, seleccion, intentoRechazo, verTodo }}
            keyExtractor={(p) => p.code}
            stickySectionHeadersEnabled
            initialNumToRender={30}
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={refrescar} />
            }
            ListHeaderComponent={
              <>
                {/* Lo primero que se lee, antes de las cantidades: para qué día sale. */}
                <BloqueSalida carga={carga} onSesionVencida={sesionVencida} />
                <ResumenCarga carga={carga} />
                <PanelEstado carga={carga} modo={modo} envio={envio} />
                {modo === 'revisar' && carga.totalProductos > 0 && (
                  <>
                    <Lectura carga={carga} />
                    {conCambio.map((p) => (
                      <TarjetaProducto key={p.code} producto={p} />
                    ))}
                    {nCoincidieron > 0 && (
                      <AlternarLista
                        abierta={!colapsado}
                        cantidad={nCoincidieron}
                        todos={conCambio.length === 0}
                        onPress={() => setVerTodo((v) => !v)}
                      />
                    )}
                  </>
                )}
              </>
            }
            ListEmptyComponent={
              carga.totalProductos === 0 ? (
                <EstadoVacio
                  icono="caja"
                  titulo="Sin productos"
                  detalle="Esta carga no trae productos contados. Actualiza; si sigue así, no la autorices y revisa con quien la contó."
                  enLinea
                />
              ) : null
            }
            renderSectionHeader={({ section }) => (
              <EncabezadoFamilia familia={section.familia} />
            )}
            renderItem={({ item }) => renderProducto(item)}
          />
        </View>
      </teclado.Proveedor>

      <BarraAcciones>
        {/* Lo que se espera va solo y grande; lo demás, tras «Más acciones». */}
        {modo === 'revisar' && masAcciones && (
          <View style={estilos.bandejaAcciones}>
            {enEspera && (
              <View style={estilos.filaBotones}>
                <Boton
                  texto="Rechazar productos"
                  variante="secundario"
                  onPress={() => cambiarModo('rechazar')}
                  style={estilos.botonFila}
                />
                <Boton
                  texto="Modificar cantidad"
                  variante="secundario"
                  onPress={() => cambiarModo('modificar')}
                  style={estilos.botonFila}
                />
              </View>
            )}
            {accionCancelacion(estado) !== null && (
              <CancelarCargaSupervisor
                carga={carga}
                onSesionVencida={sesionVencida}
              />
            )}
          </View>
        )}
        {enEspera && modo === 'rechazar' && (
          <View style={estilos.filaBotones}>
            <Boton
              texto="Cancelar"
              variante="secundario"
              onPress={() => cambiarModo('revisar')}
              style={estilos.botonFila}
            />
            <Boton
              texto={marcados === 0 ? 'Rechazar' : `Rechazar ${marcados}`}
              variante="peligro"
              onPress={pedirRechazo}
              deshabilitado={marcados === 0}
              accessibilityHint="Solo los productos marcados vuelven a resolverse; el resto de la carga no se toca"
              style={estilos.botonFila}
            />
          </View>
        )}
        {enEspera && modo === 'modificar' && (
          <Boton
            texto="Cancelar"
            variante="secundario"
            onPress={() => cambiarModo('revisar')}
          />
        )}
        {modo === 'revisar' && (hayMasAcciones || enEspera || enviable) && (
          <View style={estilos.filaBotones}>
            {/* Con la bandeja abierta, la decisión es cuál excepción: la acción principal se retira. */}
            {hayMasAcciones && (
              <Boton
                texto={masAcciones ? 'Menos' : 'Más acciones'}
                variante="secundario"
                tacto="seleccion"
                onPress={() => setMasAcciones((v) => !v)}
                accessibilityHint={
                  masAcciones
                    ? 'Oculta las acciones de excepción'
                    : 'Rechazar, modificar o cancelar'
                }
                style={
                  enEspera || enviable ? estilos.botonMas : estilos.botonFila
                }
              />
            )}
            {enEspera && !masAcciones && (
              <Boton
                texto="Autorizar y enviar"
                onPress={() => {
                  setErrorAutorizacion(null);
                  setConfirmandoAutorizacion(true);
                }}
                deshabilitado={secciones.length === 0}
                style={estilos.botonFila}
              />
            )}
            {enviable && estado !== null && !masAcciones && (
              <Boton
                texto={textoBotonEnvio(estado)}
                variante={estado === 'ERROR_ENVIO' ? 'secundario' : 'primario'}
                onPress={envio.pedirConfirmacion}
                cargando={envio.enviando}
                textoCargando="Enviando…"
                style={estilos.botonFila}
              />
            )}
          </View>
        )}
      </BarraAcciones>

      <ModalConfirmacion
        visible={confirmandoAutorizacion}
        titulo="¿Autorizar y enviar a Handy?"
        textoConfirmar="Autorizar y enviar"
        textoCargando={envio.enviando ? 'Enviando a Handy…' : 'Autorizando…'}
        cargando={autorizar.isPending || envio.enviando}
        error={errorAutorizacion}
        alternativa={{
          texto: 'Solo autorizar',
          onPress: () => confirmarAutorizacion(false),
        }}
        onConfirmar={() => confirmarAutorizacion(true)}
        onCerrar={() => setConfirmandoAutorizacion(false)}
      >
        <View
          style={estilos.cifrasEnvio}
          accessible
          accessibilityLabel={`${carga.totalProductos} productos, ${carga.totalPiezas} piezas`}
        >
          <View style={estilos.cifraEnvio}>
            <Text style={estilos.numeroEnvio}>{carga.totalProductos}</Text>
            <Text style={estilos.rotuloEnvio}>Productos</Text>
          </View>
          <View style={estilos.cifraEnvio}>
            <Text style={estilos.numeroEnvio}>
              {formatearCifra(carga.totalPiezas)}
            </Text>
            <Text style={estilos.rotuloEnvio}>Piezas</Text>
          </View>
        </View>
        <Text style={estilos.texto}>
          {carga.evento.tipo === 'RECARGA'
            ? 'Se agrega como recarga a la ruta abierta de '
            : 'Se crea la ruta de '}
          <Text style={estilos.negrita}>{carga.evento.rutaNombre}</Text> en
          Handy con estas cantidades. Después ya no se rechazan productos ni se
          modifican cantidades.
        </Text>
        <Text style={estilos.nota}>
          «Solo autorizar» la deja lista para enviarla después desde aquí.
        </Text>
      </ModalConfirmacion>

      <ModalConfirmacion
        visible={confirmandoRechazo}
        titulo={
          marcados === 1
            ? '¿Rechazar 1 producto?'
            : `¿Rechazar ${marcados} productos?`
        }
        textoConfirmar="Rechazar"
        textoCargando="Rechazando…"
        variante="peligro"
        cargando={rechazar.isPending}
        error={errorRechazo}
        onConfirmar={confirmarRechazo}
        onCerrar={() => setConfirmandoRechazo(false)}
      >
        <Text style={estilos.texto}>
          Solo estos vuelven a resolverse: alguien captura la cantidad y otra
          persona la confirma con su PIN. El resto de la carga se queda como
          está. Mientras tanto la carga sale de tu lista.
        </Text>
        <View style={estilos.listaRechazo}>
          {nombresMarcados(carga, seleccion).map(({ code, nombre, motivo }) => (
            <Text key={code} style={estilos.texto}>
              <Text style={estilos.negrita}>{nombre}</Text>: {motivo.trim()}
            </Text>
          ))}
        </View>
      </ModalConfirmacion>

      <ModalEnviar carga={carga} envio={envio} />

      <ModalModificar
        eventoId={eventoId}
        rutaNombre={carga.evento.rutaNombre}
        producto={aModificar}
        onCerrar={() => setAModificar(null)}
        onSesionVencida={sesionVencida}
        onModificada={(producto, cantidad) => {
          setAModificar(null);
          dejarAviso({
            tipo: 'modificada',
            ruta: carga.evento.rutaNombre,
            producto: producto.nombre,
            cantidad,
          });
          volverACola();
        }}
      />
    </Pantalla>
  );
}

function nombresMarcados(
  carga: CargaDetalle,
  seleccion: Readonly<Record<string, string>>,
) {
  const productos = carga.familias.flatMap((f) => f.productos);
  return Object.entries(seleccion).map(([code, motivo]) => ({
    code,
    nombre: formatearNombreProducto(
      productos.find((p) => p.code === code)?.nombre ?? code,
    ),
    motivo,
  }));
}

/**
 * Lo que toca hacer ahora, bajo el resumen: la instrucción del modo, cómo va
 * el envío o por qué ya no hay nada que autorizar.
 */
function PanelEstado({
  carga,
  modo,
  envio,
}: {
  carga: CargaDetalle;
  modo: Modo;
  envio: ReturnType<typeof useEnvioHandy>;
}) {
  const estado = carga.evento.estado;

  if (estado === 'EN_ESPERA_AUTORIZACION') {
    const texto =
      modo === 'rechazar'
        ? 'Marca solo los productos que están mal y escribe por qué. Solo esos vuelven a resolverse; el resto de la carga no se toca.'
        : modo === 'modificar'
          ? 'Toca «Modificar cantidad» en el producto a corregir. Solo uno por ronda: al guardarlo, la carga vuelve a diferencias por resolver.'
          : 'Revisa las cantidades. Ninguna carga llega a Handy sin tu autorización.';
    return (
      <Tarjeta elevacion={0} compacta style={estilos.panel}>
        <Text style={estilos.instruccion}>{texto}</Text>
      </Tarjeta>
    );
  }

  if (estado === 'LISTA_PARA_ENVIAR' && !envio.resultado) {
    return (
      <Tarjeta elevacion={0} tintada="capturado" compacta style={estilos.panel}>
        <Text style={estilos.tituloListo}>Autorizada</Text>
        <Text style={estilos.texto}>
          Falta enviarla a Handy: hasta entonces el camión no tiene esta carga
          en su ruta.
        </Text>
      </Tarjeta>
    );
  }

  if (
    estado !== null &&
    (ESTADOS_ENVIABLES.has(estado) || estado === 'ENVIADA')
  ) {
    return (
      <AvisoEnvio
        estado={estado}
        envio={envio}
        resumen={`${carga.totalProductos} ${carga.totalProductos === 1 ? 'producto' : 'productos'} · ${formatearCifra(carga.totalPiezas)} piezas en la ruta de ${carga.evento.rutaNombre}.`}
      />
    );
  }

  return (
    <Tarjeta elevacion={0} tintada="pendiente" compacta style={estilos.panel}>
      <Text style={estilos.texto}>
        Esta carga está en «{estadoDeCarga(estado).etiqueta}»: no espera tu
        autorización. Aquí solo se consulta.
      </Text>
    </Tarjeta>
  );
}

/**
 * La lectura de la báscula antes que cualquier lista: ¿cuadró o no? Si hubo
 * diferencias, cuántas y que ya las resolvieron dos personas; debajo van
 * esos productos, que es lo único que hace falta revisar.
 */
function Lectura({ carga }: { carga: CargaDetalle }) {
  const { totalDiscrepancias, totalProductos, sinResolver } = carga;
  if (totalDiscrepancias === 0) {
    return (
      <Tarjeta
        elevacion={0}
        tintada="capturado"
        compacta
        style={estilos.lectura}
      >
        <View style={estilos.cabeceraLectura}>
          <Palomita color={COLORES.capturadoHondo} tamano={ESPACIADO.xl} />
          <Text
            style={[estilos.tituloLectura, { color: COLORES.capturadoTexto }]}
            accessibilityRole="header"
          >
            Cuadró
          </Text>
        </View>
        <Text style={estilos.texto}>
          Vendedor y contador contaron lo mismo en{' '}
          {totalProductos === 1
            ? 'el único producto'
            : `los ${totalProductos} productos`}
          .
        </Text>
      </Tarjeta>
    );
  }
  return (
    <View style={estilos.lectura}>
      <View style={estilos.cabeceraLectura}>
        <Glifo
          nombre="alerta"
          color={COLORES.discrepanciaTexto}
          tamano={ESPACIADO.xl}
        />
        <Text
          style={[estilos.tituloLectura, { color: COLORES.discrepanciaTexto }]}
          accessibilityRole="header"
        >
          {totalDiscrepancias === 1
            ? '1 producto no cuadró'
            : `${totalDiscrepancias} productos no cuadraron`}
        </Text>
      </View>
      <Text style={estilos.texto}>
        {sinResolver > 0
          ? 'Hay diferencias sin resolver: no se puede autorizar todavía.'
          : 'Ya se resolvieron: una persona capturó la cantidad final y otra distinta la confirmó con su PIN. Revísalos aquí.'}
      </Text>
    </View>
  );
}

/** El resto de la carga, a un toque. La misma vista del historial: nada se esconde, solo se pliega. */
function AlternarLista({
  abierta,
  cantidad,
  todos,
  onPress,
}: {
  abierta: boolean;
  cantidad: number;
  todos: boolean;
  onPress: () => void;
}) {
  const texto = abierta
    ? 'Ocultar la lista'
    : todos
      ? `Ver los ${cantidad} productos`
      : `Ver ${cantidad === 1 ? 'el producto que coincidió' : `los ${cantidad} que coincidieron`}`;
  return (
    <Pulsable
      onPress={onPress}
      tacto="seleccion"
      onda={ONDA.sobreClaro}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta }}
      accessibilityLabel={texto}
      style={({ pressed }) => [
        estilos.alternar,
        pressed && estilos.alternarPresionado,
      ]}
    >
      <Text style={estilos.textoAlternar}>{texto}</Text>
      <View style={{ transform: [{ rotate: abierta ? '-90deg' : '90deg' }] }}>
        <Chevron color={COLORES.texto} tamano={ESPACIADO.xl} />
      </View>
    </Pulsable>
  );
}

/** La casilla, y al marcarla el motivo: un producto rechazado sin explicación no se puede corregir. */
function ControlRechazo({
  nombre,
  marcado,
  motivo,
  error,
  onAlternar,
  onMotivo,
}: {
  nombre: string;
  marcado: boolean;
  motivo: string;
  error: boolean;
  onAlternar: () => void;
  onMotivo: (texto: string) => void;
}) {
  return (
    <View style={estilos.control}>
      <Pulsable
        onPress={onAlternar}
        tacto="seleccion"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado }}
        accessibilityLabel={`Rechazar ${nombre}`}
        style={({ pressed }) => [
          estilos.casilla,
          pressed && estilos.casillaPresionada,
        ]}
      >
        <View style={[estilos.caja, marcado && estilos.cajaMarcada]}>
          {marcado && (
            <Palomita
              color={COLORES.textoSobreColor}
              tamano={ESPACIADO.lg + ESPACIADO.xs}
            />
          )}
        </View>
        <Text
          style={[estilos.textoCasilla, marcado && estilos.textoCasillaMarcada]}
        >
          {marcado ? 'Marcado para rechazar' : 'Rechazar este producto'}
        </Text>
      </Pulsable>
      {marcado && (
        <CampoTexto
          etiqueta="Motivo del rechazo"
          valor={motivo}
          onCambiar={onMotivo}
          ejemplo="Ej. en el camión hay 2 cajas, no 3"
          multilinea
          maxLength={200}
          autoFocus
          ayuda={`Mínimo ${MOTIVO_MINIMO} caracteres.`}
          error={
            error
              ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).`
              : null
          }
        />
      )}
    </View>
  );
}

function BarraAcciones({ children }: { children: ReactNode }) {
  const margenes = useSafeAreaInsets();
  // Sin nada que hacer (enviada, en otro estado) no ocupa lugar.
  const hijos = Array.isArray(children)
    ? children.filter(Boolean)
    : children
      ? [children]
      : [];
  if (hijos.length === 0) return null;
  // Llega al borde de abajo y absorbe el área segura, como la barra del conteo.
  return (
    <View
      style={[estilos.barra, { paddingBottom: margenes.bottom + ESPACIADO.md }]}
    >
      <View style={estilos.columnaBarra}>{children}</View>
    </View>
  );
}

/**
 * Para qué día sale el camión, al frente y en grande, con «Cambiar» ahí mismo.
 * Un vendedor equivocado de fecha pasaba por el contador y por la
 * autorización sin que nadie lo notara: aquí es lo primero que se lee.
 */
function BloqueSalida({
  carga,
  onSesionVencida,
}: {
  carga: CargaDetalle;
  onSesionVencida: () => void;
}) {
  const dia = carga.evento.dia;
  if (!dia) return null;
  const relativo = diaRelativo(dia, diaNegocio(new Date()));
  return (
    <Tarjeta style={estilos.salida}>
      <View
        style={estilos.textosSalida}
        accessible
        accessibilityLabel={`Sale ${relativo ? `${relativo.toLowerCase()}, ` : ''}${formatearDia(dia)}`}
      >
        <Text style={estilos.rotuloSalida}>
          {relativo ? `Sale ${relativo.toLowerCase()}` : 'Sale el'}
        </Text>
        <Text style={estilos.diaSalida}>{formatearDia(dia)}</Text>
      </View>
      {puedeCambiarFecha(carga.evento.estado) && (
        <CambiarFechaSupervisor
          carga={carga}
          onSesionVencida={onSesionVencida}
          texto="Cambiar"
        />
      )}
    </Tarjeta>
  );
}

function Pantalla({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
      <BarraSuperior titulo={titulo} subtitulo={subtitulo} />
      {children}
    </SafeAreaView>
  );
}

const TAMANO_CAJA = ESPACIADO.xl + ESPACIADO.xs;

const estilos = StyleSheet.create({
  marcoLista: {
    flex: 1,
  },
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  panel: {
    marginTop: RITMO.relacionado,
    gap: RITMO.interno,
  },
  instruccion: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  tituloListo: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.capturadoTexto,
  },
  texto: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontFamily: FUENTE.negrita,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  lectura: {
    marginTop: RITMO.grupo,
    gap: RITMO.interno,
  },
  cabeceraLectura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  tituloLectura: {
    flex: 1,
    ...TIPOGRAFIA.titulo,
  },
  alternar: {
    minHeight: TOQUE_MINIMO,
    marginTop: RITMO.relacionado,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.lg,
    backgroundColor: COLORES.azulSuave,
    // Pastilla en un renglón; si el texto baja a dos, bloque redondeado y no óvalo.
    borderRadius: TOQUE_MINIMO / 2,
  },
  alternarPresionado: {
    backgroundColor: COLORES.marcaTinte,
  },
  textoAlternar: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  cifrasEnvio: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  cifraEnvio: {
    flex: 1,
    gap: 2,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.control,
  },
  numeroEnvio: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.extraNegrita,
    color: COLORES.texto,
    ...CIFRAS,
  },
  rotuloEnvio: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  listaRechazo: {
    gap: RITMO.interno,
  },
  botonPie: {
    marginTop: RITMO.interno,
  },
  // Acciones fijas abajo, en la barra inferior de la app: siempre a la mano del pulgar.
  barra: {
    ...BARRA_INFERIOR,
    paddingBottom: ESPACIADO.md,
  },
  bandejaAcciones: {
    gap: RITMO.relacionado,
    paddingBottom: ESPACIADO.xs,
  },
  botonMas: {
    flexGrow: 0,
    flexBasis: '34%',
  },
  columnaBarra: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
  salida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    // Mismo aire que deja el resumen arriba: la fecha va primero, no pegada.
    marginTop: RITMO.margen,
  },
  textosSalida: {
    flex: 1,
    gap: 2,
  },
  rotuloSalida: ETIQUETA_DATO,
  diaSalida: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  botonFila: {
    flex: 1,
  },
  control: {
    gap: RITMO.relacionado,
    marginTop: RITMO.interno,
  },
  casilla: {
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.sm,
    marginHorizontal: -ESPACIADO.sm,
    borderRadius: RADIOS.medio,
  },
  casillaPresionada: {
    backgroundColor: COLORES.superficieHonda,
  },
  caja: {
    width: TAMANO_CAJA,
    height: TAMANO_CAJA,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chico,
  },
  // Rechazar es rojo: lo marcado se ve de un vistazo al recorrer la lista.
  cajaMarcada: {
    backgroundColor: COLORES.error,
    borderColor: COLORES.error,
  },
  textoCasilla: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  textoCasillaMarcada: {
    fontFamily: FUENTE.negrita,
    color: COLORES.errorTexto,
  },
});
