import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS_TIPO_CARGA, type TipoCarga } from '../api/cargas';
import { BloqueError, Boton, CampoTexto } from '../componentes/base';
import { ANCHO_MODAL, BORDES, COLORES, ESPACIADO, OPACIDAD, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  deLaSalida,
  diaNegocio,
  diaRelativo,
  formatearDia,
  opcionesCambioFecha,
  opcionesFechaOperativa,
  textoConfirmarCambioFecha,
  textoSalida,
} from './fecha-operativa';

/** Mover de día una carga ya iniciada, en vez de elegir el día de una nueva. */
export interface CambioFechaSelector {
  /** `aaaa-mm-dd`: el día que tiene hoy la carga. El selector abre marcándolo. */
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
   * Con uno solo no se pregunta el día, se confirma. Sin esto: hoy o mañana.
   */
  dias?: readonly string[] | null;
  /**
   * Handy no respondió al buscar la ruta abierta: se puede contar, pero se
   * advierte antes de confirmar (atención, no bloqueo).
   */
  sinVerificarConHandy?: boolean;
  /**
   * Mover una carga ya iniciada: ofrece de hoy a una semana con el día actual
   * marcado y, al elegir otro, pregunta antes (lo contado se conserva) y solo
   * entonces llama a `onElegir`, con el motivo si se pidió.
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
 * Para qué día sale el camión. Lo normal es contar por la tarde para mañana;
 * si el camión se descompuso, se cuenta en la mañana para hoy. No se adivina:
 * las dos opciones tienen el mismo tamaño y lugar, y la propuesta (siempre
 * mañana) solo se marca. Nunca se ofrece un día pasado.
 *
 * La recarga no elige libremente: se suma a una salida que ya está en Handy,
 * así que solo ofrece esos días (`dias`), sin propuesta.
 */
export function SelectorFechaOperativa(props: Props) {
  const { ocupado, onCerrar } = props;
  return (
    <Modal
      visible={props.tipo !== null}
      transparent
      animationType="none"
      onRequestClose={ocupado ? () => undefined : onCerrar}
    >
      {/* Montado solo abierto: cada vez que se abre, "hoy" se vuelve a calcular. */}
      {props.tipo !== null &&
        (props.cambio ? (
          <ContenidoCambio {...props} cambio={props.cambio} />
        ) : (
          <Contenido {...props} tipo={props.tipo} />
        ))}
    </Modal>
  );
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

  const opciones = opcionesFechaOperativa(ahora);
  const hoy = opciones.hoy;
  // Si pasa la medianoche con el modal abierto, la salida de ayer ya no se recarga.
  const diasFijos = dias ? dias.filter((d) => d >= hoy) : null;

  const elegir = (dia: string) => {
    // Si pasó la medianoche con el selector abierto, "hoy" ya es ayer.
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
    <View style={estilos.fondo}>
      <View style={estilos.tarjeta}>
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
              onPress={() => elegir(diasFijos[0])}
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
                  dia={dia}
                  marca={null}
                  deshabilitado={ocupado}
                  onPress={() => elegir(dia)}
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
            <OpcionDia
              titulo="Sale hoy"
              dia={opciones.hoy}
              marca={opciones.propuesta === 'hoy' ? 'Sugerida' : null}
              deshabilitado={ocupado}
              onPress={() => elegir(opciones.hoy)}
            />
            <OpcionDia
              titulo="Sale mañana"
              dia={opciones.manana}
              marca={opciones.propuesta === 'manana' ? 'Sugerida' : null}
              deshabilitado={ocupado}
              onPress={() => elegir(opciones.manana)}
            />
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
        )}
      </View>
    </View>
  );
}

/**
 * Mover de día una carga ya iniciada. Dos pasos en el mismo modal (apilar dos
 * modales falla en iOS): elegir el día, con el actual marcado y a la vista, y
 * confirmar diciendo exactamente qué pasa con lo contado.
 */
