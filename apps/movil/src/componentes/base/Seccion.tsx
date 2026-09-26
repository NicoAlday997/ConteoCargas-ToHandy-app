import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { CIFRAS, COLORES, ESPACIADO, ETIQUETA_DATO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';

interface PropsTitulo {
  texto: string;
  /** A la derecha, con menos peso: un conteo ("3 de 5") o un dato del grupo. */
  detalle?: string | null;
  /** A la derecha, en lugar del detalle: una acción del grupo (p. ej. "Actualizar"). */
  accion?: { texto: string; onPress: () => void; accessibilityLabel?: string };
  /**
   * - seccion: agrupa bloques distintos de una pantalla ("Cargas por verificar").
   * - grupo: subdivide una lista ya titulada ("Listas para verificar").
   */
  nivel?: 'seccion' | 'grupo';
}

/**
 * Título que agrupa lo que viene debajo. El aire lo pone quien lo contiene:
 * más arriba (entre secciones) que abajo (hasta su contenido).
 */
export function TituloSeccion({ texto, detalle, accion, nivel = 'seccion' }: PropsTitulo) {
  return (
    <View style={estilos.cabecera}>
      <Text style={nivel === 'seccion' ? estilos.seccion : estilos.grupo} accessibilityRole="header" numberOfLines={2}>
        {texto}
      </Text>
      {accion ? (
        <Pressable
          onPress={accion.onPress}
          accessibilityRole="button"
          accessibilityLabel={accion.accessibilityLabel}
          hitSlop={ESPACIADO.sm}
          style={({ pressed }) => [estilos.accion, pressed && estilos.accionPresionada]}
        >
          {({ pressed }) => <Text style={[estilos.textoAccion, pressed && estilos.textoInvertido]}>{accion.texto}</Text>}
        </Pressable>
      ) : detalle ? (
        <Text style={estilos.detalle}>{detalle}</Text>
      ) : null}
    </View>
  );
}

/**
 * Título y su contenido. Dentro, el contenido se separa por `RITMO.relacionado`;
 * entre secciones, el contenedor pone `RITMO.seccion`.
 */
export function Seccion({
  children,
  style,
  ...titulo
}: Partial<PropsTitulo> & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[estilos.bloque, style]}>
      {titulo.texto ? <TituloSeccion {...(titulo as PropsTitulo)} /> : null}
      <View style={estilos.contenido}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // El título pegado a lo que agrupa; entre secciones, el contenedor pone mucho más.
  bloque: {
    gap: ESPACIADO.sm,
  },
  contenido: {
    gap: RITMO.relacionado,
  },
  cabecera: {
    minHeight: TIPOGRAFIA.titulo.lineHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
  },
  seccion: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  grupo: {
    flex: 1,
    ...ETIQUETA_DATO,
  },
  detalle: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
  // Acción de texto: mide el toque mínimo aunque se vea ligera.
  accion: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    marginVertical: -ESPACIADO.md,
    marginRight: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.medio,
  },
  accionPresionada: {
    backgroundColor: COLORES.texto,
  },
  // Enlace de texto: neutro y subrayado (ver la regla del azul en tokens.ts).
  textoAccion: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
    textDecorationLine: 'underline',
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});
