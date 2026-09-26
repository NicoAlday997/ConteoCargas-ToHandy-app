import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useFocusEffect } from 'expo-router';

import { ETIQUETAS_ROL } from '../src/api/auth';
import {
  cancelarCarga,
  CODIGO_FECHA_INVALIDA,
  CODIGO_YA_TIENE_CARGA,
  ETIQUETAS_TIPO_CARGA,
  listarDiasRecargables,
  type MotivoSinDiasRecargables,
  obtenerEvento,
  type TipoCarga,
} from '../src/api/cargas';
import { ErrorApi, ErrorRed } from '../src/api/cliente';
import { clavesCargas, useAbrirSesion, useIniciarCarga } from '../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../src/api/sesion';
import { obtenerToken } from '../src/api/token';
import {
  BloqueError,
  BloqueEsqueleto,
  Boton,
  CampoTexto,
  Encabezado,
  Esqueleto,
  FilaMenu,
  GrupoMenu,
  LineaEsqueleto,
  Seccion,
} from '../src/componentes/base';
import { guardarCargaAbierta, obtenerCargaAbierta, type CargaAbierta } from '../src/conteo/almacen-conteo';
import {
  descartarCargaNoDisponible,
  tomarAvisoCargaNoDisponible,
  verificarCargaAbierta,
} from '../src/conteo/carga-no-disponible';
import { esBorrado, obtenerConteoLocal } from '../src/conteo/almacen-local';
import { detenerColas, estaConectado } from '../src/conteo/cola-sincronizacion';
import { diaDesdeApi, diaNegocio, textoSalida } from '../src/conteo/fecha-operativa';
import { SelectorFechaOperativa, type ConflictoFecha } from '../src/conteo/SelectorFechaOperativa';
import { AccesoConflictos } from '../src/discrepancias/AccesoConflictos';
import { AccesoFactores } from '../src/factores/AccesoFactores';
import { AccesoAutorizaciones } from '../src/supervisor/AccesoAutorizaciones';
import { ModalConfirmacion } from '../src/supervisor/ModalConfirmacion';
import { ColaVerificacion } from '../src/verificacion/ColaVerificacion';
import { ANCHO_MODAL, CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

/** Una columna legible también en tablet. */
const ANCHO_CONTENIDO = 560;

type EstadoSesion =
  | { tipo: 'verificando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'activa'; usuario: UsuarioSesion | null };

export default function PantallaInicio() {
  const margenes = useSafeAreaInsets();
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'verificando' });

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const [token, usuario] = await Promise.all([obtenerToken(), obtenerUsuarioSesion()]);
      // Un PIN temporal sin cambiar no da acceso a la app (docs/06 §3.1).
      if (!token || usuario?.debeCambiarPin) {
        await cerrarSesion();
        if (vigente) setEstado({ tipo: 'sin-sesion' });
        return;
      }
      if (vigente) setEstado({ tipo: 'activa', usuario });
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (estado.tipo === 'verificando') {
    return <EsqueletoInicio />;
  }

  if (estado.tipo === 'sin-sesion') {
    return <Redirect href="/login" />;
  }

  const { usuario } = estado;

  const cuenta = usuario?.rolApp === 'VENDEDOR' || usuario?.rolApp === 'CONTADOR';

  // Inicio por rol (docs/06 §3.2-3.3); el supervisor, sus autorizaciones, los empaques y las plantillas. El
  // historial es para los tres: qué ve cada quien lo decide el servidor.
  // Densidad generosa: son pocas acciones y cada una importa. Banda de marca
  // arriba (quién está en sesión) y, debajo, las acciones sobre el fondo
  // tintado, separadas por aire. El margen inferior lo pone la lista para que
  // el azul solo cubra el borde superior.
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'left', 'right']}>
      <View style={estilos.bandaMarca}>
        <View style={estilos.columna}>
          <Text style={estilos.nombre} accessibilityRole="header">
            {usuario?.nombreCompleto ?? 'Usuario'}
          </Text>
          {usuario?.rolApp && <Text style={estilos.rol}>{ETIQUETAS_ROL[usuario.rolApp]}</Text>}
        </View>
      </View>
      <ScrollView
        style={estilos.cuerpo}
        contentContainerStyle={[estilos.contenido, { paddingBottom: ESPACIADO.xxxl + margenes.bottom }]}
      >
        {cuenta && usuario && (
          <>
            <AccesoConflictos />
            <AccionesCarga usuario={usuario} />
          </>
        )}
        {/* Primero lo que frena al camión: ninguna carga llega a Handy sin autorización. */}
        {usuario?.rolApp === 'SUPERVISOR' && <AccesoAutorizaciones />}
        {/* Mientras haya empaques sin confirmar, esos productos no se cuentan en paquetes. */}
        {usuario?.rolApp === 'SUPERVISOR' && <AccesoFactores />}
        <GrupoMenu>
          {usuario?.rolApp === 'SUPERVISOR' && (
            <FilaMenu
              texto="Plantillas de carga"
              detalle="Qué productos ve cada ruta al contar"
              onPress={() => router.push('/plantillas')}
            />
          )}
          {usuario && <FilaMenu texto="Historial de cargas" onPress={() => router.push('/historial')} />}
          <BotonCerrarSesion usuarioId={usuario?.id ?? null} />
        </GrupoMenu>
      </ScrollView>
    </SafeAreaView>
  );
}

