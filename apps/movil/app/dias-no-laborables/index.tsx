import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DiaNoLaborable } from '../../src/api/calendario';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import {
  useDiasNoLaborables,
  useMarcarDiaNoLaborable,
  useQuitarDiaNoLaborable,
} from '../../src/api/hooks-calendario';
import {
  AccionesHoja,
  BarraAccion,
  BloqueError,
  Boton,
  CampoTexto,
  Esqueleto,
  EstadoVacio,
  NotaEncabezado,
  TarjetaEsqueleto,
  Pulsable,
  Hoja,
  Chevron,
} from '../../src/componentes/base';
import { HojaRecorrer } from '../../src/calendario/HojaRecorrer';
import {
  DIAS_CABECERA,
  mesDe,
  moverMes,
  semanasDelMes,
  tituloMes,
  type Mes,
} from '../../src/calendario/modelo-calendario';
import { diaNegocio, formatearDia } from '../../src/conteo/fecha-operativa';
import {
  ANCHO_MAXIMO_LISTA,
  BarraSuperior,
  volver,
} from '../../src/historial/ComponentesHistorial';
import {
  avisoDeError,
  sesionVencida,
  type AvisoError,
} from '../../src/plantillas/ComponentesPlantillas';
import { ModalConfirmacion } from '../../src/supervisor/ModalConfirmacion';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import {
  BORDES,
  CIFRAS,
  COLORES,
  ELEVACION,
  ESCALA_PRESIONADO,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  RITMO,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';

/**
 * Días no laborables (solo Supervisor): festivos, paros, clima o cierres
 * completos (Navidad). Esos días ninguna carga puede salir, y al vendedor la
 * app ya no se los ofrece. Los domingos no se marcan aquí: el calendario ya
 * los trae fuera.
 */

const TITULO = 'Días no laborables';
const AYUDA =
  'Los domingos ya están considerados. Aquí marca festivos, paros o cierres.';
const MOTIVO_MINIMO = 3;

export default function PantallaDiasNoLaborables() {
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla>
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="Los días no laborables los marca un supervisor."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Lista />;
}

function Pantalla({ children }: { children: ReactNode }) {
  // Sin margen inferior: lo absorbe la barra de acción, que llega al borde.
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
      <BarraSuperior titulo={TITULO} marca={false}>
        <NotaEncabezado>{AYUDA}</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando días no laborables" style={estilos.contenido}>
      <TarjetaEsqueleto lineas={['60%', '45%', '70%']} />
    </Esqueleto>
  );
}

