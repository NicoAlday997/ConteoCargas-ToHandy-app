import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  BORDES,
  CIFRAS,
  COLORES,
  ELEVACION,
  ESPACIADO,
  PESOS,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TONOS,
  type ColorEstado,
  type ColorTono,
  type NivelElevacion,
} from '../../theme/tokens';

/** Espacio entre tarjetas de una lista: que un renglón no se confunda con el siguiente. */
export const SEPARACION_TARJETAS = RITMO.relacionado;

const TAMANO_PUNTO = ESPACIADO.sm;

/** Primera línea de la tarjeta: un punto del color del estado y su nombre en ese color. */
export interface BandaTarjeta {
  titulo: string;
  tono: ColorTono;
  /** A la derecha del título, en la misma banda (p. ej. "3 de 5"). */
  detalle?: string | null;
}

interface Props {
  children?: ReactNode;
  /** 0: bloque plano dentro de otro. 1 (por omisión): bloque independiente en una lista. */
  elevacion?: NivelElevacion;
  /** Barra de color a la izquierda: el estado se ve sin leer. */
  acento?: ColorEstado;
  /**
   * El estado como primera línea: punto de color y nombre en el color del
   * estado, con un detalle a la derecha. Color sin bloques: la tarjeta sigue
   * siendo blanca y el estado se lee antes que nada.
   */
  conAcento?: BandaTarjeta;
  /** Fondo tintado del tono en vez de blanco: un bloque que comunica un estado. */
  tintada?: ColorTono;
  /** Menos relleno, para tarjetas que llevan controles y deben caber varias por pantalla. */
  compacta?: boolean;
  /** Con `onPress` toda la tarjeta es un botón. */
  onPress?: () => void;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Solo para acomodarla (flex, márgenes); la apariencia la dan los tokens. */
  style?: StyleProp<ViewStyle>;
}

export function Tarjeta({
  children,
  elevacion = 1,
  acento,
  conAcento,
  tintada,
  compacta = false,
  onPress,
  accessible,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const relleno = compacta ? estilos.compacta : estilos.normal;
  const estilo = [
    estilos.base,
    ELEVACION[elevacion],
    relleno,
    tintada && { backgroundColor: TONOS[tintada].fondo },
    // La barra de estado es el único borde de una tarjeta: comunica, no delimita.
    acento && [estilos.acento, { borderLeftColor: COLORES[acento] }],
    style,
  ];

  const contenido = conAcento ? (
    <>
      <View style={estilos.banda}>
        <View style={[estilos.punto, { backgroundColor: TONOS[conAcento.tono].solido }]} />
        <Text style={[estilos.tituloBanda, { color: TONOS[conAcento.tono].texto }]} accessibilityRole="header" numberOfLines={2}>
          {conAcento.titulo}
        </Text>
        {conAcento.detalle ? <Text style={estilos.detalleBanda}>{conAcento.detalle}</Text> : null}
      </View>
      {children}
    </>
  ) : (
    children
  );

  if (!onPress) {
    return (
      <View style={estilo} accessible={accessible} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}>
        {contenido}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [estilo, pressed && estilos.presionada]}
    >
      {contenido}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    borderRadius: RADIOS.grande,
    overflow: 'hidden',
  },
  normal: {
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
  },
  compacta: {
    gap: RITMO.interno,
    padding: RITMO.margen,
  },
  acento: {
    borderLeftWidth: BORDES.acento,
  },
  banda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
  },
  punto: {
    width: TAMANO_PUNTO,
    height: TAMANO_PUNTO,
    borderRadius: RADIOS.completo,
  },
  tituloBanda: {
    flex: 1,
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detalleBanda: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
  // Tinte de marca y la tarjeta se hunde un poco: el toque se nota al instante.
  presionada: {
    backgroundColor: COLORES.marcaClaro,
    transform: [{ scale: 0.98 }],
  },
});
