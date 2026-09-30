import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Tacto } from '../../theme/tacto';
import {
  ALTO_CONTROL,
  BORDES,
  COLORES,
  DEGRADADOS,
  ESCALA_PRESIONADO,
  ESCALA_PRESIONADO_CONTROL,
  ESCALA_TEXTO,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  radioInterior,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
  ONDA,
} from '../../theme/tokens';
import { Degradado } from './Degradado';
import { Flecha } from './Icono';
import { Pulsable } from './Pulsable';

/**
 * - primario: la acción que se espera. Una por pantalla o por modal. Azul
 *   señal en degradado, con la sombra teñida del mismo azul: se ve encendido.
 * - secundario: volver, cancelar, alternativas. Pieza blanca con texto azul.
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
  secundario: COLORES.accionHonda,
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
      escala={grande ? ESCALA_PRESIONADO : ESCALA_PRESIONADO_CONTROL}
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
        const colorContenido = COLOR_CONTENIDO[variante];
        const relleno =
          variante === 'primario' ? (
            <Degradado
              degradado={pressed ? DEGRADADOS.accionPresionada : DEGRADADOS.accion}
              // Con sombra no se recorta: radio interior; el primario no lleva borde.
              radio={radioInterior(grande ? RADIOS.grande : RADIOS.control, 0)}
            />
          ) : null;
        if (grande) {
          // La acción principal de un inicio: se lee como un renglón (qué y
          // para cuándo) y la flecha en su círculo dice que lleva a otra pantalla.
          return (
            <>
              {relleno}
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
              <View style={[estilos.circuloFlecha, variante === 'primario' ? estilos.circuloSobreColor : estilos.circuloClaro]}>
                <Flecha color={colorContenido} tamano={ESPACIADO.xl} />
              </View>
            </>
          );
        }
        return (
          <>
            {relleno}
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
          </>
        );
      }}
    </Pulsable>
  );
}

const LADO_CIRCULO_FLECHA = ESPACIADO.xxl + ESPACIADO.md;

const estilos = StyleSheet.create({
  boton: {
    minHeight: ALTO_CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.xl,
    paddingVertical: ESPACIADO.sm,
    borderRadius: RADIOS.control,
  },
  botonGrande: {
    minHeight: TOQUE_MINIMO * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: ESPACIADO.lg,
    paddingHorizontal: ESPACIADO.xl,
    paddingVertical: ESPACIADO.lg + ESPACIADO.xs,
    borderRadius: RADIOS.grande,
  },
  // La flecha va en un círculo: la forma dice "adelante" aunque el sol lave el azul.
  circuloFlecha: {
    width: LADO_CIRCULO_FLECHA,
    height: LADO_CIRCULO_FLECHA,
    borderRadius: RADIOS.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloSobreColor: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: BORDES.fino,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  circuloClaro: {
    backgroundColor: COLORES.azulSuave,
  },
  textosGrande: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  // El degradado va dibujado dentro; la sombra toma el azul del botón.
  primario: {
    boxShadow: SOMBRAS.accion,
  },
  primarioPresionado: {
    boxShadow: 'none',
  },
  // Pieza blanca con contorno fino y sombra: a pleno sol no se funde con el fondo.
  secundario: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
    boxShadow: SOMBRAS.tarjeta,
  },
  secundarioPresionado: {
    backgroundColor: COLORES.marcaTinte,
    borderColor: COLORES.accion,
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
    fontFamily: FUENTE.extraNegrita,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  textoGrande: {
    flexShrink: 1,
    ...TIPOGRAFIA.titulo,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    opacity: 0.92,
  },
});