function Lista() {
  const consulta = useDiasNoLaborables(true);
  const quitar = useQuitarDiaNoLaborable();
  const [marcando, setMarcando] = useState(false);
  const [aQuitar, setAQuitar] = useState<DiaNoLaborable | null>(null);
  const [errorQuitar, setErrorQuitar] = useState<AvisoError | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  /** El día cuyas cargas se ofrece recorrer; `manual` si lo pidió el supervisor desde la lista. */
  const [recorrido, setRecorrido] = useState<{
    fecha: string;
    motivo: string;
    manual: boolean;
  } | null>(null);
  const [avisoRecorrido, setAvisoRecorrido] = useState<string | null>(null);
  const cerrarRecorrido = useCallback(() => setRecorrido(null), []);

  const vencida =
    consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const confirmarQuitar = () => {
    if (!aQuitar) return;
    setErrorQuitar(null);
    quitar.mutate(aQuitar.fecha, {
      onSuccess: () => setAQuitar(null),
      onError: (e) =>
        setErrorQuitar(avisoCalendario(e, 'No se pudo quitar el día')),
    });
  };

  if (consulta.isPending) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <Pantalla>
        <View style={estilos.contenido}>
          <BloqueError
            titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar los días'}
            detalle={
              sinRed
                ? 'Para ver los días no laborables necesitas señal: revísala.'
                : (consulta.error instanceof Error && consulta.error.message) ||
                  null
            }
            tono={sinRed ? 'atencion' : 'error'}
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
            secundaria={{ texto: 'Volver', onPress: volver }}
          />
        </View>
      </Pantalla>
    );
  }

  const dias = consulta.data ?? [];

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              void consulta.refetch().finally(() => setRefrescando(false));
            }}
          />
        }
      >
        {avisoRecorrido && (
          <BloqueError
            tono="exito"
            titulo={avisoRecorrido}
            secundaria={{
              texto: 'Entendido',
              onPress: () => setAvisoRecorrido(null),
            }}
          />
        )}
        {dias.length === 0 ? (
          <EstadoVacio
            icono="calendario"
            titulo="No hay días marcados"
            detalle="De hoy en adelante se trabaja de lunes a sábado. Marca aquí un festivo, un paro o un cierre."
            enLinea
          />
        ) : (
          <View style={estilos.tarjeta}>
            {dias.map((dia, i) => (
              <RenglonDia
                key={dia.fecha}
                dia={dia}
                primero={i === 0}
                onQuitar={() => setAQuitar(dia)}
                onRecorrer={() =>
                  setRecorrido({
                    fecha: dia.fecha,
                    motivo: dia.motivo,
                    manual: true,
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
      {/* Abajo, al alcance del pulgar: la acción de la pantalla. */}
      <BarraAccion>
        <Boton
          texto="Marcar un día"
          onPress={() => setMarcando(true)}
          style={estilos.botonBarra}
        />
      </BarraAccion>
      <ModalMarcar
        visible={marcando}
        marcados={dias.map((d) => d.fecha)}
        onCerrar={() => setMarcando(false)}
        onMarcado={(fecha, motivo) => {
          // Si ese día ya tiene cargas, se ofrece recorrerlas enseguida.
          setAvisoRecorrido(null);
          setRecorrido({ fecha, motivo, manual: false });
        }}
      />
      <HojaRecorrer
        key={recorrido ? `${recorrido.fecha}-${recorrido.manual}` : 'cerrada'}
        fecha={recorrido?.fecha ?? null}
        motivoInicial={recorrido?.motivo ?? ''}
        manual={recorrido?.manual ?? false}
        onCerrar={cerrarRecorrido}
        onRecorridas={(aviso) => {
          setRecorrido(null);
          setAvisoRecorrido(aviso);
        }}
      />
      <ModalConfirmacion
        visible={aQuitar !== null}
        titulo="¿Quitar este día?"
        textoConfirmar="Sí, quitarlo"
        textoCargando="Quitando…"
        textoCerrar="No, dejarlo"
        variante="peligro"
        cargando={quitar.isPending}
        error={errorQuitar}
        onConfirmar={confirmarQuitar}
        onCerrar={() => {
          setAQuitar(null);
          setErrorQuitar(null);
        }}
      >
        {aQuitar && (
          <Text style={estilos.cuerpo}>
            El {formatearDia(aQuitar.fecha).toLowerCase()} vuelve a ser día de
            trabajo y los vendedores podrán cargar para ese día.
          </Text>
        )}
      </ModalConfirmacion>
    </Pantalla>
  );
}

function RenglonDia({
  dia,
  primero,
  onQuitar,
  onRecorrer,
}: {
  dia: DiaNoLaborable;
  primero: boolean;
  onQuitar: () => void;
  onRecorrer: () => void;
}) {
  const legible = formatearDia(dia.fecha);
  return (
    <View style={[estilos.renglon, !primero && estilos.renglonConDivisor]}>
      <View style={estilos.textosRenglon}>
        <Text style={estilos.nombre}>{legible}</Text>
        <Text style={estilos.detalle}>{dia.motivo}</Text>
        {dia.creadoPorNombre && (
          <Text style={estilos.quien}>Marcado por {dia.creadoPorNombre}</Text>
        )}
      </View>
      <Pulsable
        onPress={onRecorrer}
        accessibilityRole="button"
        accessibilityLabel={`Ver y recorrer las cargas del ${legible}`}
        style={({ pressed }) => [
          estilos.quitar,
          pressed && estilos.recorrerPresionado,
        ]}
      >
        <Text style={estilos.textoRecorrer}>Cargas</Text>
      </Pulsable>
      <Pulsable
        onPress={onQuitar}
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${legible}`}
        style={({ pressed }) => [
          estilos.quitar,
          pressed && estilos.quitarPresionado,
        ]}
      >
        <Text style={estilos.textoQuitar}>Quitar</Text>
      </Pulsable>
    </View>
  );
}

/**
 * Elegir el día en una cuadrícula del mes y escribir el motivo. Los días
 * pasados, los domingos y los ya marcados no se pueden tocar (el servidor los
 * rechazaría igual).
 */
function ModalMarcar({
  visible,
  marcados,
  onCerrar,
  onMarcado,
}: {
  visible: boolean;
  marcados: readonly string[];
  onCerrar: () => void;
  /** Ya quedó marcado: se revisa si ese día tenía cargas. */
  onMarcado: (fecha: string, motivo: string) => void;
}) {
  const marcar = useMarcarDiaNoLaborable();
  const hoy = diaNegocio(new Date());
  const [mes, setMes] = useState<Mes>(() => mesDe(hoy));
  const [dia, setDia] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<AvisoError | null>(null);

  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;
  const esMesActual =
    mes.anio === mesDe(hoy).anio && mes.mes === mesDe(hoy).mes;

  const cerrar = () => {
    if (marcar.isPending) return;
    setMes(mesDe(hoy));
    setDia(null);
    setMotivo('');
    setIntento(false);
    setError(null);
    onCerrar();
  };

  const guardar = () => {
    setIntento(true);
    if (dia === null || !motivoValido) return;
    setError(null);
    const marcado = { fecha: dia, motivo: motivo.trim() };
    marcar.mutate(marcado, {
      onSuccess: () => {
        cerrar();
        onMarcado(marcado.fecha, marcado.motivo);
      },
      onError: (e) => setError(avisoCalendario(e, 'No se pudo marcar el día')),
    });
  };

  return (
    <Hoja
      visible={visible}
      onCerrar={cerrar}
      bloqueada={marcar.isPending}
      titulo="Marcar un día no laborable"
      formulario
      pie={
        <AccionesHoja>
          <Boton
            texto="Cancelar"
            variante="secundario"
            deshabilitado={marcar.isPending}
            onPress={cerrar}
          />
          <Boton
            texto="Marcar día"
            cargando={marcar.isPending}
            textoCargando="Marcando…"
            onPress={guardar}
          />
        </AccionesHoja>
      }
    >
      <View style={estilos.cabeceraMes}>
        <BotonMes
          direccion="izquierda"
          etiqueta="Mes anterior"
          deshabilitado={esMesActual}
          onPress={() => setMes(moverMes(mes, -1))}
        />
        <Text style={estilos.tituloMes}>{tituloMes(mes)}</Text>
        <BotonMes
          direccion="derecha"
          etiqueta="Mes siguiente"
          onPress={() => setMes(moverMes(mes, 1))}
        />
      </View>
      <View style={estilos.semana}>
        {DIAS_CABECERA.map((d, i) => (
          <Text key={i} style={estilos.cabeceraDia}>
            {d}
          </Text>
        ))}
      </View>
      {/* Las semanas juntas: el hueco entre renglones de la hoja las separaría de más. */}
      <View style={estilos.mes}>
        {semanasDelMes(mes).map((semana, i) => (
          <View key={i} style={estilos.semana}>
            {semana.map((celda, j) => {
              if (!celda) return <View key={j} style={estilos.celda} />;
              const inhabil =
                celda.dia < hoy ||
                celda.esDomingo ||
                marcados.includes(celda.dia);
              const elegido = celda.dia === dia;
              const esHoy = celda.dia === hoy;
              return (
                <Pulsable
                  key={j}
                  onPress={() => setDia(celda.dia)}
                  disabled={inhabil}
                  tacto="seleccion"
                  accessibilityRole="button"
                  accessibilityLabel={`${formatearDia(celda.dia)}${esHoy ? ', hoy' : ''}`}
                  accessibilityState={{ disabled: inhabil, selected: elegido }}
                  // Lo que se puede tocar tiene forma de tecla; lo inhábil es solo el número apagado.
                  style={({ pressed }) => [
                    estilos.celda,
                    !inhabil && estilos.celdaTocable,
                    esHoy && estilos.celdaHoy,
                    pressed && estilos.celdaPresionada,
                    elegido && estilos.celdaElegida,
                    inhabil && estilos.celdaInhabil,
                  ]}
                >
                  <Text
                    style={[
                      estilos.numeroDia,
                      elegido && estilos.numeroElegido,
                    ]}
                  >
                    {celda.numero}
                  </Text>
                </Pulsable>
              );
            })}
          </View>
        ))}
      </View>
      <Text
        style={[estilos.cuerpo, intento && dia === null && estilos.textoError]}
      >
        {dia ? formatearDia(dia) : 'Toca el día que no se trabaja.'}
      </Text>
      <CampoTexto
        etiqueta="Motivo"
        valor={motivo}
        onCambiar={setMotivo}
        ejemplo="Ej. Día de la Revolución"
        maxLength={200}
        ayuda={`Obligatorio. Mínimo ${MOTIVO_MINIMO} caracteres.`}
        error={
          intento && !motivoValido
            ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).`
            : null
        }
      />
      {error && (
        <BloqueError
          titulo={error.titulo}
          detalle={error.detalle}
          tono={error.tono}
        />
      )}
    </Hoja>
  );
}

function BotonMes({
  direccion,
  etiqueta,
  deshabilitado = false,
  onPress,
}: {
  direccion: 'izquierda' | 'derecha';
  etiqueta: string;
  deshabilitado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.botonMes,
        pressed && estilos.quitarPresionado,
        deshabilitado && estilos.celdaInhabil,
      ]}
    >
      <Chevron
        direccion={direccion}
        color={COLORES.texto}
        tamano={ESPACIADO.xxl}
      />
    </Pulsable>
  );
}

/** Mismo criterio que las plantillas, con el texto de sin red de esta pantalla. */
function avisoCalendario(e: unknown, titulo: string): AvisoError | null {
  if (e instanceof ErrorRed) {
    return {
      titulo: 'Sin conexión',
      detalle:
        'Para guardar los días no laborables necesitas señal: revísala y vuelve a intentarlo.',
      tono: 'atencion',
    };
  }
  return avisoDeError(e, titulo);
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  botonBarra: {
    flex: 1,
  },
  contenido: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  tarjeta: {
    ...ELEVACION[1],
    borderRadius: RADIOS.grande,
  },
  renglon: {
    minHeight: TOQUE_MINIMO + ESPACIADO.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.md,
  },
  renglonConDivisor: {
    borderTopWidth: BORDES.fino,
    borderTopColor: COLORES.divisor,
  },
  textosRenglon: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  nombre: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  quien: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoTerciario,
  },
  quitar: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.completo,
  },
  quitarPresionado: {
    backgroundColor: COLORES.errorFondo,
  },
  recorrerPresionado: {
    backgroundColor: COLORES.marcaTinte,
  },
  textoRecorrer: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.accionHonda,
  },
  textoQuitar: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.error,
  },
  cuerpo: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  textoError: {
    color: COLORES.error,
  },
  cabeceraMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloMes: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  botonMes: {
    width: TOQUE_MINIMO,
    height: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.azulSuave,
  },
  textoBotonMes: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.accionHonda,
  },
  mes: {
    gap: ESPACIADO.xs,
  },
  semana: {
    flexDirection: 'row',
    gap: ESPACIADO.xs,
  },
  cabeceraDia: {
    flex: 1,
    textAlign: 'center',
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSecundario,
  },
  // Círculos, todos con el mismo contorno (transparente): el de hoy no crece al pintarlo.
  celda: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    borderWidth: BORDES.medio,
    borderColor: 'transparent',
  },
  celdaTocable: {
    backgroundColor: COLORES.fondo,
  },
  // Hoy se reconoce por el aro, no por un color: no es un estado.
  celdaHoy: {
    borderColor: COLORES.accion,
  },
  celdaPresionada: {
    backgroundColor: COLORES.marcaTinte,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  // Elegido: círculo azul sólido con sombra azul, lo único encendido del mes.
  celdaElegida: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
    boxShadow: SOMBRAS.accion,
  },
  celdaInhabil: {
    opacity: OPACIDAD.bloqueado,
  },
  numeroDia: {
    ...TIPOGRAFIA.subtitulo,
    ...CIFRAS,
    color: COLORES.texto,
  },
  numeroElegido: {
    color: COLORES.textoSobreColor,
  },
});
