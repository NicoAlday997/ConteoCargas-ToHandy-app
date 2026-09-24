import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BORDES, COLORES, ESPACIADO, OPACIDAD, PESOS, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';

/**
 * - primario: la acción que se espera. Una por pantalla o por modal.
 * - secundario: volver, cancelar, alternativas.
 * - peligro: la acción no se puede deshacer.
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

const CONTENIDO_INVERTIDO: Record<VarianteBoton, boolean> = {
  primario: true,
  secundario: false,
  peligro: true,
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
      {({ pressed }) => {
        // Inversión completa al presionar: se nota aun con poca luz.
        const invertido = CONTENIDO_INVERTIDO[variante] || pressed;
        const colorContenido = invertido ? COLORES.textoSobreColor : COLORES.marcaOscuro;
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
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.sm,
    borderWidth: BORDES.medio,
    borderRadius: RADIOS.medio,
  },
  botonGrande: {
    minHeight: TOQUE_MINIMO * 2,
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.xl,
  },
  primario: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  primarioPresionado: {
    backgroundColor: COLORES.marcaOscuro,
    borderColor: COLORES.marcaOscuro,
  },
  // Blanco con contorno de marca: se lee como botón sobre el fondo tintado.
  secundario: {
    backgroundColor: COLORES.fondo,
    borderColor: COLORES.marca,
  },
  secundarioPresionado: {
    backgroundColor: COLORES.marcaOscuro,
    borderColor: COLORES.marcaOscuro,
  },
  peligro: {
    backgroundColor: COLORES.error,
    borderColor: COLORES.error,
  },
  peligroPresionado: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
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
    fontWeight: PESOS.medio,
    textAlign: 'center',
  },
});
