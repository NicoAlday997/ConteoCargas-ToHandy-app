import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  COLORES,
  ESPACIADO,
  FUENTE,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TONOS,
} from '../../theme/tokens';
import { Boton } from './Boton';
import { Glifo } from './Icono';

interface Props {
  /** Qué pasó, en una frase: "No se pudo cargar el historial". */
  titulo: string;
  /** Por qué, y qué se puede hacer. */
  detalle?: string | null;
  /** Sin esto, el bloque solo explica (p. ej. la acción principal del modal ya es reintentar). */
  onReintentar?: () => void;
  textoReintentar?: string;
  reintentando?: boolean;
  /** Otra salida junto a reintentar (p. ej. "Volver"). */
  secundaria?: { texto: string; onPress: () => void };
  /**
   * - error: algo falló o se rechazó.
   * - atencion: no es una falla de nadie (sin señal); se resuelve solo o esperando.
   * - exito: algo terminó bien y se confirma (el conteo quedó enviado).
   */
  tono?: 'error' | 'atencion' | 'exito';
  style?: StyleProp<ViewStyle>;
}

/**
 * Un error nunca es texto rojo suelto: es un bloque con qué pasó, por qué y
 * cómo seguir. Alineado a la izquierda, se lee como un aviso, no como un grito.
 */
export function BloqueError({
  titulo,
  detalle,
  onReintentar,
  textoReintentar = 'Reintentar',
  reintentando = false,
  secundaria,
  tono = 'error',
  style,
}: Props) {
  const colores =
    tono === 'error'
      ? TONOS.error
      : tono === 'exito'
        ? TONOS.capturado
        : TONOS.discrepancia;
  const borde =
    tono === 'error'
      ? COLORES.error
      : tono === 'exito'
        ? COLORES.capturadoHondo
        : COLORES.discrepanciaHonda;
  const glifo =
    tono === 'error' ? 'alto' : tono === 'exito' ? 'listo' : 'reloj';
  return (
    <View
      style={[
        estilos.bloque,
        { backgroundColor: colores.fondo, borderColor: borde },
        style,
      ]}
      accessibilityRole={tono === 'exito' ? 'summary' : 'alert'}
    >
      <View style={estilos.cabecera}>
        <Glifo nombre={glifo} color={colores.texto} tamano={TAMANO_SIGNO} />
        <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
      </View>
      {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      {(onReintentar || secundaria) && (
        <View style={estilos.acciones}>
          {secundaria && (
            <Boton
              texto={secundaria.texto}
              variante="secundario"
              onPress={secundaria.onPress}
              style={estilos.boton}
            />
          )}
          {onReintentar && (
            <Boton
              texto={textoReintentar}
              variante="secundario"
              onPress={onReintentar}
              cargando={reintentando}
              textoCargando="Reintentando…"
              style={estilos.boton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const TAMANO_SIGNO = ESPACIADO.xl;
/** Entre el signo y el texto: el texto queda en una columna propia. */
const HUECO_SIGNO = ESPACIADO.sm;

const estilos = StyleSheet.create({
  bloque: {
    width: '100%',
    gap: RITMO.interno,
    padding: RITMO.margen,
    borderRadius: RADIOS.control,
    borderWidth: 1.5,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HUECO_SIGNO,
  },
  titulo: {
    flex: 1,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 17,
    lineHeight: 24,
  },
  // Alineado con el título, no bajo el signo.
  detalle: {
    marginLeft: TAMANO_SIGNO + HUECO_SIGNO,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  // Bajo el texto que explican, alineadas con él.
  acciones: {
    marginLeft: TAMANO_SIGNO + HUECO_SIGNO,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.relacionado,
    // Otro grupo: lo que se puede hacer va aparte de lo que pasó.
    marginTop: ESPACIADO.md,
  },
  boton: {
    minWidth: ESPACIADO.xxxl * 3,
  },
});
