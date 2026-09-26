import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ALTO_CONTROL, BORDES, COLORES, ESPACIADO, FUENTE, OPACIDAD, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';

/**
 * - primario: la acción que se espera. Una por pantalla o por modal.
 * - secundario: volver, cancelar, alternativas. Gris, sin borde.
 * - peligro: la acción no se puede deshacer. NUNCA es el botón dominante:
 *   contorno y texto en rojo; el sólido de ese modal es la salida segura
 *   ("No, volver").
 */
export type VarianteBoton = 'primario' | 'secundario' | 'peligro';

interface Props {
  texto: string;
  onPress: () => void;
  variante?: VarianteBoton;
  /** Doble de alto con una segunda línea: la acción principal de una pantalla de inicio. */
  grande?: boolean;
  /** Segunda línea, solo con `grande`. */
  detalle?: string;
  deshabilitado?: boolean;
  /** Deshabilita y muestra un indicador: la acción ya se está haciendo. */
  cargando?: boolean;
  /** Lo que dice mientras carga (p. ej. "Guardando…"); por omisión, el mismo texto. */
  textoCargando?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Solo para acomodarlo (flex, márgenes, ancho); la apariencia la dan los tokens. */
  style?: StyleProp<ViewStyle>;
}

const COLOR_CONTENIDO: Record<VarianteBoton, string> = {
  primario: COLORES.textoSobreColor,
  secundario: COLORES.texto,
  peligro: COLORES.error,
};

export function Boton({
  texto,
  onPress,
  variante = 'primario',
  grande = false,
  detalle,
  deshabilitado = false,
  cargando = false,
  textoCargando,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const inactivo = deshabilitado || cargando;
  const textoVisible = cargando ? (textoCargando ?? texto) : texto;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detalle && grande ? `${textoVisible}. ${detalle}` : textoVisible)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.boton,
        grande && estilos.botonGrande,
        estilos[variante],
        pressed && estilos[`${variante}Presionado`],
        inactivo && estilos.deshabilitado,
        style,
      ]}
    >
      {() => {
        const colorContenido = COLOR_CONTENIDO[variante];
        return (
          <>
            <View style={estilos.linea}>
              {cargando && <ActivityIndicator color={colorContenido} />}
              <Text style={[grande ? estilos.textoGrande : estilos.texto, { color: colorContenido }]} numberOfLines={2}>
                {textoVisible}
              </Text>
            </View>
            {grande && detalle && <Text style={[estilos.detalle, { color: colorContenido }]}>{detalle}</Text>}
          </>
        );
      }}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: ALTO_CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.sm,
    borderRadius: RADIOS.medio,
  },
  botonGrande: {
    minHeight: TOQUE_MINIMO * 2,
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.xl,
  },
  primario: {
    backgroundColor: COLORES.marca,
  },
  primarioPresionado: {
    backgroundColor: COLORES.marcaHonda,
  },
  secundario: {
    backgroundColor: COLORES.superficieHonda,
  },
  secundarioPresionado: {
    backgroundColor: COLORES.divisor,
  },
  // Contorno: se lee como posible, no como lo esperado.
  peligro: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.error,
  },
  peligroPresionado: {
    backgroundColor: COLORES.errorFondo,
  },
  deshabilitado: {
    opacity: OPACIDAD.deshabilitado,
  },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  texto: {
    ...TIPOGRAFIA.subtitulo,
    textAlign: 'center',
  },
  textoGrande: {
    ...TIPOGRAFIA.titulo,
    textAlign: 'center',
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.medio,
    textAlign: 'center',
  },
});
