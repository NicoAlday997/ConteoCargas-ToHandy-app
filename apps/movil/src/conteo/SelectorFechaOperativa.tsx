import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS_TIPO_CARGA, type TipoCarga } from '../api/cargas';
import { ErrorRed } from '../api/cliente';
import { useFechasOperativasDisponibles } from '../api/hooks-cargas';
import { BloqueError, BloqueEsqueleto, Boton, CampoTexto, Esqueleto, Hoja, Pulsable } from '../componentes/base';
import { BORDES, COLORES, ESCALA_PRESIONADO, ESPACIADO, ONDA, OPACIDAD, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  deLaSalida,
  diaNegocio,
  diaRelativo,
  formatearDia,
  textoConfirmarCambioFecha,
  textoSalida,
  type FechaDisponible,
} from './fecha-operativa';

/** Mover de día una carga ya iniciada, en vez de elegir el día de una nueva. */
export interface CambioFechaSelector {
  /** `aaaa-mm-dd`: el día que tiene hoy la carga. Si está entre las opciones, se marca. */
  diaActual: string;
  /** Lo que ya se contó: la confirmación dice que se conserva. */
  productosContados: number;
  /** Supervisor: el motivo es obligatorio (mínimo `motivoMinimo` caracteres). */
  motivoMinimo: number | null;
}

/** Ya hay carga inicial de la ruta para ese día: se ofrece continuarla. */
export interface ConflictoFecha {
  eventoId: string;
  dia: string;
}

interface Props {
  /** `null` = cerrado. */
  tipo: TipoCarga | null;
  conflicto: ConflictoFecha | null;
  /**
   * Los únicos días que se pueden elegir (`aaaa-mm-dd`, en orden). Solo la
   * recarga los trae: el de su ruta abierta en Handy (`GET dias-recargables`).
   * Con uno solo no se pregunta el día, se confirma. Sin esto, los días salen
   * del calendario laboral del servidor (`GET fechas-operativas-disponibles`).
   */
  dias?: readonly string[] | null;
  /**
   * Handy no respondió al buscar la ruta abierta: se puede contar, pero se
   * advierte antes de confirmar (atención, no bloqueo).
   */
  sinVerificarConHandy?: boolean;
  /**
   * Mover una carga ya iniciada: ofrece los días que da el servidor, con el
   * actual marcado si está entre ellos, y al elegir otro pregunta antes (lo
   * contado se conserva) y solo entonces llama a `onElegir`, con el motivo si
   * se pidió.
   */
  cambio?: CambioFechaSelector | null;
  /** Creando la carga o abriendo la existente: botones bloqueados. */
  ocupado: boolean;
  error: string | null;
  onElegir: (dia: string, motivo?: string) => void;
  onContinuarExistente: (conflicto: ConflictoFecha) => void;
  onElegirOtra: () => void;
  onCerrar: () => void;
}

const AVISO_CAMBIO_DE_DIA = 'Cambió el día mientras elegías. Revisa las fechas y elige de nuevo.';
const AVISO_SIN_VERIFICAR_CON_HANDY =
  'No pude confirmar con Handy que tu ruta siga abierta. Puedes contar, pero si la ruta ya se cerró la recarga no se va a poder enviar.';

/**
 * Para qué día sale el camión. La app NO genera fechas: las pide al servidor,
 * que conoce el calendario laboral (lunes a sábado, menos festivos y cierres),
 * y muestra solo esas con la etiqueta que vino. Al vendedor le llegan una o
 * dos: hoy (si se trabaja; el camión se descompuso) y la siguiente salida, que
 * es la sugerida. Mientras llegan, esqueleto; sin red, error con reintentar,
 * nunca fechas adivinadas.
 *
 * La recarga no elige libremente: se suma a una salida que ya está en Handy,
 * así que solo ofrece esos días (`dias`), sin propuesta.
 */
export function SelectorFechaOperativa(props: Props) {
  const { ocupado, onCerrar } = props;
  return (
    <Hoja visible={props.tipo !== null} onCerrar={onCerrar} bloqueada={ocupado}>
      {/* Montado solo abierto: cada vez que se abre se vuelven a pedir las fechas. */}
      {props.tipo !== null &&
        (props.cambio ? (
          <ContenidoCambio {...props} cambio={props.cambio} />
        ) : (
          <Contenido {...props} tipo={props.tipo} />
        ))}
    </Hoja>
  );
}

/**
 * Las fechas del servidor. Cuando el servidor rechaza una (pasó la medianoche
 * con el selector abierto, o un supervisor marcó el día como no laborable) se
 * vuelven a pedir: lo que se ve siempre es lo vigente.
 */
