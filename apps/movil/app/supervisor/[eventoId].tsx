import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useDetalleHistorial } from '../../src/api/hooks-historial';
import { useAutorizarCarga, useRechazarProductos } from '../../src/api/hooks-supervisor';
import { cerrarSesion } from '../../src/api/sesion';
import { Boton, CampoTexto, EstadoVacio, Tarjeta } from '../../src/componentes/base';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import { estadoDeCarga, type CargaDetalle, type ProductoDetalle } from '../../src/historial/modelo-historial';
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
import { CancelarCargaSupervisor } from '../../src/supervisor/CancelarCargaSupervisor';
import { AvisoEnvio, ESTADOS_ENVIABLES, ModalEnviar, textoBotonEnvio, useEnvioHandy } from '../../src/supervisor/EnvioHandy';
import { ModalConfirmacion } from '../../src/supervisor/ModalConfirmacion';
import { ModalModificar } from '../../src/supervisor/ModalModificar';
import {
  accionCancelacion,
  MOTIVO_MINIMO,
  motivoValido,
  rechazosParaEnviar,
} from '../../src/supervisor/modelo-supervisor';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { BORDES, COLORES, ESPACIADO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/**
 * Revisión de una carga que espera el visto bueno del supervisor. Se ve igual
 * que en el historial (misma vista consolidada) y abajo van sus tres salidas:
 * autorizar, rechazar productos puntuales o modificar una cantidad. Ya
 * autorizada, desde aquí mismo se envía a Handy. En cualquier estado que lo
 * admita, también se cancela (ya enviada, se cancela en Handy).
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

function mensajeError(e: unknown, porDefecto: string): { titulo: string; detalle: string; tono?: 'atencion' } {
  if (e instanceof ErrorRed) {
    return { titulo: 'Sin conexión', detalle: 'No se registró nada. Inténtalo cuando haya señal.', tono: 'atencion' };
  }
  if (e instanceof ErrorApi && e.estado === 409) {
    return {
      titulo: 'La carga ya no espera tu autorización',
      detalle: 'Otro supervisor pudo haber actuado sobre ella hace un momento. Cierra para ver cómo quedó.',
    };
  }
  return { titulo: porDefecto, detalle: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.' };
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
  const [errorRechazo, setErrorRechazo] = useState<ReturnType<typeof mensajeError> | null>(null);
  const [confirmandoAutorizacion, setConfirmandoAutorizacion] = useState(false);
  const [errorAutorizacion, setErrorAutorizacion] = useState<ReturnType<typeof mensajeError> | null>(null);
  const [aModificar, setAModificar] = useState<ProductoDetalle | null>(null);
  const lista = useRef<SectionList<ProductoDetalle, SeccionFamilia>>(null);

  const vencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const estado = carga?.evento.estado ?? null;
  // Lo que se envía aparece arriba de la lista: al cambiar, se lleva ahí la vista.
  useEffect(() => {
    if (envio.resultado) lista.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
  }, [envio.resultado]);

  // Si la carga deja de esperar autorización (otro supervisor actuó), no queda modo que sostener.
  const modo: Modo = estado === 'EN_ESPERA_AUTORIZACION' ? modoElegido : 'revisar';

  const secciones = useMemo(() => seccionesDeCarga(carga), [carga]);

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
        <ErrorCarga error={consulta.error} onReintentar={() => void consulta.refetch()} />
      </Pantalla>
    );
  }

  if (!carga) {
    return (
      <Pantalla titulo="Autorizar carga">
        <CargaIlegible onReintentar={() => void consulta.refetch()} reintentando={consulta.isFetching} />
      </Pantalla>
    );
  }

  const enEspera = estado === 'EN_ESPERA_AUTORIZACION';
  const marcados = Object.keys(seleccion).length;

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
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
        dejarAviso({ tipo: 'rechazada', ruta: carga.evento.rutaNombre, productos: productos.length });
        volverACola();
      },
      onError: (e) => {
        if (e instanceof ErrorApi && e.estado === 401) return sesionVencida();
        setErrorRechazo(mensajeError(e, 'No se pudieron rechazar los productos'));
      },
    });
  };

  const confirmarAutorizacion = () => {
    autorizar.mutate(undefined, {
      onSuccess: () => {
        setConfirmandoAutorizacion(false);
        setErrorAutorizacion(null);
      },
      onError: (e) => {
        if (e instanceof ErrorApi && e.estado === 401) return sesionVencida();
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
              onMotivo={(texto) => setSeleccion((actual) => ({ ...actual, [producto.code]: texto }))}
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

  return (
    <Pantalla {...titulosCarga(carga)}>
      <SectionList<ProductoDetalle, SeccionFamilia>
        ref={lista}
        style={estilosVistaCarga.lista}
        contentContainerStyle={estilosVistaCarga.contenidoLista}
        sections={secciones}
        extraData={{ modo, seleccion, intentoRechazo }}
        keyExtractor={(p) => p.code}
        stickySectionHeadersEnabled
        initialNumToRender={30}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <ResumenCarga carga={carga} />
            <PanelEstado carga={carga} modo={modo} envio={envio} />
          </>
        }
        ListEmptyComponent={
          <EstadoVacio
            icono="caja"
            titulo="Sin productos"
            detalle="Esta carga no trae productos contados. Actualiza; si sigue así, no la autorices y revisa con quien la contó."
            enLinea
          />
        }
        renderSectionHeader={({ section }) => <EncabezadoFamilia familia={section.familia} />}
        renderItem={({ item }) => renderProducto(item)}
      />

      <BarraAcciones>
        {enEspera && modo === 'revisar' && (
          <>
            <Boton
              texto="Autorizar carga"
              onPress={() => {
                setErrorAutorizacion(null);
                setConfirmandoAutorizacion(true);
              }}
              deshabilitado={secciones.length === 0}
            />
            <View style={estilos.filaBotones}>
              <Boton texto="Rechazar productos" variante="secundario" onPress={() => cambiarModo('rechazar')} style={estilos.botonFila} />
              <Boton texto="Modificar cantidad" variante="secundario" onPress={() => cambiarModo('modificar')} style={estilos.botonFila} />
            </View>
          </>
        )}
        {enEspera && modo === 'rechazar' && (
          <View style={estilos.filaBotones}>
            <Boton texto="Cancelar" variante="secundario" onPress={() => cambiarModo('revisar')} style={estilos.botonFila} />
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
          <Boton texto="Cancelar" variante="secundario" onPress={() => cambiarModo('revisar')} />
        )}
        {estado !== null && ESTADOS_ENVIABLES.has(estado) && (
          <Boton
            texto={textoBotonEnvio(estado)}
            variante={estado === 'ERROR_ENVIO' ? 'secundario' : 'primario'}
            onPress={envio.pedirConfirmacion}
            cargando={envio.enviando}
            textoCargando="Enviando…"
          />
        )}
        {modo === 'revisar' && accionCancelacion(estado) !== null && (
          <CancelarCargaSupervisor carga={carga} onSesionVencida={sesionVencida} />
        )}
      </BarraAcciones>

      <ModalConfirmacion
        visible={confirmandoAutorizacion}
        titulo="¿Autorizar esta carga?"
        textoConfirmar="Autorizar"
        textoCargando="Autorizando…"
        cargando={autorizar.isPending}
        error={errorAutorizacion}
        onConfirmar={confirmarAutorizacion}
        onCerrar={() => setConfirmandoAutorizacion(false)}
      >
        <Text style={estilos.texto}>
          Después de autorizar, la carga de <Text style={estilos.negrita}>{carga.evento.rutaNombre}</Text> queda lista para
          enviarse a Handy con estas cantidades. Ya no podrás rechazar productos ni modificar cantidades.
        </Text>
      </ModalConfirmacion>

      <ModalConfirmacion
        visible={confirmandoRechazo}
        titulo={marcados === 1 ? '¿Rechazar 1 producto?' : `¿Rechazar ${marcados} productos?`}
        textoConfirmar="Rechazar"
        textoCargando="Rechazando…"
        variante="peligro"
        cargando={rechazar.isPending}
        error={errorRechazo}
        onConfirmar={confirmarRechazo}
        onCerrar={() => setConfirmandoRechazo(false)}
      >
        <Text style={estilos.texto}>
          Solo estos vuelven a resolverse: alguien captura la cantidad y otra persona la confirma con su PIN. El resto de la
          carga se queda como está. Mientras tanto la carga sale de tu lista.
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
          dejarAviso({ tipo: 'modificada', ruta: carga.evento.rutaNombre, producto: producto.nombre, cantidad });
          volverACola();
        }}
      />
    </Pantalla>
  );
}

function nombresMarcados(carga: CargaDetalle, seleccion: Readonly<Record<string, string>>) {
  const productos = carga.familias.flatMap((f) => f.productos);
  return Object.entries(seleccion).map(([code, motivo]) => ({
    code,
    nombre: productos.find((p) => p.code === code)?.nombre ?? code,
    motivo,
  }));
}

/**
 * Lo que toca hacer ahora, bajo el resumen: la instrucción del modo, cómo va
 * el envío o por qué ya no hay nada que autorizar.
 */
function PanelEstado({ carga, modo, envio }: { carga: CargaDetalle; modo: Modo; envio: ReturnType<typeof useEnvioHandy> }) {
  const estado = carga.evento.estado;

  if (estado === 'EN_ESPERA_AUTORIZACION') {
    const texto =
      modo === 'rechazar'
        ? 'Marca solo los productos que están mal y escribe por qué. Solo esos vuelven a resolverse; el resto de la carga no se toca.'
        : modo === 'modificar'
          ? 'Toca «Modificar cantidad» en el producto a corregir. Solo uno por ronda: al guardarlo, la carga vuelve a diferencias por resolver.'
          : 'Revisa las cantidades. Ninguna carga llega a Handy sin tu autorización.';
    return (
      <Tarjeta elevacion={0} tintada="marca" compacta style={estilos.panel}>
        <Text style={estilos.instruccion}>{texto}</Text>
      </Tarjeta>
    );
  }

  if (estado === 'LISTA_PARA_ENVIAR' && !envio.resultado) {
    return (
      <Tarjeta elevacion={0} tintada="capturado" compacta style={estilos.panel}>
        <Text style={estilos.tituloListo}>Autorizada</Text>
        <Text style={estilos.texto}>Falta enviarla a Handy: hasta entonces el camión no tiene esta carga en su ruta.</Text>
      </Tarjeta>
    );
  }

  if (estado !== null && (ESTADOS_ENVIABLES.has(estado) || estado === 'ENVIADA')) {
    return <AvisoEnvio estado={estado} envio={envio} />;
  }

  return (
    <Tarjeta elevacion={0} tintada="pendiente" compacta style={estilos.panel}>
      <Text style={estilos.texto}>
        Esta carga está en «{estadoDeCarga(estado).etiqueta}»: no espera tu autorización. Aquí solo se consulta.
      </Text>
    </Tarjeta>
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
      <Pressable
        onPress={onAlternar}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcado }}
        accessibilityLabel={`Rechazar ${nombre}`}
        style={({ pressed }) => [estilos.casilla, pressed && estilos.casillaPresionada]}
      >
        <View style={[estilos.caja, marcado && estilos.cajaMarcada]}>{marcado && <View style={estilos.palomita} />}</View>
        <Text style={[estilos.textoCasilla, marcado && estilos.textoCasillaMarcada]}>
          {marcado ? 'Marcado para rechazar' : 'Rechazar este producto'}
        </Text>
      </Pressable>
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
          error={error ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).` : null}
        />
      )}
    </View>
  );
}

function BarraAcciones({ children }: { children: ReactNode }) {
  // Sin nada que hacer (enviada, en otro estado) no ocupa lugar.
  const hijos = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (hijos.length === 0) return null;
  return (
    <View style={estilos.barra}>
      <View style={estilos.columnaBarra}>{children}</View>
    </View>
  );
}

function Pantalla({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
      <BarraSuperior titulo={titulo} subtitulo={subtitulo} />
      {children}
    </SafeAreaView>
  );
}

const TAMANO_CAJA = ESPACIADO.xl + ESPACIADO.xs;

const estilos = StyleSheet.create({
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
    color: COLORES.marcaHonda,
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
  listaRechazo: {
    gap: RITMO.interno,
  },
  botonPie: {
    marginTop: RITMO.interno,
  },
  // Acciones fijas abajo, en blanco sobre el fondo tintado: siempre a la mano.
  barra: {
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderTopWidth: BORDES.grueso,
    borderTopColor: COLORES.marca,
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
  // Palomita: dos lados de un rectángulo, girados (como el icono «listo»).
  palomita: {
    width: ESPACIADO.sm,
    height: ESPACIADO.md + ESPACIADO.xs,
    marginTop: -ESPACIADO.xs / 2,
    borderRightWidth: BORDES.grueso,
    borderBottomWidth: BORDES.grueso,
    borderColor: COLORES.textoSobreColor,
    transform: [{ rotate: '45deg' }],
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
