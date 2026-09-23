import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS_TIPO_CARGA, type TipoCarga } from '../api/cargas';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import { diaNegocio, formatearDia, horaNegocio, opcionesFechaOperativa } from './fecha-operativa';

/** Ya hay carga inicial de la ruta para ese día: se ofrece continuarla. */
export interface ConflictoFecha {
  eventoId: string;
  dia: string;
}

/**
 * El servidor no dejó iniciar la carga inicial: la ruta anterior del vendedor
 * sigue sin liquidar en Handy. Es la regla funcionando, no una falla.
 */
export interface BloqueoLiquidacion {
  dia: string;
  /** Cuántas veces se ha revisado con el servidor, contando la primera. */
  revisiones: number;
  revisadoEn: Date;
}

interface Props {
  /** `null` = cerrado. */
  tipo: TipoCarga | null;
  conflicto: ConflictoFecha | null;
  sinLiquidar: BloqueoLiquidacion | null;
  /** Creando la carga o abriendo la existente: botones bloqueados. */
  ocupado: boolean;
  error: string | null;
  onElegir: (dia: string) => void;
  onContinuarExistente: (conflicto: ConflictoFecha) => void;
  onElegirOtra: () => void;
  /** Vuelve a intentar crear la carga para el mismo día: puede que ya la hayan liquidado. */
  onReintentarLiquidacion: (bloqueo: BloqueoLiquidacion) => void;
  onCerrar: () => void;
}

const AVISO_CAMBIO_DE_DIA = 'Cambió el día mientras elegías. Revisa las fechas y elige de nuevo.';

/**
 * Para qué día sale el camión. Lo normal es contar por la tarde para mañana;
 * si el camión se descompuso, se cuenta en la mañana para hoy. No se adivina:
 * las dos opciones tienen el mismo tamaño y lugar, y la propuesta (siempre
 * mañana) solo se marca. Nunca se ofrece un día pasado.
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
  sinLiquidar,
  ocupado,
  error,
  onElegir,
  onContinuarExistente,
  onElegirOtra,
  onReintentarLiquidacion,
  onCerrar,
}: Props & { tipo: TipoCarga }) {
  const [ahora, setAhora] = useState(() => new Date());
  const [aviso, setAviso] = useState<string | null>(null);

  const opciones = opcionesFechaOperativa(ahora);

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

  return (
    <View style={estilos.fondo}>
      <View style={estilos.tarjeta}>
        {sinLiquidar ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              Primero hay que liquidar tu ruta anterior
            </Text>
            <Text style={estilos.detalle}>
              Handy todavía muestra abierta tu ruta anterior. La carga inicial del{' '}
              {formatearDia(sinLiquidar.dia).toLowerCase()} se puede iniciar en cuanto esa ruta quede liquidada.
            </Text>
            <Text style={estilos.detalle} accessibilityLiveRegion="polite">
              {sinLiquidar.revisiones > 1
                ? `Revisado de nuevo a las ${horaNegocio(sinLiquidar.revisadoEn)}: sigue sin liquidar.`
                : 'Si ya la liquidaron, revisa de nuevo.'}
            </Text>
            {mensaje && (
              <Text style={estilos.error} accessibilityRole="alert">
                {mensaje}
              </Text>
            )}
            <BotonAccion
              texto={ocupado ? 'Revisando…' : 'Revisar de nuevo'}
              principal
              deshabilitado={ocupado}
              onPress={() => onReintentarLiquidacion(sinLiquidar)}
            />
            <BotonAccion texto="Cerrar" deshabilitado={ocupado} onPress={onCerrar} />
            <Text style={estilos.nota}>Si es urgente, un supervisor puede autorizar esta carga desde su cuenta.</Text>
          </>
        ) : conflicto ? (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              Ya hay una carga inicial para el {formatearDia(conflicto.dia).toLowerCase()}
            </Text>
            <Text style={estilos.detalle}>
              Tu ruta ya tiene una carga inicial para ese día. Puedes continuarla, o elegir otro día si esta carga es
              para una fecha distinta.
            </Text>
            {mensaje && (
              <Text style={estilos.error} accessibilityRole="alert">
                {mensaje}
              </Text>
            )}
            <BotonAccion
              texto={ocupado ? 'Abriendo…' : 'Continuar esa carga'}
              principal
              deshabilitado={ocupado}
              onPress={() => onContinuarExistente(conflicto)}
            />
            <BotonAccion texto="Elegir otra fecha" deshabilitado={ocupado} onPress={onElegirOtra} />
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
              <Text style={estilos.error} accessibilityRole="alert">
                {mensaje}
              </Text>
            )}
            <BotonAccion texto="Cancelar" deshabilitado={ocupado} onPress={onCerrar} />
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

function BotonAccion({
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
        estilos.boton,
        principal && estilos.botonPrincipal,
        pressed && estilos.botonPresionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {({ pressed }) => (
        <Text style={[estilos.textoBoton, (principal || pressed) && estilos.textoInvertido]}>{texto}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  tarjeta: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.lg,
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  detalle: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  opcion: {
    minHeight: TOQUE_MINIMO * 2,
    justifyContent: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.fondo,
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
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  diaOpcion: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.texto,
  },
  etiqueta: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.fondo,
  },
  textoEtiqueta: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  boton: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPrincipal: {
    backgroundColor: COLORES.texto,
  },
  botonPresionado: {
    backgroundColor: COLORES.textoSecundario,
    borderColor: COLORES.textoSecundario,
  },
  textoBoton: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  deshabilitado: {
    opacity: 0.5,
  },
  nota: {
    paddingTop: ESPACIADO.sm,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  error: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
  },
});
