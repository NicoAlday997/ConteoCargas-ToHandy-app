import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS_TIPO_CARGA, type TipoCarga } from '../api/cargas';
import { BloqueError, Boton } from '../componentes/base';
import { ANCHO_MODAL, BORDES, COLORES, ESPACIADO, OPACIDAD, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import { deLaSalida, diaNegocio, diaRelativo, formatearDia, opcionesFechaOperativa, textoSalida } from './fecha-operativa';

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
  /** Creando la carga o abriendo la existente: botones bloqueados. */
  ocupado: boolean;
  error: string | null;
  onElegir: (dia: string) => void;
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
      {props.tipo !== null && <Contenido {...props} tipo={props.tipo} />}
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
                  propuesta={false}
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
              propuesta={opciones.propuesta === 'hoy'}
              deshabilitado={ocupado}
              onPress={() => elegir(opciones.hoy)}
            />
            <OpcionDia
              titulo="Sale mañana"
              dia={opciones.manana}
              propuesta={opciones.propuesta === 'manana'}
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

interface PropsOpcionDia {
  titulo: string;
  dia: string;
  propuesta: boolean;
  deshabilitado: boolean;
  onPress: () => void;
}

/** Mismo tamaño para ambas: la propuesta se distingue por el relleno y la etiqueta, no por ser más fácil de tocar. */
function OpcionDia({ titulo, dia, propuesta, deshabilitado, onPress }: PropsOpcionDia) {
  const legible = formatearDia(dia);
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${legible}${propuesta ? '. Sugerida' : ''}`}
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
                  <Text style={estilos.textoEtiqueta}>Sugerida</Text>
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
});
