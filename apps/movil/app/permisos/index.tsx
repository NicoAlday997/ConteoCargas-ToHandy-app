import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useOtorgarPermiso, usePermisosCarga, useRutasPermiso } from '../../src/api/hooks-permisos';
import { CODIGO_YA_EXISTE_PERMISO, LONGITUD_MINIMA_MOTIVO, VIGENCIA_PERMISO_HORAS } from '../../src/api/permisos';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, EstadoCentral, volver } from '../../src/historial/ComponentesHistorial';
import {
  momentoLegible,
  motivoValido,
  rutasConPermisoPendiente,
  tiempoRestante,
  type Permiso,
  type RutaPermiso,
} from '../../src/permisos/modelo-permisos';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/**
 * Permisos para que una ruta haga su carga inicial aunque la ruta anterior del
 * vendedor siga sin liquidar en Handy (a veces liquidan un día después, pero
 * el camión sí tiene que cargar). Solo Supervisor; el servidor lo vuelve a
 * exigir en cada llamada. Duran 24 horas y sirven una sola vez.
 */

const MS_VIGENCIA = VIGENCIA_PERMISO_HORAS * 60 * 60 * 1000;
/** La cuenta regresiva se mueve por minuto; no hace falta más seguido. */
const INTERVALO_RELOJ_MS = 30_000;

const TITULO = 'Permisos para cargar sin liquidar';

function mensajeError(error: unknown, porDefecto: string): string {
  if (error instanceof ErrorRed) return 'Sin conexión con el servidor. Revisa tu señal e intenta de nuevo.';
  if (error instanceof ErrorApi && error.estado === 403) return 'Solo un supervisor puede ver y otorgar estos permisos.';
  return error instanceof Error && error.message ? error.message : porDefecto;
}

export default function PantallaPermisos() {
  // `undefined` mientras se lee la sesión.
  const [usuario, setUsuario] = useState<UsuarioSesion | null | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente) setUsuario(sesion);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (usuario === undefined) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo={TITULO} />
        <ActivityIndicator style={estilos.cargandoSesion} size="large" color={COLORES.texto} />
      </SafeAreaView>
    );
  }

  if (usuario?.rolApp !== 'SUPERVISOR') {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo={TITULO} />
        <EstadoCentral
          titulo="Solo para supervisores"
          detalle="Estos permisos los otorga un supervisor desde su cuenta."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </SafeAreaView>
    );
  }

  return <Permisos />;
}

function Permisos() {
  const consulta = usePermisosCarga();
  const permisos = useMemo(() => consulta.data ?? [], [consulta.data]);
  const [ahora, setAhora] = useState(() => new Date());
  const [otorgando, setOtorgando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), INTERVALO_RELOJ_MS);
    return () => clearInterval(reloj);
  }, []);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [sesionVencida]);

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  const abrirFormulario = () => {
    setConfirmacion(null);
    setOtorgando(true);
  };

  let contenido;
  if (consulta.isPending) {
    contenido = (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" color={COLORES.texto} />
        <Text style={estilos.textoSecundario}>Cargando permisos…</Text>
      </View>
    );
  } else if (consulta.isError && permisos.length === 0) {
    contenido = (
      <EstadoCentral
        titulo="No se pudieron cargar los permisos"
        detalle={mensajeError(consulta.error, 'Intenta de nuevo en un momento.')}
        accion={{ texto: 'Reintentar', onPress: () => void consulta.refetch() }}
      />
    );
  } else if (permisos.length === 0) {
    contenido = (
      <EstadoCentral
        titulo="No hay permisos vigentes"
        detalle="Ninguna ruta tiene permiso para cargar sin liquidar. Otórgalo solo cuando el camión tenga que salir antes de que liquiden la ruta anterior."
        accion={{ texto: 'Actualizar', onPress: refrescar }}
      />
    );
  } else {
    contenido = (
      <FlatList
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        data={permisos}
        keyExtractor={(p) => p.id}
        extraData={ahora}
        renderItem={({ item }) => <TarjetaPermiso permiso={item} ahora={ahora} />}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo={TITULO}>
        <Text style={estilos.explicacion}>
          Dejan que una ruta haga su carga inicial aunque la ruta anterior siga sin liquidar en Handy.
        </Text>
      </BarraSuperior>
      <View style={estilos.cabecera}>
        {confirmacion && (
          <Text style={estilos.confirmacion} accessibilityRole="alert">
            {confirmacion}
          </Text>
        )}
        <Pressable
          onPress={abrirFormulario}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.botonPrincipal, pressed && estilos.botonPrincipalPresionado]}
        >
          <Text style={estilos.textoBotonPrincipal}>Otorgar permiso</Text>
        </Pressable>
      </View>
      {contenido}
      <FormularioPermiso
        visible={otorgando}
        permisos={permisos}
        onCerrar={() => setOtorgando(false)}
        onOtorgado={(texto) => {
          setOtorgando(false);
          setConfirmacion(texto);
        }}
      />
    </SafeAreaView>
  );
}

