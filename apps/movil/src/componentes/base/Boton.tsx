import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Tacto } from '../../theme/tacto';
import {
  ALTO_CONTROL,
  BORDES,
  COLORES,
  ESCALA_PRESIONADO,
  ESCALA_TEXTO,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
  ONDA,
} from '../../theme/tokens';
import { Flecha } from './Icono';
import { Pulsable } from './Pulsable';

/**
 * - primario: la acción que se espera. Una por pantalla o por modal. Verde
 *   ruta: avanzar.
 * - secundario: volver, cancelar, alternativas. Placa blanca con contorno.
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
  /** Qué se siente al tocarlo; por omisión un toque ligero. */
  tacto?: Tacto | null;
  /** Solo para acomodarlo (flex, márgenes, ancho); la apariencia la dan los tokens. */
  style?: StyleProp<ViewStyle>;
}

const COLOR_CONTENIDO: Record<VarianteBoton, string> = {
  primario: COLORES.textoSobreColor,
  secundario: COLORES.texto,
  peligro: COLORES.errorTexto,
};

/** Onda de Android: un velo del color del contenido, se ve sobre cualquier relleno. */
const ONDA_VARIANTE: Record<VarianteBoton, string> = {
  primario: ONDA.sobreColor,
  secundario: ONDA.sobreClaro,
  peligro: ONDA.peligro,
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
  tacto = 'toque',
  style,
}: Props) {
  const inactivo = deshabilitado || cargando;
  const textoVisible = cargando ? (textoCargando ?? texto) : texto;

  return (
    <Pulsable
      onPress={onPress}
      disabled={inactivo}
      tacto={tacto}
      onda={ONDA_VARIANTE[variante]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detalle && grande ? `${textoVisible}. ${detalle}` : textoVisible)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.boton,
        grande && estilos.botonGrande,
        estilos[variante],
        pressed && estilos[`${variante}Presionado`],
        pressed && estilos.hundido,
        inactivo && estilos.deshabilitado,
        style,
      ]}
    >
      {() => {
        const colorContenido = COLOR_CONTENIDO[variante];
        if (grande) {
          // La acción principal de un inicio: un letrero de destino. Se lee
          // como un renglón (qué y para cuándo), lleva el filete interior de
          // un letrero y la flecha dice que lleva a otra pantalla.
          return (
            <>
              <View pointerEvents="none" style={[estilos.filete, variante === 'primario' ? estilos.fileteSobreColor : estilos.fileteClaro]} />
              <View style={estilos.textosGrande}>
                <View style={estilos.linea}>
                  {cargando && <ActivityIndicator color={colorContenido} />}
                  <Text
                    style={[estilos.textoGrande, { color: colorContenido }]}
                    numberOfLines={2}
                    maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
                  >
                    {textoVisible}
                  </Text>
                </View>
                {detalle ? (
                  <Text style={[estilos.detalle, { color: colorContenido }]} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
                    {detalle}
                  </Text>
                ) : null}
              </View>
              <Flecha color={colorContenido} tamano={ESPACIADO.xxl} />
            </>
          );
        }
        return (
          <View style={estilos.linea}>
            {cargando && <ActivityIndicator color={colorContenido} />}
            <Text
              style={[estilos.texto, { color: colorContenido }]}
              numberOfLines={2}
              maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
            >
              {textoVisible}
            </Text>
          </View>
        );
      }}
    </Pulsable>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: ESPACIADO.lg,
    paddingHorizontal: ESPACIADO.xl,
    paddingVertical: ESPACIADO.lg,
    borderRadius: RADIOS.grande,
  },
  // El filete interior del letrero: una línea a 4 del canto, del color del texto.
  filete: {
    position: 'absolute',
    top: ESPACIADO.xs,
    left: ESPACIADO.xs,
    right: ESPACIADO.xs,
    bottom: ESPACIADO.xs,
    borderRadius: RADIOS.grande - ESPACIADO.xs,
    borderWidth: BORDES.medio,
  },
  fileteSobreColor: {
    borderColor: COLORES.textoSobreColor,
    opacity: 0.55,
  },
  fileteClaro: {
    borderColor: COLORES.bordeSinContar,
  },
  textosGrande: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  // Se hunde apenas: el toque se siente aunque la onda no se vea al sol.
  hundido: {
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  primario: {
    backgroundColor: COLORES.accion,
  },
  primarioPresionado: {
    backgroundColor: COLORES.accionHonda,
  },
  // Placa blanca con contorno: a pleno sol no se funde con el concreto.
  secundario: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.bordeSinContar,
  },
  secundarioPresionado: {
    backgroundColor: COLORES.marcaTinte,
    borderColor: COLORES.borde,
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
  // La voz del letrero: condensada y firme, en minúsculas como un destino.
  texto: {
    fontFamily: FUENTE.titular,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  textoGrande: {
    flexShrink: 1,
    ...TIPOGRAFIA.titulo,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.medio,
  },
});