function ContenidoCambio({
  cambio,
  ocupado,
  error,
  onElegir,
  onCerrar,
}: Props & { cambio: CambioFechaSelector }) {
  const [ahora, setAhora] = useState(() => new Date());
  const [aviso, setAviso] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const lista = useRef<ScrollView>(null);

  const hoy = diaNegocio(ahora);
  const dias = opcionesCambioFecha(hoy, cambio.diaActual);
  const { motivoMinimo } = cambio;
  const motivoValido = motivoMinimo === null || motivo.trim().length >= motivoMinimo;

  const elegir = (dia: string) => {
    if (dia === cambio.diaActual) {
      onCerrar();
      return;
    }
    // Si pasó la medianoche con el selector abierto, "hoy" ya es ayer.
    if (dia < diaNegocio(new Date())) {
      setAhora(new Date());
      setElegido(null);
      setAviso(AVISO_CAMBIO_DE_DIA);
      return;
    }
    setAviso(null);
    setElegido(dia);
  };

  const confirmar = () => {
    if (elegido === null) return;
    setIntento(true);
    if (!motivoValido) return;
    if (elegido < diaNegocio(new Date())) {
      elegir(elegido);
      return;
    }
    onElegir(elegido, motivoMinimo === null ? undefined : motivo.trim());
  };

  if (elegido !== null) {
    const { titulo, cuerpo } = textoConfirmarCambioFecha(elegido, cambio.productosContados);
    return (
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
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
          <Boton texto="No, dejarla como está" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.fondo}>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo} accessibilityRole="header">
          ¿Para qué día sale el camión?
        </Text>
        <Text style={estilos.detalle}>Ahora: {textoSalida(cambio.diaActual, hoy).toLowerCase()}.</Text>
        {aviso && <BloqueError titulo="Cambió el día" detalle={aviso} tono="atencion" />}
        <ScrollView ref={lista} style={estilos.listaDias} contentContainerStyle={estilos.contenidoDias}>
          {dias.map((dia) => {
            const relativo = diaRelativo(dia, hoy);
            const actual = dia === cambio.diaActual;
            return (
              <OpcionDia
                key={dia}
                titulo={relativo ? `Sale ${relativo.toLowerCase()}` : 'Sale'}
                dia={dia}
                marca={actual ? 'Actual' : null}
                deshabilitado={ocupado}
                onPress={() => elegir(dia)}
                // Abre con el día actual a la vista, aunque esté al fondo de la lista.
                onLayout={actual ? (y) => lista.current?.scrollTo({ y, animated: false }) : undefined}
              />
            );
          })}
        </ScrollView>
        <Boton texto="Dejarla como está" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
      </View>
    </View>
  );
}

interface PropsOpcionDia {
  titulo: string;
  dia: string;
  /** "Sugerida" (la propuesta) o "Actual" (el día que ya tiene la carga): va rellena y con esa etiqueta. */
  marca: string | null;
  deshabilitado: boolean;
  onPress: () => void;
  onLayout?: (y: number) => void;
}

/** Mismo tamaño para todas: la marcada se distingue por el relleno y la etiqueta, no por ser más fácil de tocar. */
function OpcionDia({ titulo, dia, marca, deshabilitado, onPress, onLayout }: PropsOpcionDia) {
  const legible = formatearDia(dia);
  const propuesta = marca !== null;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${legible}${marca ? `. ${marca}` : ''}`}
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
            <Text style={[estilos.diaOpcion, invertido && estilos.textoInvertido]}>{legible}</Text>
          </>
        );
      }}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
    backgroundColor: COLORES.velo,
  },
  tarjeta: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
  },
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
    backgroundColor: COLORES.textoSecundario,
    borderColor: COLORES.textoSecundario,
  },
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
  },
  tituloOpcion: {
    ...TIPOGRAFIA.titulo,
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
});