function useFechasDelServidor(habilitada: boolean, error: string | null) {
  const fechas = useFechasOperativasDisponibles(habilitada);
  const { refetch } = fechas;
  useEffect(() => {
    if (habilitada && error) void refetch();
  }, [habilitada, error, refetch]);
  return fechas;
}

type ConsultaFechas = ReturnType<typeof useFechasOperativasDisponibles>;

/**
 * Esqueleto mientras llegan, error con reintentar si fallan, o las tarjetas.
 * Nunca un calendario ni fechas calculadas en el teléfono.
 */
function OpcionesDelServidor({
  fechas,
  render,
}: {
  fechas: ConsultaFechas;
  render: (opciones: FechaDisponible[]) => ReactNode;
}) {
  if (fechas.isPending) {
    return (
      <Esqueleto etiqueta="Buscando los días disponibles" style={estilos.esqueleto}>
        <BloqueEsqueleto alto={TOQUE_MINIMO * 2} />
        <BloqueEsqueleto alto={TOQUE_MINIMO * 2} />
      </Esqueleto>
    );
  }
  if (fechas.isError) {
    const sinRed = fechas.error instanceof ErrorRed;
    return (
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudieron consultar los días'}
        detalle={
          sinRed
            ? 'Los días en que se puede cargar los da el servidor. Revisa tu señal y reintenta.'
            : (fechas.error instanceof Error && fechas.error.message) || 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void fechas.refetch()}
        reintentando={fechas.isFetching}
      />
    );
  }
  if (fechas.data.length === 0) {
    return (
      <BloqueError
        titulo="No hay días disponibles"
        detalle="El calendario no tiene días hábiles próximos. Pide a un supervisor que revise los días no laborables."
      />
    );
  }
  return <>{render(fechas.data)}</>;
}