/** La forma del inicio mientras se lee la sesión: la banda con el nombre y el bloque de acciones. */
function EsqueletoInicio() {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'left', 'right']}>
      <Esqueleto etiqueta="Abriendo la app">
        <View style={estilos.bandaMarca}>
          <View style={estilos.columna}>
            <LineaEsqueleto nivel="display" ancho="70%" sobreMarca />
            <LineaEsqueleto nivel="cuerpo" ancho="30%" sobreMarca />
          </View>
        </View>
      </Esqueleto>
      <View style={[estilos.cuerpo, estilos.contenido]}>
        <Esqueleto etiqueta="Cargando acciones" style={estilos.esqueletoAcciones}>
          <LineaEsqueleto nivel="subtitulo" ancho="40%" />
          <BloqueEsqueleto alto={TOQUE_MINIMO * 2} />
          <BloqueEsqueleto alto={TOQUE_MINIMO} />
        </Esqueleto>
      </View>
    </SafeAreaView>
  );
}

function sesionVencida() {
  void cerrarSesion().then(() => router.replace('/login'));
}

function salir() {
  // Sin token la cola no puede enviar; se retoma al volver a abrir el conteo.
  detenerColas();
  void cerrarSesion().then(() => router.replace('/login'));
}

interface ProgresoCarga {
  capturados: number;
  total: number | null;
  porEnviar: number;
}

/**
 * Con una carga a medias, cerrar sesión pregunta antes. No impide nada: solo
 * quita la duda de si se pierde lo contado.
 */
