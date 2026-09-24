import { useEffect, useMemo, useState } from 'react';
import {
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
import {
  BloqueError,
  BloqueEsqueleto,
  Boton,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  FilaDato,
  NotaEncabezado,
  Seccion,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import {
  momentoLegible,
  motivoValido,
  rutasConPermisoPendiente,
  tiempoRestante,
  type Permiso,
  type RutaPermiso,
} from '../../src/permisos/modelo-permisos';
import { BORDES, CIFRAS, COLORES, ESPACIADO, OPACIDAD, PESOS, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

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
        <EsqueletoPermisos />
      </SafeAreaView>
    );
  }

  if (usuario?.rolApp !== 'SUPERVISOR') {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo={TITULO} />
        <EstadoVacio
          icono="candado"
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
    contenido = <EsqueletoPermisos />;
  } else if (consulta.isError && permisos.length === 0) {
    contenido = (
      <View style={estilos.contenedorAviso}>
        <BloqueError
          titulo="No se pudieron cargar los permisos"
          detalle={mensajeError(consulta.error, 'Intenta de nuevo en un momento.')}
          tono={consulta.error instanceof ErrorRed ? 'atencion' : 'error'}
          onReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      </View>
    );
  } else if (permisos.length === 0) {
    contenido = (
      <EstadoVacio
        icono="reloj"
        titulo="No hay permisos vigentes"
        detalle="Aquí aparecerán los permisos que otorgues, con el tiempo que les queda. Otórgalo solo cuando el camión tenga que salir antes de que liquiden la ruta anterior."
        accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
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
    <SafeAreaView style={estilos.pantallaLista}>
      <BarraSuperior titulo={TITULO}>
        <NotaEncabezado>
          Dejan que una ruta haga su carga inicial aunque la ruta anterior siga sin liquidar en Handy.
        </NotaEncabezado>
      </BarraSuperior>
      <View style={estilos.cabecera}>
        {confirmacion && (
          <Text style={estilos.confirmacion} accessibilityRole="alert">
            {confirmacion}
          </Text>
        )}
        <Boton texto="Otorgar permiso" onPress={abrirFormulario} />
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

/** La forma de la lista mientras llega: tarjetas del alto de un permiso. */
function EsqueletoPermisos() {
  return (
    <Esqueleto etiqueta="Cargando permisos" style={estilos.contenidoLista}>
      <TarjetaEsqueleto titulo="titulo" lineas={['50%', '70%']} />
      <TarjetaEsqueleto titulo="titulo" lineas={['50%', '70%']} />
    </Esqueleto>
  );
}

function TarjetaPermiso({ permiso, ahora }: { permiso: Permiso; ahora: Date }) {
  const vencido = permiso.expira.getTime() <= ahora.getTime();
  const estado = permiso.usado ? 'Ya se usó' : vencido ? 'Vencido' : 'Sin usar';
  const eventoId = permiso.eventoCargaId;
  const disponible = !permiso.usado && !vencido;

  return (
    <Tarjeta
      // Ámbar mientras siga disponible: es lo que un supervisor tiene que vigilar.
      conAcento={{ titulo: estado, tono: disponible ? 'discrepancia' : 'pendiente' }}
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
      <Text style={estilos.ruta}>{permiso.rutaNombre}</Text>
      {permiso.usado ? (
        <Text style={estilos.vigencia}>Se gastó en una carga inicial: ya no sirve para otra.</Text>
      ) : vencido ? (
        <Text style={estilos.vigencia}>Venció sin usarse.</Text>
      ) : (
        // La cuenta regresiva domina: es lo que el supervisor viene a ver.
        <View style={estilos.bloqueVigencia}>
          <Text style={estilos.restante}>{tiempoRestante(permiso.expira, ahora)}</Text>
          <Text style={estilos.vence}>Vence {momentoLegible(permiso.expira, ahora)}</Text>
        </View>
      )}

      <Text style={estilos.textoSecundario}>
        Lo otorgó <Text style={estilos.negrita}>{permiso.otorgadoPorNombre ?? 'un supervisor'}</Text>
        {permiso.otorgado ? ` ${momentoLegible(permiso.otorgado, ahora)}` : ''}
      </Text>
      {permiso.motivo && <Text style={estilos.motivo}>“{permiso.motivo}”</Text>}

      {eventoId && (
        <Boton
          texto="Ver la carga que lo usó"
          variante="secundario"
          onPress={() => router.push({ pathname: '/historial/[eventoId]', params: { eventoId } })}
          style={estilos.botonTarjeta}
        />
      )}
    </Tarjeta>
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
        <Encabezado titulo={paso === 'datos' ? 'Otorgar permiso' : 'Confirma el permiso'} marca />
        <ScrollView contentContainerStyle={estilos.contenidoModal} keyboardShouldPersistTaps="handled">
          {paso === 'datos' ? (
            <>
              <Seccion texto="Ruta">
                <SelectorRuta
                  cargando={rutas.isPending}
                  error={rutas.isError ? mensajeError(rutas.error, 'No se pudieron cargar las rutas.') : null}
                  rutas={rutas.data ?? []}
                  ocupadas={ocupadas}
                  elegida={rutaId}
                  onElegir={setRutaId}
                  onReintentar={() => void rutas.refetch()}
                />
              </Seccion>

              <Seccion texto="Motivo">
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
              </Seccion>

              <ReglasPermiso />

              <View style={estilos.acciones}>
                <Boton
                  texto="Revisar y confirmar"
                  deshabilitado={!listo}
                  onPress={() => {
                    setError(null);
                    setAlConfirmar(new Date());
                    setPaso('confirmar');
                  }}
                />
                <Boton texto="Cancelar" variante="secundario" onPress={onCerrar} />
              </View>
            </>
          ) : (
            ruta && (
              <>
                <Tarjeta>
                  <Text style={estilos.ruta}>{ruta.nombre}</Text>
                  {ruta.vendedorNombre && <FilaDato etiqueta="Vendedor" valor={ruta.vendedorNombre} apilado />}
                  <FilaDato etiqueta="Motivo" valor={`“${motivo.trim()}”`} apilado />
                </Tarjeta>

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

                {error && <BloqueError titulo="No se otorgó el permiso" detalle={error} />}
                <View style={estilos.acciones}>
                  <Boton
                    texto="Otorgar permiso"
                    cargando={otorgar.isPending}
                    textoCargando="Otorgando…"
                    onPress={() => void confirmar()}
                  />
                  <Boton
                    texto="Corregir"
                    variante="secundario"
                    deshabilitado={otorgar.isPending}
                    onPress={() => setPaso('datos')}
                  />
                </View>
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
    <Tarjeta elevacion={0} tintada="marca" compacta>
      <Text style={estilos.tituloReglas}>Cómo funciona</Text>
      <Text style={estilos.regla}>• Dura {VIGENCIA_PERMISO_HORAS} horas desde que lo otorgas.</Text>
      <Text style={estilos.regla}>• Sirve una sola vez: para una carga inicial de esa ruta.</Text>
      <Text style={estilos.regla}>• La carga queda marcada en el historial con tu nombre y el motivo.</Text>
    </Tarjeta>
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
      <Esqueleto etiqueta="Cargando rutas" style={estilos.rutas}>
        {[0, 1, 2].map((i) => (
          <BloqueEsqueleto key={i} alto={TOQUE_MINIMO + ESPACIADO.md} />
        ))}
      </Esqueleto>
    );
  }
  if (error) {
    return <BloqueError titulo="No se pudieron cargar las rutas" detalle={error} onReintentar={onReintentar} />;
  }
  if (rutas.length === 0) {
    return (
      <EstadoVacio
        enLinea
        icono="lista"
        titulo="No hay rutas activas"
        detalle="Un administrador debe dar de alta la ruta antes de que puedas otorgarle un permiso."
      />
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
            {({ pressed }) => {
              const invertido = seleccionada || pressed;
              return (
                <>
                  <Text style={[estilos.nombreRuta, invertido && estilos.textoInvertido]}>{r.nombre}</Text>
                  <Text style={[estilos.detalleRuta, invertido && estilos.textoInvertido]}>
                    {ocupada ? 'Ya tiene un permiso sin usar' : (r.vendedorNombre ?? 'Sin vendedor asignado')}
                  </Text>
                </>
              );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  // Lista de lectura: tarjetas blancas sobre el fondo tintado, cada permiso un bloque aparte.
  pantallaLista: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  flex: {
    flex: 1,
  },
  contenedorAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  cabecera: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingTop: RITMO.margen,
  },
  confirmacion: {
    padding: RITMO.margen,
    borderRadius: RADIOS.medio,
    backgroundColor: COLORES.capturadoFondo,
    color: COLORES.capturadoTexto,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    overflow: 'hidden',
  },
  lista: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
  },
  contenidoLista: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.lg,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  ruta: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  bloqueVigencia: {
    gap: ESPACIADO.xs,
    padding: RITMO.relacionado,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
  },
  restante: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.discrepanciaTexto,
    ...CIFRAS,
  },
  vence: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.discrepanciaTexto,
  },
  vigencia: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  motivo: {
    ...TIPOGRAFIA.cuerpo,
    fontStyle: 'italic',
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  textoSecundario: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  botonTarjeta: {
    marginTop: ESPACIADO.xs,
  },
  // Formulario: cada campo es una sección; entre campos, más aire que dentro de cada uno.
  contenidoModal: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.xl,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  acciones: {
    gap: RITMO.relacionado,
  },
  rutas: {
    gap: RITMO.interno,
  },
  opcionRuta: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: RITMO.relacionado,
    paddingVertical: RITMO.interno,
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  opcionRutaElegida: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  // Inversión completa: el toque se nota aun con poca luz.
  opcionRutaPresionada: {
    backgroundColor: COLORES.marcaOscuro,
    borderColor: COLORES.marcaOscuro,
  },
  nombreRuta: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalleRuta: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  campoMotivo: {
    minHeight: TOQUE_MINIMO * 2,
    padding: RITMO.relacionado,
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
    textAlignVertical: 'top',
  },
  ayudaCampo: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  ayudaError: {
    fontWeight: PESOS.semiNegrita,
    color: COLORES.error,
  },
  tituloReglas: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
  },
  regla: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  reglasConfirmar: {
    gap: RITMO.interno,
    padding: RITMO.margen,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.grande,
  },
  reglaDestacada: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.discrepanciaTexto,
  },
  deshabilitado: {
    opacity: OPACIDAD.deshabilitado,
  },
});