function Contenido({
  tipo,
  conflicto,
  dias,
  sinVerificarConHandy = false,
  ocupado,
  error,
  onElegir,
  onContinuarExistente,
  onElegirOtra,
  onCerrar,
}: Props & { tipo: TipoCarga }) {
  const [ahora, setAhora] = useState(() => new Date());
  const [aviso, setAviso] = useState<string | null>(null);
  const fechas = useFechasDelServidor(!dias && !conflicto, error);

  const hoy = diaNegocio(ahora);
  // Si pasa la medianoche con el modal abierto, la salida de ayer ya no se recarga.
  const diasFijos = dias ? dias.filter((d) => d >= hoy) : null;

  /** Solo para los días de la recarga, que vienen de otra consulta. */
  const elegirFijo = (dia: string) => {
    if (dia < diaNegocio(new Date())) {
      setAhora(new Date());
      setAviso(AVISO_CAMBIO_DE_DIA);
      return;
    }
    setAviso(null);
    onElegir(dia);
  };

  const mensaje = aviso ?? error;
  const advertenciaHandy = sinVerificarConHandy ? (
    <BloqueError tono="atencion" titulo="Sin confirmar con Handy" detalle={AVISO_SIN_VERIFICAR_CON_HANDY} />
  ) : null;
  // El cambio de día no es una falla: se vuelve a elegir.
  const tonoMensaje = aviso ? 'atencion' : 'error';

  return (
    <>
        {conflicto ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              Ya hay una carga inicial para el {formatearDia(conflicto.dia).toLowerCase()}
            </Text>
            <Text style={estilos.detalle}>
              Tu ruta ya tiene una carga inicial para ese día. Puedes continuarla, o elegir otro día si esta carga es
              para una fecha distinta.
            </Text>
            {mensaje && <BloqueError titulo="No se pudo abrir esa carga" detalle={mensaje} tono={tonoMensaje} />}
            <Boton
              texto="Continuar esa carga"
              cargando={ocupado}
              textoCargando="Abriendo…"
              onPress={() => onContinuarExistente(conflicto)}
            />
            <Boton texto="Elegir otra fecha" variante="secundario" deshabilitado={ocupado} onPress={onElegirOtra} />
          </>
        ) : diasFijos && diasFijos.length === 0 ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              Ya no hay salida para recargar
            </Text>
            <Text style={estilos.detalle}>
              La salida que había terminó al cambiar el día. Para recargar, primero tiene que salir la carga inicial de hoy.
            </Text>
            <Boton texto="Cerrar" variante="secundario" onPress={onCerrar} />
          </>
        ) : diasFijos && diasFijos.length === 1 ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              ¿Iniciar {tipo === 'RECARGA' ? 'recarga' : 'carga'} para la salida {deLaSalida(diasFijos[0], hoy)}?
            </Text>
            <Text style={estilos.detalle}>{textoSalida(diasFijos[0], hoy)}. Lo que cuentes se suma a esa salida.</Text>
            {advertenciaHandy}
            {mensaje && (
              <BloqueError
                titulo={aviso ? 'Cambió el día' : 'No se pudo iniciar la carga'}
                detalle={mensaje}
                tono={tonoMensaje}
              />
            )}
            <Boton
              texto={tipo === 'RECARGA' ? 'Iniciar recarga' : 'Iniciar carga'}
              cargando={ocupado}
              textoCargando="Iniciando…"
              onPress={() => elegirFijo(diasFijos[0])}
            />
            <Boton texto="Cancelar" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
          </>
        ) : diasFijos ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              ¿A qué salida es esta {tipo === 'RECARGA' ? 'recarga' : 'carga'}?
            </Text>
            <Text style={estilos.detalle}>Tu ruta tiene varias salidas enviadas. Elige a cuál se suma.</Text>
            {advertenciaHandy}
            {diasFijos.map((dia) => {
              const relativo = diaRelativo(dia, hoy);
              return (
                <OpcionDia
                  key={dia}
                  titulo={relativo ? `Sale ${relativo.toLowerCase()}` : 'Sale'}
                  subtitulo={formatearDia(dia)}
                  marca={null}
                  deshabilitado={ocupado}
                  onPress={() => elegirFijo(dia)}
                />
              );
            })}
            {ocupado && <ActivityIndicator color={COLORES.texto} />}
            {mensaje && (
              <BloqueError
                titulo={aviso ? 'Cambió el día' : 'No se pudo iniciar la carga'}
                detalle={mensaje}
                tono={tonoMensaje}
              />
            )}
            <Boton texto="Cancelar" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
          </>
        ) : (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              ¿Para qué día es esta {tipo === 'RECARGA' ? 'recarga' : 'carga'}?
            </Text>
            <Text style={estilos.detalle}>{ETIQUETAS_TIPO_CARGA[tipo]}: elige el día en que sale el camión.</Text>
            <OpcionesDelServidor
              fechas={fechas}
              render={(opciones) =>
                opciones.map((opcion) => (
                  <OpcionDia
                    key={opcion.dia}
                    titulo={opcion.etiqueta}
                    // Lo normal es la siguiente salida; hoy es la excepción (camión descompuesto).
                    marca={opciones.length > 1 && !opcion.esHoy ? 'Sugerida' : null}
                    deshabilitado={ocupado || fechas.isFetching}
                    onPress={() => onElegir(opcion.dia)}
                  />
                ))
              }
            />
            {ocupado && <ActivityIndicator color={COLORES.texto} />}
            {mensaje && <BloqueError titulo="No se pudo iniciar la carga" detalle={mensaje} tono={tonoMensaje} />}
            <Boton texto="Cancelar" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
          </>
        )}
    </>
  );
}

/**
 * Mover de día una carga ya iniciada. Dos pasos en el mismo modal (apilar dos
 * modales falla en iOS): elegir el día entre los que da el servidor, con el
 * actual marcado si está entre ellos, y confirmar diciendo exactamente qué
 * pasa con lo contado.
 */