function BotonCerrarSesion({ usuarioId }: { usuarioId: string | null }) {
  const [progreso, setProgreso] = useState<ProgresoCarga | null>(null);
  const [consultando, setConsultando] = useState(false);

  const alTocar = async () => {
    if (!usuarioId) return salir();
    setConsultando(true);
    try {
      const carga = await obtenerCargaAbierta(usuarioId);
      if (!carga) return salir();
      const local = await obtenerConteoLocal(carga.eventoId, carga.sesionId);
      const items = Object.values(local?.items ?? {});
      setProgreso({
        capturados: items.filter((i) => !esBorrado(i)).length,
        total: local?.totalProductos ?? null,
        porEnviar: items.filter((i) => !i.sincronizado).length,
      });
    } catch {
      salir();
    } finally {
      setConsultando(false);
    }
  };

  return (
    <>
      <FilaMenu texto="Cerrar sesión" salida onPress={() => void alTocar()} cargando={consultando} />
      <Modal visible={progreso !== null} transparent animationType="none" onRequestClose={() => setProgreso(null)}>
        <View style={estilos.fondoModal}>
          <View style={estilos.modal}>
            <Encabezado titulo="Tienes una carga en proceso" variante="plano" />
            {progreso && (
              <>
                <Text style={estilos.detalleModal}>
                  Llevas <Text style={estilos.negrita}>{progreso.capturados}</Text>
                  {progreso.total !== null ? ` de ${progreso.total}` : ''} productos capturados.
                </Text>
                <Text style={estilos.detalleModal}>
                  Tu progreso queda guardado en este teléfono y podrás continuar donde te quedaste al volver a entrar.
                </Text>
                {progreso.porEnviar > 0 && (
                  <Text style={estilos.detalleModal}>
                    {progreso.porEnviar === 1
                      ? '1 cambio todavía no llega al servidor: se enviará'
                      : `${progreso.porEnviar} cambios todavía no llegan al servidor: se enviarán`}{' '}
                    cuando vuelvas a entrar y abras la carga con señal.
                  </Text>
                )}
              </>
            )}
            <View style={estilos.botonesModal}>
              <Boton texto="Cancelar" variante="secundario" onPress={() => setProgreso(null)} style={estilos.botonModal} />
              <Boton
                texto="Cerrar sesión"
                onPress={() => {
                  setProgreso(null);
                  salir();
                }}
                style={estilos.botonModal}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const MENSAJE_SIN_RED_INICIAR =
  'Sin conexión. Para iniciar una carga necesitas señal: el servidor la crea y te manda la lista de productos. Ya iniciada, puedes contar sin señal.';
const DETALLE_SIN_RED_INICIAR =
  'Para iniciar una carga necesitas señal: el servidor la crea y te manda la lista de productos. Ya iniciada, puedes contar sin señal.';

function irAConteo(carga: CargaAbierta) {
  router.push({
    pathname: '/conteo/[eventoId]',
    params: {
      eventoId: carga.eventoId,
      sesionId: carga.sesionId,
      tipo: carga.tipo ?? '',
      fechaOperativa: carga.fechaOperativa ?? '',
    },
  });
}

/** Qué hacer con un error al crear la carga o abrir la existente. `null` = ya se atendió. */
function mensajeDeError(e: unknown, porDefecto: string): string | null {
  if (e instanceof ErrorApi && e.estado === 401) {
    sesionVencida();
    return null;
  }
  if (e instanceof ErrorRed) return MENSAJE_SIN_RED_INICIAR;
  if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_FECHA_INVALIDA) {
    // Solo pasa si el reloj del teléfono va atrasado: la app nunca ofrece días pasados.
    return 'Ese día ya pasó según el servidor. Revisa la fecha y hora de tu teléfono y elige de nuevo.';
  }
  return e instanceof Error && e.message ? e.message : porDefecto;
}

/**
 * Si hay una carga a medias en este dispositivo, la única acción es
 * continuarla: abrir otra dejaría la primera sin finalizar.
 */
function AccionesCarga({ usuario }: { usuario: UsuarioSesion }) {
  const iniciar = useIniciarCarga();
  const abrir = useAbrirSesion();
  const clienteConsultas = useQueryClient();
  // `undefined` mientras se consulta: no mostrar "Iniciar" a quien debe "Continuar".
  const [cargaAbierta, setCargaAbierta] = useState<CargaAbierta | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Selector de fecha abierto para este tipo de carga (`null` = cerrado).
  const [tipoAIniciar, setTipoAIniciar] = useState<TipoCarga | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoFecha | null>(null);
  const [abriendoExistente, setAbriendoExistente] = useState(false);
  // Lo que se intentaba cuando faltó la señal (o falló la consulta de salidas): "Reintentar" vuelve a eso.
  const [tipoAReintentar, setTipoAReintentar] = useState<TipoCarga | null>(null);
  // El día de la ruta abierta en Handy: el único en que se puede recargar.
  const [diasRecarga, setDiasRecarga] = useState<string[] | null>(null);
  // `false`: Handy no respondió; el día sale solo de lo enviado y se advierte.
  const [recargaVerificada, setRecargaVerificada] = useState(true);
  const [consultandoDias, setConsultandoDias] = useState(false);
  // La consulta respondió que no hay a qué recargar, y por qué (`null` = no se muestra).
  const [sinSalidas, setSinSalidas] = useState<MotivoSinDiasRecargables | 'SIN_SALIDAS' | null>(null);
  // La carga guardada en el teléfono ya no existía en el servidor y se quitó.
  const [cargaNoDisponible, setCargaNoDisponible] = useState(false);
  // Estado de la carga abierta según el servidor (`null` = no se pudo saber, p. ej. sin señal).
  const [estadoCargaAbierta, setEstadoCargaAbierta] = useState<string | null>(null);
  // El vendedor acaba de cancelar su carga: se le confirma en el inicio.
  const [cargaCancelada, setCargaCancelada] = useState(false);

  // Al volver de la pantalla de conteo (finalizada o no) se relee. Antes de
  // ofrecer "Continuar carga" se pregunta al servidor si sigue existiendo: si
  // se canceló, continuarla fallaría sin salida. Sin señal se ofrece igual.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      if (tomarAvisoCargaNoDisponible()) setCargaNoDisponible(true);
      void (async () => {
        const carga = await obtenerCargaAbierta(usuario.id);
        if (!carga) {
          if (vigente) setCargaAbierta(null);
          return;
        }
        const verificacion = await verificarCargaAbierta(carga);
        if (verificacion === 'sesion-vencida') {
          if (vigente) sesionVencida();
          return;
        }
        if (verificacion.vigencia === 'no-disponible') {
          await descartarCargaNoDisponible(usuario.id, carga);
          if (vigente) {
            setCargaNoDisponible(true);
            setCargaAbierta(null);
          }
          return;
        }
        if (vigente) {
          setEstadoCargaAbierta(verificacion.estado);
          setCargaAbierta(carga);
        }
      })();
      // Las listas del servidor también: al volver de contar o de resolver, ya cambiaron.
      void clienteConsultas.invalidateQueries({ queryKey: clavesCargas.pendientesVerificacion });
      void clienteConsultas.invalidateQueries({ queryKey: clavesCargas.conflictosPendientes });
      return () => {
        vigente = false;
      };
    }, [usuario.id, clienteConsultas]),
  );

  /** El contador abrió (o retomó) su verificación: queda como su carga en proceso. */
  const abrirVerificacion = useCallback(
    (carga: CargaAbierta) => {
      void guardarCargaAbierta(usuario.id, carga).finally(() => {
        setCargaAbierta(carga);
        irAConteo(carga);
      });
    },
    [usuario.id],
  );

  const ocupado = iniciar.isPending || abrir.isPending || abriendoExistente || consultandoDias;

  const cerrarSelector = () => {
    setTipoAIniciar(null);
    setDiasRecarga(null);
    setConflicto(null);
    setError(null);
  };

  /**
   * Primero la fecha: el evento se crea ya con ella. La carga inicial elige
   * hoy o mañana; la recarga no elige libremente: se suma a una salida que ya
   * está en Handy, así que solo se ofrecen esas (y con una sola, se confirma).
   */
  const pedirFecha = async (tipo: TipoCarga) => {
    setError(null);
    setCargaNoDisponible(false);
    setCargaCancelada(false);
    setSinSalidas(null);
    setTipoAReintentar(null);
    // Contar sí funciona sin señal; crear la carga no: se dice antes de elegir fecha.
    if (!estaConectado(await NetInfo.fetch())) {
      setError(MENSAJE_SIN_RED_INICIAR);
      setTipoAReintentar(tipo);
      return;
    }
    setConflicto(null);
    if (tipo === 'INICIAL') {
      setDiasRecarga(null);
      setTipoAIniciar(tipo);
      return;
    }
    setConsultandoDias(true);
    try {
      const { dias, motivo, verificadoConHandy } = await listarDiasRecargables();
      if (dias.length === 0) {
        setSinSalidas(motivo ?? 'SIN_SALIDAS');
        return;
      }
      setDiasRecarga(dias);
      setRecargaVerificada(verificadoConHandy);
      setTipoAIniciar(tipo);
    } catch (e) {
      // "No pude preguntar" no es "no hay salidas": se ofrece reintentar.
      const mensaje = mensajeDeError(e, 'No se pudieron consultar las salidas de tu ruta.');
      if (mensaje === null) return;
      setError(mensaje);
      setTipoAReintentar(tipo);
    } finally {
      setConsultandoDias(false);
    }
  };

  const entrarAConteo = async (carga: CargaAbierta) => {
    await guardarCargaAbierta(usuario.id, carga);
    setCargaAbierta(carga);
    setTipoAIniciar(null);
    setDiasRecarga(null);
    setConflicto(null);
    irAConteo(carga);
  };

  const iniciarCarga = async (tipo: TipoCarga, fechaOperativa: string) => {
    setError(null);
    try {
      const respuesta = await iniciar.mutateAsync({ tipo, fechaOperativa });
      const eventoId = respuesta?.evento?.id;
      if (!eventoId) throw new Error('El servidor no devolvió la carga creada.');
      // El backend ya abre la sesión del vendedor al crear el evento; solo si
      // no viniera se abre aparte (abrirla dos veces responde 409).
      const sesionId = respuesta?.sesion?.id ?? (await abrir.mutateAsync(eventoId))?.id;
      if (!sesionId) throw new Error('El servidor no devolvió la sesión de conteo.');

      await entrarAConteo({
        eventoId,
        sesionId,
        tipo: respuesta?.evento?.tipo ?? tipo,
        fechaOperativa: diaDesdeApi(respuesta?.evento?.fechaOperativa) ?? fechaOperativa,
      });
    } catch (e) {
      // Una sola carga inicial por ruta y día (hasta que una pase la
      // verificación no se generan otras versiones): se ofrece la que ya existe.
      const existente = e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_YA_TIENE_CARGA ? e.cuerpo.eventoId : null;
      if (existente) {
        setConflicto({ eventoId: existente, dia: fechaOperativa });
        return;
      }
      setError(mensajeDeError(e, 'No se pudo iniciar la carga.'));
    }
  };

  /**
   * La carga que ya existe: si la sesión del vendedor sigue abierta se vuelve
   * a contar; si ya la finalizó, se abre donde va (discrepancias o historial).
   */
  const continuarExistente = async ({ eventoId, dia }: ConflictoFecha) => {
    setError(null);
    setAbriendoExistente(true);
    try {
      const respuesta = await obtenerEvento(eventoId);
      const evento = respuesta?.evento;
      const mia = respuesta?.sesiones?.find((s) => s.usuarioAppId === usuario.id);
      if (mia?.id && mia.estado === 'ABIERTA') {
        await entrarAConteo({
          eventoId,
          sesionId: mia.id,
          tipo: evento?.tipo ?? 'INICIAL',
          fechaOperativa: diaDesdeApi(evento?.fechaOperativa) ?? dia,
        });
        return;
      }
      cerrarSelector();
      if (evento?.estado === 'CONFLICTOS_PENDIENTES') {
        router.push({ pathname: '/discrepancias/[eventoId]', params: { eventoId } });
      } else {
        router.push({ pathname: '/historial/[eventoId]', params: { eventoId } });
      }
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 403) {
        // El servidor solo deja ver la carga a quien contó en ella.
        setError(
          'Esa carga la inició otra persona asignada a tu ruta, así que no puedes continuarla desde tu usuario. Avisa a tu supervisor.',
        );
      } else {
        setError(mensajeDeError(e, 'No se pudo abrir esa carga.'));
      }
    } finally {
      setAbriendoExistente(false);
    }
  };

  if (cargaAbierta === undefined) {
    return (
      <Esqueleto etiqueta="Revisando si tienes una carga en proceso" style={estilos.esqueletoAcciones}>
        <LineaEsqueleto nivel="subtitulo" ancho="40%" />
        <BloqueEsqueleto alto={TOQUE_MINIMO * 2} />
      </Esqueleto>
    );
  }

  const aviso = cargaNoDisponible ? <AvisoCargaNoDisponible onCerrar={() => setCargaNoDisponible(false)} /> : null;

  if (cargaAbierta) {
    // Solo mientras el vendedor cuenta (BORRADOR): una vez que finaliza, el
    // contador puede estar contando y cancelar sería una salida para cuando el
    // conteo no cuadra. Sin señal no se sabe el estado: no se ofrece.
    const puedeCancelar = usuario.rolApp === 'VENDEDOR' && estadoCargaAbierta === 'BORRADOR';
    return (
      <Seccion texto="Tienes una carga en proceso">
        <Boton
          grande
          texto="Continuar carga"
          detalle={[
            cargaAbierta.tipo ? ETIQUETAS_TIPO_CARGA[cargaAbierta.tipo] : 'Conteo sin finalizar',
            cargaAbierta.fechaOperativa
              ? textoSalida(cargaAbierta.fechaOperativa, diaNegocio(new Date())).toLowerCase()
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => irAConteo(cargaAbierta)}
        />
        {puedeCancelar && (
          <BotonCancelarCarga
            carga={cargaAbierta}
            onCancelada={async () => {
              await descartarCargaNoDisponible(usuario.id, cargaAbierta);
              void clienteConsultas.invalidateQueries({ queryKey: ['historial'] });
              setEstadoCargaAbierta(null);
              setCargaAbierta(null);
              setCargaCancelada(true);
            }}
          />
        )}
      </Seccion>
    );
  }

  // POST /eventos-carga es solo para Vendedor: el contador entra a una carga
  // ya iniciada, desde la cola de verificación (docs/06 §3.3), y cuenta en la
  // misma pantalla de conteo, a ciegas.
  if (usuario.rolApp === 'CONTADOR') {
    return (
      <>
        {aviso}
        <ColaVerificacion onAbrir={abrirVerificacion} onSesionVencida={sesionVencida} />
      </>
    );
  }

  if (usuario.rolApp !== 'VENDEDOR') return null;

  return (
    <Seccion texto="Cargas de tu ruta">
      {aviso}
      {cargaCancelada && <AvisoCargaCancelada onCerrar={() => setCargaCancelada(false)} />}
      {sinSalidas && <AvisoSinSalidas motivo={sinSalidas} onCerrar={() => setSinSalidas(null)} />}
      <Boton grande texto="Iniciar carga inicial" onPress={() => void pedirFecha('INICIAL')} deshabilitado={ocupado} />
      <Boton
        texto="Iniciar recarga"
        variante="secundario"
        onPress={() => void pedirFecha('RECARGA')}
        deshabilitado={ocupado && !consultandoDias}
        cargando={consultandoDias}
        textoCargando="Buscando salidas…"
      />
      {error && tipoAIniciar === null && (
        <BloqueError
          titulo={error === MENSAJE_SIN_RED_INICIAR ? 'Sin conexión' : 'No se pudo iniciar la carga'}
          detalle={error === MENSAJE_SIN_RED_INICIAR ? DETALLE_SIN_RED_INICIAR : error}
          tono={error === MENSAJE_SIN_RED_INICIAR ? 'atencion' : 'error'}
          onReintentar={tipoAReintentar ? () => void pedirFecha(tipoAReintentar) : undefined}
        />
      )}
      <SelectorFechaOperativa
        tipo={tipoAIniciar}
        dias={tipoAIniciar === 'RECARGA' ? diasRecarga : null}
        sinVerificarConHandy={tipoAIniciar === 'RECARGA' && !recargaVerificada}
        conflicto={conflicto}
        ocupado={ocupado}
        error={error}
        onElegir={(dia) => {
          if (tipoAIniciar) void iniciarCarga(tipoAIniciar, dia);
        }}
        onContinuarExistente={(c) => void continuarExistente(c)}
        onElegirOtra={() => {
          setConflicto(null);
          setError(null);
        }}
        onCerrar={cerrarSelector}
      />
    </Seccion>
  );
}

