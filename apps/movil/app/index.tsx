import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useFocusEffect } from 'expo-router';

import { ETIQUETAS_ROL } from '../src/api/auth';
import {
  CODIGO_FECHA_INVALIDA,
  CODIGO_YA_TIENE_CARGA,
  ETIQUETAS_TIPO_CARGA,
  obtenerEvento,
  type TipoCarga,
} from '../src/api/cargas';
import { ErrorApi, ErrorRed } from '../src/api/cliente';
import { clavesCargas, useAbrirSesion, useIniciarCarga } from '../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../src/api/sesion';
import { obtenerToken } from '../src/api/token';
import { guardarCargaAbierta, obtenerCargaAbierta, type CargaAbierta } from '../src/conteo/almacen-conteo';
import { esBorrado, obtenerConteoLocal } from '../src/conteo/almacen-local';
import { detenerColas, estaConectado } from '../src/conteo/cola-sincronizacion';
import { diaDesdeApi, diaNegocio, textoSalida } from '../src/conteo/fecha-operativa';
import { SelectorFechaOperativa, type ConflictoFecha } from '../src/conteo/SelectorFechaOperativa';
import { AccesoConflictos } from '../src/discrepancias/AccesoConflictos';
import { ColaVerificacion } from '../src/verificacion/ColaVerificacion';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

type EstadoSesion =
  | { tipo: 'verificando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'activa'; usuario: UsuarioSesion | null };

export default function PantallaInicio() {
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
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" color={COLORES.texto} />
      </View>
    );
  }

  if (estado.tipo === 'sin-sesion') {
    return <Redirect href="/login" />;
  }

  const { usuario } = estado;

  const cuenta = usuario?.rolApp === 'VENDEDOR' || usuario?.rolApp === 'CONTADOR';

  // Inicio por rol (docs/06 §3.2-3.3); el supervisor aún no tiene el suyo. El
  // historial es para los tres: qué ve cada quien lo decide el servidor.
  return (
    <SafeAreaView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.saludo}>Sesión iniciada</Text>
        <Text style={estilos.nombre}>{usuario?.nombreCompleto ?? 'Usuario'}</Text>
        {usuario?.rolApp && <Text style={estilos.rol}>{ETIQUETAS_ROL[usuario.rolApp]}</Text>}
        {cuenta && usuario && (
          <View style={estilos.acciones}>
            <AccesoConflictos />
            <AccionesCarga usuario={usuario} />
          </View>
        )}
        {usuario && <BotonHistorial />}
        <BotonCerrarSesion usuarioId={usuario?.id ?? null} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BotonHistorial() {
  return (
    <Pressable
      onPress={() => router.push('/historial')}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado]}
    >
      <Text style={estilos.textoBoton}>Historial de cargas</Text>
    </Pressable>
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
      <Pressable
        onPress={() => void alTocar()}
        disabled={consultando}
        accessibilityRole="button"
        style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado]}
      >
        <Text style={estilos.textoBoton}>Cerrar sesión</Text>
      </Pressable>
      <Modal visible={progreso !== null} transparent animationType="none" onRequestClose={() => setProgreso(null)}>
        <View style={estilos.fondoModal}>
          <View style={estilos.modal}>
            <Text style={estilos.tituloModal} accessibilityRole="header">
              Tienes una carga en proceso
            </Text>
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
              <BotonModal texto="Cancelar" onPress={() => setProgreso(null)} />
              <BotonModal
                texto="Cerrar sesión"
                principal
                onPress={() => {
                  setProgreso(null);
                  salir();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BotonModal({ texto, onPress, principal = false }: { texto: string; onPress: () => void; principal?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.botonModal,
        principal && estilos.botonModalPrincipal,
        pressed && estilos.botonModalPresionado,
      ]}
    >
      {({ pressed }) => (
        <Text style={[estilos.textoBotonModal, (principal || pressed) && estilos.textoSobreColor]}>{texto}</Text>
      )}
    </Pressable>
  );
}