function ContenidoCambio({
  cambio,
  ocupado,
  error,
  onElegir,
  onCerrar,
}: Props & { cambio: CambioFechaSelector }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const lista = useRef<ScrollView>(null);
  const fechas = useFechasDelServidor(true, error);

  const hoy = diaNegocio(new Date());
  const { motivoMinimo } = cambio;
  const motivoValido = motivoMinimo === null || motivo.trim().length >= motivoMinimo;

  const elegir = (dia: string) => {
    if (dia === cambio.diaActual) {
      onCerrar();
      return;
    }
    setElegido(dia);
  };

  const confirmar = () => {
    if (elegido === null) return;
    setIntento(true);
    if (!motivoValido) return;
    onElegir(elegido, motivoMinimo === null ? undefined : motivo.trim());
  };

  if (elegido !== null) {
    const { titulo, cuerpo } = textoConfirmarCambioFecha(elegido, cambio.productosContados);
    return (
      <>
          <Text style={estilos.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={estilos.detalle}>{cuerpo}</Text>
          {motivoMinimo !== null && (
            <CampoTexto
              etiqueta="Motivo"
              valor={motivo}
              onCambiar={setMotivo}
              ejemplo="Ej. el camión sale hasta el lunes"
              multilinea
              maxLength={200}
              ayuda={`Obligatorio. Mínimo ${motivoMinimo} caracteres.`}
              error={intento && !motivoValido ? `Escribe por qué cambias la fecha (mínimo ${motivoMinimo} caracteres).` : null}
            />
          )}
          {error && <BloqueError titulo="No se pudo cambiar la fecha" detalle={error} />}
          <Boton texto="Sí, cambiar la fecha" cargando={ocupado} textoCargando="Cambiando…" onPress={confirmar} />
          {error ? (
            <Boton
              texto="Elegir otro día"
              variante="secundario"
              deshabilitado={ocupado}
              onPress={() => setElegido(null)}
            />
          ) : (
            <Boton texto="No, dejarla como está" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
          )}
      </>
    );
  }

  return (
    <>
        <Text style={estilos.titulo} accessibilityRole="header">
          ¿Para qué día sale el camión?
        </Text>
        <Text style={estilos.detalle}>Ahora: {textoSalida(cambio.diaActual, hoy).toLowerCase()}.</Text>
        <OpcionesDelServidor
          fechas={fechas}
          render={(opciones) => (
            <ScrollView ref={lista} style={estilos.listaDias} contentContainerStyle={estilos.contenidoDias}>
              {opciones.map((opcion) => {
                const actual = opcion.dia === cambio.diaActual;
                return (
                  <OpcionDia
                    key={opcion.dia}
                    titulo={opcion.etiqueta}
                    marca={actual ? 'Actual' : null}
                    deshabilitado={ocupado || fechas.isFetching}
                    onPress={() => elegir(opcion.dia)}
                    // Abre con el día actual a la vista, aunque esté al fondo de la lista.
                    onLayout={actual ? (y) => lista.current?.scrollTo({ y, animated: false }) : undefined}
                  />
                );
              })}
            </ScrollView>
          )}
        />
        <Boton texto="Dejarla como está" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
    </>
  );
}

interface PropsOpcionDia {
  titulo: string;
  /** Segundo renglón (el día completo) cuando el título no lo dice. */
  subtitulo?: string | null;
  /** "Sugerida" (la siguiente salida) o "Actual" (el día que ya tiene la carga): va rellena y con esa etiqueta. */
  marca: string | null;
  deshabilitado: boolean;
  onPress: () => void;
  onLayout?: (y: number) => void;
}

/** Tarjeta grande, todas del mismo tamaño: la marcada se distingue por el relleno y la etiqueta, no por ser más fácil de tocar. */
function OpcionDia({ titulo, subtitulo, marca, deshabilitado, onPress, onLayout }: PropsOpcionDia) {
  const propuesta = marca !== null;
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitado}
      tacto="seleccion"
      onda={ONDA.sobreColor}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}${subtitulo ? `, ${subtitulo}` : ''}${marca ? `. ${marca}` : ''}`}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.opcion,
        propuesta && estilos.opcionPropuesta,
        pressed && estilos.opcionPresionada,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {({ pressed }) => {
        const invertido = propuesta || pressed;
        return (
          <>
            <View style={estilos.filaOpcion}>
              <Text style={[estilos.tituloOpcion, invertido && estilos.textoInvertido]}>{titulo}</Text>
              {propuesta && (
                <View style={estilos.etiqueta}>
                  <Text style={estilos.textoEtiqueta}>{marca}</Text>
                </View>
              )}
            </View>
            {subtitulo && <Text style={[estilos.diaOpcion, invertido && estilos.textoInvertido]}>{subtitulo}</Text>}
          </>
        );
      }}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  opcion: {
    minHeight: TOQUE_MINIMO * 2,
    justifyContent: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    borderWidth: BORDES.medio,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.medio,
    backgroundColor: COLORES.superficie,
  },
  opcionPropuesta: {
    backgroundColor: COLORES.texto,
  },
  opcionPresionada: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
  },
  tituloOpcion: {
    ...TIPOGRAFIA.titulo,
    flexShrink: 1,
    color: COLORES.texto,
  },
  diaOpcion: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.medio,
    color: COLORES.texto,
  },
  etiqueta: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.superficie,
  },
  textoEtiqueta: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  deshabilitado: {
    opacity: OPACIDAD.deshabilitado,
  },
  // Caben unas tres opciones: el resto se desliza, y el modal no se sale de la pantalla.
  listaDias: {
    maxHeight: TOQUE_MINIMO * 7,
    flexGrow: 0,
  },
  contenidoDias: {
    gap: RITMO.relacionado,
  },
  esqueleto: {
    gap: RITMO.relacionado,
  },
});
