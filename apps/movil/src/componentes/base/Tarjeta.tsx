import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  CIFRAS,
  COLORES,
  ELEVACION,
  ESPACIADO,
  ETIQUETA_DATO,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TONOS,
  type ColorTono,
  type NivelElevacion,
} from '../../theme/tokens';

/** Espacio entre tarjetas de una lista: que un renglón no se confunda con el siguiente. */
export const SEPARACION_TARJETAS = RITMO.relacionado;

/**
 * Primera línea de la tarjeta: el estado como BLOQUE (fondo tintado, texto
 * oscuro del mismo tono, peso fuerte), no como texto de color. Se lee de reojo.
 */
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
  /**
   * El estado como primera línea: un bloque tintado con su nombre, y un
   * detalle a la derecha como rótulo. La tarjeta sigue blanca; el estado es lo
   * único de color.
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
    style,
  ];

  const contenido = conAcento ? (
    <>
      <View style={estilos.banda}>
        <View style={[estilos.bloqueEstado, { backgroundColor: TONOS[conAcento.tono].fondo }]}>
          <Text style={[estilos.tituloBanda, { color: TONOS[conAcento.tono].texto }]} accessibilityRole="header" numberOfLines={2}>
            {conAcento.titulo}
          </Text>
        </View>
        {conAcento.detalle ? (
          <Text style={estilos.detalleBanda} numberOfLines={1}>
            {conAcento.detalle}
          </Text>
        ) : null}
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
  banda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
  },
  // Pastilla del ancho de su texto: tinte del estado y texto hondo del mismo color.
  bloqueEstado: {
    flexShrink: 1,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
  },
  tituloBanda: TIPOGRAFIA.etiqueta,
  detalleBanda: {
    ...ETIQUETA_DATO,
    ...CIFRAS,
  },
  // Tinte de marca y la tarjeta se hunde un poco: el toque se nota al instante.
  presionada: {
    backgroundColor: COLORES.marcaTinte,
    transform: [{ scale: 0.98 }],
  },
});