const MENSAJE_SIN_RED_INICIAR =
  'Sin conexión. Para iniciar una carga necesitas señal: el servidor la crea y te manda la lista de productos. Ya iniciada, puedes contar sin señal.';

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

  // Al volver de la pantalla de conteo (finalizada o no) se relee.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void obtenerCargaAbierta(usuario.id).then((carga) => {
        if (vigente) setCargaAbierta(carga);
      });
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

  const ocupado = iniciar.isPending || abrir.isPending || abriendoExistente;

  const cerrarSelector = () => {
    setTipoAIniciar(null);
    setConflicto(null);
    setError(null);
  };

  /** Primero la fecha: el evento se crea ya con ella. */
  const pedirFecha = async (tipo: TipoCarga) => {
    setError(null);
    // Contar sí funciona sin señal; crear la carga no: se dice antes de elegir fecha.
    if (!estaConectado(await NetInfo.fetch())) {
      setError(MENSAJE_SIN_RED_INICIAR);
      return;
    }
    setConflicto(null);
    setTipoAIniciar(tipo);
  };

  const entrarAConteo = async (carga: CargaAbierta) => {
    await guardarCargaAbierta(usuario.id, carga);
    setCargaAbierta(carga);
    setTipoAIniciar(null);
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
    return <ActivityIndicator color={COLORES.texto} />;
  }

  if (cargaAbierta) {
    return (
      <View style={estilos.grupoAcciones}>
        <BotonGrande
          titulo="Continuar carga"
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
      </View>
    );
  }

  // POST /eventos-carga es solo para Vendedor: el contador entra a una carga
  // ya iniciada, desde la cola de verificación (docs/06 §3.3), y cuenta en la
  // misma pantalla de conteo, a ciegas.
  if (usuario.rolApp === 'CONTADOR') {
    return <ColaVerificacion onAbrir={abrirVerificacion} onSesionVencida={sesionVencida} />;
  }

  if (usuario.rolApp !== 'VENDEDOR') return null;

  return (
    <View style={estilos.grupoAcciones}>
      <BotonGrande
        titulo="Iniciar carga"
        detalle="Carga inicial"
        onPress={() => void pedirFecha('INICIAL')}
        deshabilitado={ocupado}
      />
      <Pressable
        onPress={() => void pedirFecha('RECARGA')}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityState={{ disabled: ocupado, busy: ocupado }}
        style={({ pressed }) => [estilos.boton, estilos.botonSecundario, pressed && estilos.botonPresionado, ocupado && estilos.deshabilitado]}
      >
        <Text style={estilos.textoBoton}>Iniciar recarga</Text>
      </Pressable>
      {error && tipoAIniciar === null && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <SelectorFechaOperativa
        tipo={tipoAIniciar}
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
    </View>
  );
}

interface PropsBotonGrande {
  titulo: string;
  detalle: string;
  onPress: () => void;
  deshabilitado?: boolean;
}

function BotonGrande({ titulo, detalle, onPress, deshabilitado = false }: PropsBotonGrande) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalle}`}
      accessibilityState={{ disabled: deshabilitado, busy: deshabilitado }}
      style={({ pressed }) => [
        estilos.botonGrande,
        pressed && estilos.botonGrandePresionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      <Text style={estilos.tituloBotonGrande}>{titulo}</Text>
      <Text style={estilos.detalleBotonGrande}>{detalle}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  centrado: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    gap: ESPACIADO.sm,
  },
  contenido: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    gap: ESPACIADO.sm,
  },
  saludo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
  },
  nombre: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  rol: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  boton: {
    minHeight: TOQUE_MINIMO,
    minWidth: 220,
    marginTop: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPresionado: {
    backgroundColor: COLORES.superficie,
  },
  textoBoton: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  acciones: {
    width: '100%',
    maxWidth: 560,
    marginTop: ESPACIADO.xl,
    gap: ESPACIADO.lg,
  },
  grupoAcciones: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: ESPACIADO.md,
  },
  botonGrande: {
    minHeight: TOQUE_MINIMO * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.xl,
    backgroundColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonGrandePresionado: {
    backgroundColor: COLORES.textoSecundario,
  },
  tituloBotonGrande: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSobreColor,
  },
  detalleBotonGrande: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSobreColor,
  },
  botonSecundario: {
    marginTop: 0,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  error: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
    textAlign: 'center',
  },
  fondoModal: {
    flex: 1,
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
  tituloModal: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  detalleModal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
  },
  botonesModal: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
    marginTop: ESPACIADO.sm,
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
  textoSobreColor: {
    color: COLORES.textoSobreColor,
  },
});
