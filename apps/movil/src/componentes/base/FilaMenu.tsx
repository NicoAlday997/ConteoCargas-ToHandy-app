import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { COLORES, ELEVACION, ESPACIADO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';
import { Chevron } from './Icono';

/**
 * Opciones de navegación agrupadas en un solo bloque blanco, sin líneas entre
 * ellas: cada renglón ya mide un toque y el texto las separa.
 */
export function GrupoMenu({ children }: { children: ReactNode }) {
  return <View style={estilos.grupo}>{children}</View>;
}

interface Props {
  texto: string;
  /** Lo que hay detrás, en una línea que se retira. */
  detalle?: string;
  onPress: () => void;
  /** Salir, cerrar sesión: sin flecha, porque no lleva a otra pantalla. */
  salida?: boolean;
  cargando?: boolean;
  accessibilityHint?: string;
}

export function FilaMenu({ texto, detalle, onPress, salida = false, cargando = false, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: cargando }}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
    >
      {({ pressed }) => (
        <>
          <View style={estilos.textos}>
            <Text style={[estilos.texto, salida && estilos.textoSalida, pressed && estilos.invertido]}>
              {cargando ? 'Un momento…' : texto}
            </Text>
            {detalle ? <Text style={[estilos.detalle, pressed && estilos.invertido]}>{detalle}</Text> : null}
          </View>
          {!salida && <Chevron color={pressed ? COLORES.textoSobreColor : undefined} />}
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    ...ELEVACION[1],
    borderRadius: RADIOS.grande,
    overflow: 'hidden',
    paddingVertical: ESPACIADO.xs,
  },
  fila: {
    minHeight: TOQUE_MINIMO + ESPACIADO.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingVertical: RITMO.interno,
  },
  // Inversión completa: el toque se nota aun con poca luz.
  presionada: {
    backgroundColor: COLORES.marca,
  },
  textos: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  texto: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  textoSalida: {
    color: COLORES.marcaHonda,
  },
  detalle: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
  },
  invertido: {
    color: COLORES.textoSobreColor,
  },
});