/**
 * El vendedor cancela la carga que abrió por error (fecha o ruta equivocada, o
 * sin querer). Solo mientras él cuenta. No se borra: queda cancelada en el
 * historial. El motivo es opcional.
 */
function BotonCancelarCarga({ carga, onCancelada }: { carga: CargaAbierta; onCancelada: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<{ titulo: string; detalle: string; tono?: 'error' | 'atencion' } | null>(null);

  const confirmar = async () => {
    setCancelando(true);
    setError(null);
    try {
      await cancelarCarga(carga.eventoId, motivo);
      setAbierto(false);
      await onCancelada();
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        setAbierto(false);
        sesionVencida();
      } else if (e instanceof ErrorRed) {
        setError({ titulo: 'Sin conexión', detalle: 'No se canceló nada. Inténtalo cuando haya señal.', tono: 'atencion' });
      } else {
        setError({
          titulo: 'No se pudo cancelar',
          detalle: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.',
        });
      }
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <Boton
        texto="Cancelar esta carga"
        variante="secundario"
        onPress={() => {
          setMotivo('');
          setError(null);
          setAbierto(true);
        }}
      />
      <ModalConfirmacion
        visible={abierto}
        titulo="¿Cancelar esta carga?"
        textoConfirmar="Sí, cancelarla"
        textoCargando="Cancelando…"
        textoCerrar="No, volver"
        variante="peligro"
        cargando={cancelando}
        error={error}
        onConfirmar={() => void confirmar()}
        onCerrar={() => setAbierto(false)}
      >
        <Text style={estilos.detalleModal}>
          <Text style={estilos.negrita}>Esto no se puede deshacer.</Text> La carga queda cancelada y lo que llevas contado en
          ella se borra de este teléfono.
        </Text>
        <Text style={estilos.detalleModal}>
          No desaparece: se queda en el historial como cancelada, con tu nombre. Si todavía hay que contar, después inicias
          una carga nueva.
        </Text>
        <CampoTexto
          etiqueta="Motivo (opcional)"
          valor={motivo}
          onCambiar={setMotivo}
          ejemplo="Ej. elegí la fecha equivocada"
          multilinea
          maxLength={200}
        />
      </ModalConfirmacion>
    </>
  );
}

function AvisoCargaCancelada({ onCerrar }: { onCerrar: () => void }) {
  return (
    <BloqueError
      tono="atencion"
      titulo="Cancelaste la carga"
      detalle="Quedó en el historial como cancelada. Si todavía hay que contar, inicia la carga correcta."
      secundaria={{ texto: 'Entendido', onPress: onCerrar }}
    />
  );
}

const DETALLE_SIN_SALIDAS: Record<MotivoSinDiasRecargables | 'SIN_SALIDAS', string> = {
  SIN_RUTA_ABIERTA:
    'No tienes una ruta abierta en Handy. La recarga le suma producto a una ruta que ya salió. Si ya liquidaste, tienes que iniciar una carga inicial nueva.',
  RUTA_NO_RECONOCIDA: 'Tu ruta abierta en Handy no se inició desde esta app, así que no puedo recargarla desde aquí.',
  SIN_RUTA_ASIGNADA: 'No tienes una ruta asignada vigente. Pide a un supervisor que te asigne una.',
  SIN_SALIDAS: 'No hay ninguna salida enviada de tu ruta. Primero tiene que salir la carga inicial.',
};

/** La recarga se suma a la ruta abierta en Handy: sin ella, no hay a qué recargar. */
function AvisoSinSalidas({
  motivo,
  onCerrar,
}: {
  motivo: MotivoSinDiasRecargables | 'SIN_SALIDAS';
  onCerrar: () => void;
}) {
  return (
    <BloqueError
      tono="atencion"
      titulo="No puedes hacer una recarga"
      detalle={DETALLE_SIN_SALIDAS[motivo]}
      secundaria={{ texto: 'Entendido', onPress: onCerrar }}
    />
  );
}

/** Explica por qué desapareció "Continuar carga": sin esto parecería que se perdió el conteo. */
function AvisoCargaNoDisponible({ onCerrar }: { onCerrar: () => void }) {
  return (
    <BloqueError
      tono="atencion"
      titulo="Esa carga ya no está disponible"
      detalle="Se canceló o se eliminó en el servidor, así que se quitó de este teléfono junto con lo que llevabas contado. Si todavía hay que contar, empieza de nuevo."
      secundaria={{ texto: 'Entendido', onPress: onCerrar }}
    />
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.marca,
  },
  bandaMarca: {
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xl,
    paddingBottom: ESPACIADO.xxl,
    backgroundColor: COLORES.marca,
  },
  columna: {
    width: '100%',
    maxWidth: ANCHO_CONTENIDO,
    alignSelf: 'center',
    gap: ESPACIADO.xs,
  },
  nombre: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSobreColor,
  },
  // El rol es un rótulo: pequeño, en mayúsculas, se retira. El nombre domina.
  rol: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.medio,
    color: COLORES.marcaClaro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cuerpo: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  // Generosa: el aire entre secciones las hace leerse como decisiones distintas.
  contenido: {
    flexGrow: 1,
    width: '100%',
    maxWidth: ANCHO_CONTENIDO,
    alignSelf: 'center',
    gap: RITMO.seccion,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xl,
  },
  esqueletoAcciones: {
    gap: RITMO.relacionado,
  },
  fondoModal: {
    flex: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
    backgroundColor: COLORES.velo,
  },
  modal: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.grande,
  },
  detalleModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: PESOS.negrita,
    ...CIFRAS,
  },
  botonesModal: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
    marginTop: ESPACIADO.sm,
  },
  botonModal: {
    flex: 1,
  },
});