function TarjetaPermiso({ permiso, ahora }: { permiso: Permiso; ahora: Date }) {
  const vencido = permiso.expira.getTime() <= ahora.getTime();
  const estado = permiso.usado ? 'Ya se usó' : vencido ? 'Vencido' : 'Sin usar';
  const eventoId = permiso.eventoCargaId;

  return (
    <View
      style={[estilos.tarjeta, !permiso.usado && !vencido && estilos.tarjetaDisponible]}
      accessible={!eventoId}
      accessibilityLabel={[
        permiso.rutaNombre,
        estado,
        permiso.usado || vencido ? null : `${tiempoRestante(permiso.expira, ahora)}`,
        permiso.otorgadoPorNombre ? `Lo otorgó ${permiso.otorgadoPorNombre}` : null,
        permiso.motivo ? `Motivo: ${permiso.motivo}` : null,
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={estilos.filaTarjeta}>
        <Text style={estilos.ruta} numberOfLines={1}>
          {permiso.rutaNombre}
        </Text>
        <View style={[estilos.insignia, permiso.usado || vencido ? estilos.insigniaGastada : estilos.insigniaDisponible]}>
          <Text style={[estilos.textoInsignia, !(permiso.usado || vencido) && estilos.textoInvertido]}>{estado}</Text>
        </View>
      </View>

      {permiso.usado ? (
        <Text style={estilos.vigencia}>Se gastó en una carga inicial: ya no sirve para otra.</Text>
      ) : vencido ? (
        <Text style={estilos.vigencia}>Venció sin usarse.</Text>
      ) : (
        <Text style={estilos.vigencia}>
          <Text style={estilos.negrita}>{tiempoRestante(permiso.expira, ahora)}</Text>
          {` · vence ${momentoLegible(permiso.expira, ahora)}`}
        </Text>
      )}

      <Text style={estilos.textoSecundario}>
        Lo otorgó <Text style={estilos.negrita}>{permiso.otorgadoPorNombre ?? 'un supervisor'}</Text>
        {permiso.otorgado ? ` ${momentoLegible(permiso.otorgado, ahora)}` : ''}
      </Text>
      {permiso.motivo && <Text style={estilos.motivo}>“{permiso.motivo}”</Text>}

      {eventoId && (
        <Pressable
          onPress={() => router.push({ pathname: '/historial/[eventoId]', params: { eventoId } })}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.botonSecundario, pressed && estilos.botonSecundarioPresionado]}
        >
          <Text style={estilos.textoBotonSecundario}>Ver la carga que lo usó</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Otorgar
// ---------------------------------------------------------------------------

interface PropsFormulario {
  visible: boolean;
  permisos: readonly Permiso[];
  onCerrar: () => void;
  onOtorgado: (confirmacion: string) => void;
}

function FormularioPermiso(props: PropsFormulario) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      {/* Montado solo abierto: cada vez empieza limpio. */}
      {props.visible && <ContenidoFormulario {...props} />}
    </Modal>
  );
}

function ContenidoFormulario({ permisos, onCerrar, onOtorgado }: PropsFormulario) {
  const rutas = useRutasPermiso(true);
  const otorgar = useOtorgarPermiso();
  const [rutaId, setRutaId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoTocado, setMotivoTocado] = useState(false);
  const [paso, setPaso] = useState<'datos' | 'confirmar'>('datos');
  // Al pasar a confirmar: el vencimiento que se explica es el de ese momento.
  const [alConfirmar, setAlConfirmar] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const ocupadas = useMemo(() => rutasConPermisoPendiente(permisos, new Date()), [permisos]);
  const ruta = rutas.data?.find((r) => r.id === rutaId) ?? null;
  const motivoOk = motivoValido(motivo, LONGITUD_MINIMA_MOTIVO);
  const listo = ruta !== null && !ocupadas.has(ruta.id) && motivoOk;

  const confirmar = async () => {
    if (!ruta) return;
    setError(null);
    try {
      const respuesta = await otorgar.mutateAsync({ rutaId: ruta.id, motivo: motivo.trim() });
      const expira = respuesta?.permiso?.fechaExpiracion ? new Date(respuesta.permiso.fechaExpiracion) : null;
      onOtorgado(
        expira && !Number.isNaN(expira.getTime())
          ? `Permiso otorgado a ${ruta.nombre}. Vence ${momentoLegible(expira, new Date())}.`
          : `Permiso otorgado a ${ruta.nombre}.`,
      );
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) {
        void cerrarSesion().then(() => router.replace('/login'));
        return;
      }
      if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_YA_EXISTE_PERMISO) {
        setError(`${ruta.nombre} ya tiene un permiso sin usar. Se puede otorgar otro cuando ese se use o venza.`);
        return;
      }
      setError(mensajeError(e, 'No se pudo otorgar el permiso.'));
    }
  };

  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView style={estilos.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={estilos.barraModal}>
          <Text style={estilos.tituloModal} accessibilityRole="header">
            {paso === 'datos' ? 'Otorgar permiso' : 'Confirma el permiso'}
          </Text>
        </View>
        <ScrollView contentContainerStyle={estilos.contenidoModal} keyboardShouldPersistTaps="handled">
          {paso === 'datos' ? (
            <>
              <Text style={estilos.etiquetaCampo}>Ruta</Text>
              <SelectorRuta
                cargando={rutas.isPending}
                error={rutas.isError ? mensajeError(rutas.error, 'No se pudieron cargar las rutas.') : null}
                rutas={rutas.data ?? []}
                ocupadas={ocupadas}
                elegida={rutaId}
                onElegir={setRutaId}
                onReintentar={() => void rutas.refetch()}
              />

              <Text style={estilos.etiquetaCampo}>Motivo</Text>
              <TextInput
                value={motivo}
                onChangeText={setMotivo}
                onBlur={() => setMotivoTocado(true)}
                placeholder="Ej. Liquida mañana junto con hoy; el camión tiene que salir."
                placeholderTextColor={COLORES.textoSecundario}
                multiline
                maxLength={500}
                accessibilityLabel="Motivo del permiso"
                accessibilityHint={`Obligatorio, al menos ${LONGITUD_MINIMA_MOTIVO} caracteres`}
                style={estilos.campoMotivo}
              />
              <Text style={[estilos.ayudaCampo, motivoTocado && !motivoOk && estilos.ayudaError]}>
                Obligatorio, al menos {LONGITUD_MINIMA_MOTIVO} caracteres. Queda registrado junto con tu nombre.
              </Text>

              <ReglasPermiso />

              <BotonModal
                texto="Revisar y confirmar"
                principal
                deshabilitado={!listo}
                onPress={() => {
                  setError(null);
                  setAlConfirmar(new Date());
                  setPaso('confirmar');
                }}
              />
              <BotonModal texto="Cancelar" onPress={onCerrar} />
            </>
          ) : (
            ruta && (
              <>
                <View style={estilos.resumen}>
                  <FilaResumen etiqueta="Ruta" valor={ruta.nombre} />
                  {ruta.vendedorNombre && <FilaResumen etiqueta="Vendedor" valor={ruta.vendedorNombre} />}
                  <FilaResumen etiqueta="Motivo" valor={`“${motivo.trim()}”`} />
                </View>

                <View style={estilos.reglasConfirmar}>
                  <Text style={estilos.reglaDestacada}>
                    Dura {VIGENCIA_PERMISO_HORAS} horas: vence{' '}
                    {momentoLegible(new Date(alConfirmar.getTime() + MS_VIGENCIA), alConfirmar)}.
                  </Text>
                  <Text style={estilos.reglaDestacada}>
                    Sirve una sola vez: se gasta en la próxima carga inicial de {ruta.nombre}.
                  </Text>
                  <Text style={estilos.textoSecundario}>Si nadie lo usa en ese plazo, vence solo.</Text>
                </View>

                {error && (
                  <Text style={estilos.error} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
                <BotonModal
                  texto={otorgar.isPending ? 'Otorgando…' : 'Otorgar permiso'}
                  principal
                  deshabilitado={otorgar.isPending}
                  onPress={() => void confirmar()}
                />
                <BotonModal texto="Corregir" deshabilitado={otorgar.isPending} onPress={() => setPaso('datos')} />
              </>
            )
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReglasPermiso() {
  return (
    <View style={estilos.reglas}>
      <Text style={estilos.tituloReglas}>Cómo funciona</Text>
      <Text style={estilos.regla}>• Dura {VIGENCIA_PERMISO_HORAS} horas desde que lo otorgas.</Text>
      <Text style={estilos.regla}>• Sirve una sola vez: para una carga inicial de esa ruta.</Text>
      <Text style={estilos.regla}>• La carga queda marcada en el historial con tu nombre y el motivo.</Text>
    </View>
  );
}

interface PropsSelectorRuta {
  cargando: boolean;
  error: string | null;
  rutas: readonly RutaPermiso[];
  /** Con un permiso sin usar: el servidor no acepta otro. */
  ocupadas: ReadonlySet<string>;
  elegida: string | null;
  onElegir: (rutaId: string) => void;
  onReintentar: () => void;
}

function SelectorRuta({ cargando, error, rutas, ocupadas, elegida, onElegir, onReintentar }: PropsSelectorRuta) {
  if (cargando) {
    return (
      <View style={estilos.estadoRutas}>
        <ActivityIndicator color={COLORES.texto} />
        <Text style={estilos.textoSecundario}>Cargando rutas…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={estilos.estadoRutas}>
        <Text style={estilos.error}>{error}</Text>
        <BotonModal texto="Reintentar" onPress={onReintentar} />
      </View>
    );
  }
  if (rutas.length === 0) {
    return (
      <View style={estilos.estadoRutas}>
        <Text style={estilos.textoSecundario}>No hay rutas activas.</Text>
      </View>
    );
  }
  return (
    <View style={estilos.rutas} accessibilityRole="radiogroup">
      {rutas.map((r) => {
        const ocupada = ocupadas.has(r.id);
        const seleccionada = elegida === r.id;
        return (
          <Pressable
            key={r.id}
            onPress={() => onElegir(r.id)}
            disabled={ocupada}
            accessibilityRole="radio"
            accessibilityState={{ checked: seleccionada, disabled: ocupada }}
            accessibilityLabel={[r.nombre, r.vendedorNombre, ocupada ? 'Ya tiene un permiso sin usar' : null]
              .filter(Boolean)
              .join('. ')}
            style={({ pressed }) => [
              estilos.opcionRuta,
              seleccionada && estilos.opcionRutaElegida,
              pressed && !seleccionada && estilos.opcionRutaPresionada,
              ocupada && estilos.deshabilitado,
            ]}
          >
            <Text style={[estilos.nombreRuta, seleccionada && estilos.textoInvertido]}>{r.nombre}</Text>
            <Text style={[estilos.detalleRuta, seleccionada && estilos.textoInvertido]}>
              {ocupada ? 'Ya tiene un permiso sin usar' : (r.vendedorNombre ?? 'Sin vendedor asignado')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.filaResumen}>
      <Text style={estilos.etiquetaResumen}>{etiqueta}</Text>
      <Text style={estilos.valorResumen}>{valor}</Text>
    </View>
  );
}

function BotonModal({
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

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  flex: {
    flex: 1,
  },
  cargandoSesion: {
    marginTop: ESPACIADO.xxxl,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.md,
  },
  explicacion: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
    paddingLeft: TOQUE_MINIMO,
  },
  cabecera: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingTop: ESPACIADO.md,
  },
  confirmacion: {
    padding: ESPACIADO.md,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.capturado,
    color: COLORES.textoSobreColor,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
  },
  botonPrincipal: {
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.texto,
  },
  botonPrincipalPresionado: {
    backgroundColor: COLORES.textoSecundario,
  },
  textoBotonPrincipal: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSobreColor,
  },
  lista: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
  },
  contenidoLista: {
    padding: ESPACIADO.md,
    gap: ESPACIADO.md,
    paddingBottom: ESPACIADO.xxxl,
  },
  tarjeta: {
    gap: ESPACIADO.xs,
    padding: ESPACIADO.md,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderLeftWidth: 6,
    borderLeftColor: COLORES.borde,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.fondo,
  },
  tarjetaDisponible: {
    borderLeftColor: COLORES.discrepancia,
  },
  filaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
  },
  ruta: {
    flexShrink: 1,
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  insignia: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: 2,
    borderRadius: RADIOS.sm,
  },
  insigniaDisponible: {
    backgroundColor: COLORES.texto,
  },
  insigniaGastada: {
    backgroundColor: COLORES.superficie,
  },
  textoInsignia: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  vigencia: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  motivo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontStyle: 'italic',
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  textoSecundario: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  botonSecundario: {
    minHeight: TOQUE_MINIMO,
    marginTop: ESPACIADO.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonSecundarioPresionado: {
    backgroundColor: COLORES.superficie,
  },
  textoBotonSecundario: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  // Formulario
  barraModal: {
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORES.texto,
  },
  tituloModal: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  contenidoModal: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    paddingBottom: ESPACIADO.xxxl,
  },
  etiquetaCampo: {
    marginTop: ESPACIADO.sm,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  estadoRutas: {
    alignItems: 'center',
    gap: ESPACIADO.sm,
    paddingVertical: ESPACIADO.md,
  },
  rutas: {
    gap: ESPACIADO.sm,
  },
  opcionRuta: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  opcionRutaElegida: {
    backgroundColor: COLORES.texto,
  },
  opcionRutaPresionada: {
    backgroundColor: COLORES.superficie,
  },
  nombreRuta: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  detalleRuta: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  campoMotivo: {
    minHeight: TOQUE_MINIMO * 2,
    padding: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
    textAlignVertical: 'top',
  },
  ayudaCampo: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  ayudaError: {
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
  },
  reglas: {
    gap: ESPACIADO.xs,
    marginTop: ESPACIADO.sm,
    padding: ESPACIADO.md,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.superficie,
  },
  tituloReglas: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  regla: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  resumen: {
    gap: ESPACIADO.sm,
  },
  filaResumen: {
    gap: 2,
  },
  etiquetaResumen: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  valorResumen: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    color: COLORES.texto,
  },
  reglasConfirmar: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
    borderRadius: RADIOS.md,
  },
  reglaDestacada: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  error: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
  },
  botonModal: {
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
  deshabilitado: {
    opacity: 0.5,
  },
});
