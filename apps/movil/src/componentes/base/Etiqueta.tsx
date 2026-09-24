import { StyleSheet, Text, View } from 'react-native';

import { BORDES, CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, TIPOGRAFIA, TONOS, TOQUE_MINIMO, type ColorTono } from '../../theme/tokens';

/**
 * - Un estado (`capturado`, `discrepancia`…): fondo del color del estado, texto blanco.
 * - `marca`: datos que identifican, como el factor de empaque.
 * - `fuerte`: fondo oscuro; lo que debe resaltar sin ser un estado.
 * - `neutro`: fondo gris claro; para lo que no pide ninguna decisión.
 */
export type TonoEtiqueta = ColorTono | 'fuerte' | 'neutro';

/**
 * - solida: fondo del color con texto blanco. Lo que exige atención.
 * - tintada: fondo claro del mismo color con texto oscuro. Una píldora con
 *   presencia que no grita; la forma de mostrar un dato con color.
 * - contorno: solo el borde y el texto en el color. Algo sin confirmar.
 */
export type RellenoEtiqueta = 'solida' | 'tintada' | 'contorno';

/**
 * - normal: acompaña a un texto de cuerpo.
 * - destacada: se lee junto al nombre de un producto.
 * - grande: es lo que distingue un renglón de otro (CANELS c/60 contra c/70).
 */
export type TamanoEtiqueta = 'normal' | 'destacada' | 'grande';

interface Props {
  texto: string;
  tono?: TonoEtiqueta;
  relleno?: RellenoEtiqueta;
  tamano?: TamanoEtiqueta;
  /** Mismo ancho mínimo en todas las filas: las etiquetas quedan alineadas en columna. */
  anchoFijo?: boolean;
  /** Reduce la letra si no cabe, en vez de cortarla. Para textos cortos que no pueden perderse. */
  ajustar?: boolean;
  accessibilityLabel?: string;
}

/** Sólido, fondo tintado y texto sobre ese fondo, por tono. */
const COLORES_TONO: Record<TonoEtiqueta, { solido: string; fondo: string; texto: string }> = {
  ...TONOS,
  fuerte: { solido: COLORES.texto, fondo: COLORES.superficie, texto: COLORES.texto },
  neutro: { solido: COLORES.superficie, fondo: COLORES.superficie, texto: COLORES.texto },
};

export function Etiqueta({
  texto,
  tono = 'neutro',
  relleno = 'solida',
  tamano = 'normal',
  anchoFijo = false,
  ajustar = false,
  accessibilityLabel,
}: Props) {
  const colores = COLORES_TONO[tono];
  let apariencia;
  let colorTexto: string;
  if (relleno === 'contorno') {
    apariencia = [estilos.contorno, { borderColor: tono === 'neutro' ? COLORES.borde : colores.solido }];
    colorTexto = tono === 'neutro' ? COLORES.texto : colores.solido;
  } else if (relleno === 'tintada' || tono === 'neutro') {
    apariencia = { backgroundColor: colores.fondo };
    colorTexto = colores.texto;
  } else {
    apariencia = { backgroundColor: colores.solido };
    colorTexto = COLORES.textoSobreColor;
  }

  return (
    <View
      style={[
        estilos.etiqueta,
        estilos[tamano],
        anchoFijo && (tamano === 'normal' ? estilos.anchoFijo : estilos.anchoFijoGrande),
        apariencia,
      ]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[estilos[`texto_${tamano}`], { color: colorTexto }]} numberOfLines={1} adjustsFontSizeToFit={ajustar}>
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sin alignSelf: va dentro de una fila y toma la alineación de esa fila.
  etiqueta: {
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    // Píldora: se reconoce como dato, no como texto suelto.
    borderRadius: RADIOS.completo,
  },
  normal: {
    paddingVertical: ESPACIADO.xs,
  },
  // Sin relleno vertical: va en el teclado de conteo, donde cada punto de alto
  // es lista que se deja de ver. El interlineado del subtítulo ya le da aire.
  destacada: {
    paddingVertical: 0,
  },
  // Sin relleno vertical: el interlineado ya da aire y la fila no crece. Tampoco
  // más relleno lateral: le quitaría ancho al nombre y lo haría saltar de línea.
  grande: {
    paddingVertical: 0,
    paddingHorizontal: ESPACIADO.sm,
  },
  anchoFijo: {
    minWidth: TOQUE_MINIMO,
  },
  anchoFijoGrande: {
    minWidth: TOQUE_MINIMO + ESPACIADO.xl,
  },
  contorno: {
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
  },
  texto_normal: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
  },
  texto_destacada: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    ...CIFRAS,
  },
  texto_grande: {
    ...TIPOGRAFIA.titulo,
    ...CIFRAS,
  },
});
