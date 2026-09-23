import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect } from 'expo-router';

import { ETIQUETAS_ROL } from '../src/api/auth';
import { ETIQUETAS_TIPO_CARGA, type TipoCarga } from '../src/api/cargas';
import { ErrorApi, ErrorRed } from '../src/api/cliente';
import { useAbrirSesion, useIniciarCarga } from '../src/api/hooks-cargas';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../src/api/sesion';
import { obtenerToken } from '../src/api/token';
import { guardarCargaAbierta, obtenerCargaAbierta, type CargaAbierta } from '../src/conteo/almacen-conteo';
import { esBorrado, obtenerConteoLocal } from '../src/conteo/almacen-local';
import { detenerColas, estaConectado } from '../src/conteo/cola-sincronizacion';
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

  // Pantalla temporal hasta que existan los inicios por rol (docs/06 §3.2-3.3).
  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.centrado}>
        <Text style={estilos.saludo}>Sesión iniciada</Text>
        <Text style={estilos.nombre}>{usuario?.nombreCompleto ?? 'Usuario'}</Text>
        {usuario?.rolApp && <Text style={estilos.rol}>{ETIQUETAS_ROL[usuario.rolApp]}</Text>}
        {cuenta && usuario && <AccionesCarga usuario={usuario} />}
        <BotonCerrarSesion usuarioId={usuario?.id ?? null} />
      </View>
    </SafeAreaView>
  );
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
    params: { eventoId: carga.eventoId, sesionId: carga.sesionId, tipo: carga.tipo ?? '' },
  });
}

/**
 * Si hay una carga a medias en este dispositivo, la única acción es
 * continuarla: abrir otra dejaría la primera sin finalizar.
 */
function AccionesCarga({ usuario }: { usuario: UsuarioSesion }) {
  const iniciar = useIniciarCarga();
  const abrir = useAbrirSesion();
  // `undefined` mientras se consulta: no mostrar "Iniciar" a quien debe "Continuar".
  const [cargaAbierta, setCargaAbierta] = useState<CargaAbierta | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Al volver de la pantalla de conteo (finalizada o no) se relee.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void obtenerCargaAbierta(usuario.id).then((carga) => {
        if (vigente) setCargaAbierta(carga);
      });
      return () => {
        vigente = false;
      };
    }, [usuario.id]),
  );

  const ocupado = iniciar.isPending || abrir.isPending;

  const iniciarCarga = async (tipo: TipoCarga) => {
    setError(null);
    // Contar sí funciona sin señal; crear la carga no: se dice en vez de fallar callado.
    if (!estaConectado(await NetInfo.fetch())) {
      setError(MENSAJE_SIN_RED_INICIAR);
      return;
    }
    try {
      const respuesta = await iniciar.mutateAsync(tipo);
      const eventoId = respuesta?.evento?.id;
      if (!eventoId) throw new Error('El servidor no devolvió la carga creada.');
      // El backend ya abre la sesión del vendedor al crear el evento; solo si
      // no viniera se abre aparte (abrirla dos veces responde 409).
      const sesionId = respuesta?.sesion?.id ?? (await abrir.mutateAsync(eventoId))?.id;
      if (!sesionId) throw new Error('El servidor no devolvió la sesión de conteo.');

      const carga: CargaAbierta = { eventoId, sesionId, tipo: respuesta?.evento?.tipo ?? tipo };
      await guardarCargaAbierta(usuario.id, carga);
      setCargaAbierta(carga);
      irAConteo(carga);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        void cerrarSesion().then(() => router.replace('/login'));
        return;
      }
      if (e instanceof ErrorRed) {
        setError(MENSAJE_SIN_RED_INICIAR);
        return;
      }
      setError(e instanceof Error && e.message ? e.message : 'No se pudo iniciar la carga.');
    }
  };

  if (cargaAbierta === undefined) {
    return <ActivityIndicator style={estilos.acciones} color={COLORES.texto} />;
  }

  if (cargaAbierta) {
    return (
      <View style={estilos.acciones}>
        <BotonGrande
          titulo="Continuar carga"
          detalle={cargaAbierta.tipo ? ETIQUETAS_TIPO_CARGA[cargaAbierta.tipo] : 'Conteo sin finalizar'}
          onPress={() => irAConteo(cargaAbierta)}
        />
      </View>
    );
  }

  // POST /eventos-carga es solo para Vendedor: el contador entra a una carga
  // ya iniciada, desde la cola de verificación (docs/06 §3.3), aún sin construir.
  if (usuario.rolApp !== 'VENDEDOR') {
    return (
      <View style={estilos.acciones}>
        <Text style={estilos.avisoAcciones}>
          No tienes cargas por verificar en este dispositivo. La cola de verificación todavía no está disponible.
        </Text>
      </View>
    );
  }

  return (
    <View style={estilos.acciones}>
      <BotonGrande
        titulo={iniciar.isPending && iniciar.variables === 'INICIAL' ? 'Iniciando…' : 'Iniciar carga'}
        detalle="Carga inicial de hoy"
        onPress={() => void iniciarCarga('INICIAL')}
        deshabilitado={ocupado}
      />
      <Pressable
        onPress={() => void iniciarCarga('RECARGA')}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityState={{ disabled: ocupado, busy: ocupado }}
        style={({ pressed }) => [estilos.boton, estilos.botonSecundario, pressed && estilos.botonPresionado, ocupado && estilos.deshabilitado]}
      >
        <Text style={estilos.textoBoton}>
          {iniciar.isPending && iniciar.variables === 'RECARGA' ? 'Iniciando…' : 'Iniciar recarga'}
        </Text>
      </Pressable>
      {error && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
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
    maxWidth: 420,
    marginTop: ESPACIADO.xl,
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
  avisoAcciones: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
    textAlign: 'center',
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
