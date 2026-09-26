import { StyleSheet, Text, View } from 'react-native';

import { BORDES, CIFRAS, COLORES, ESPACIADO, FUENTE, RADIOS, TIPOGRAFIA, TONOS, TOQUE_MINIMO, type ColorTono } from '../../theme/tokens';

/**
 * - Un estado (`capturado`, `discrepancia`…): bloque tintado del estado, texto oscuro del mismo tono.
 * - `fuerte`: fondo oscuro; lo que debe resaltar sin ser un estado.
 * - `neutro`: fondo gris claro; para lo que no pide ninguna decisión.
 * - `referencia`: fondo gris claro y texto secundario; un dato que se consulta
 *   y no es un estado, como el factor de empaque confirmado. Se retira.
 * `marca` no es para etiquetas: el azul es para la acción principal y lo que
 * se edita (ver la regla del azul en tokens.ts).
 */
export type TonoEtiqueta = ColorTono | 'fuerte' | 'neutro' | 'referencia';

/**
 * - tintada (por omisión): fondo claro del color con texto oscuro del mismo
 *   tono y peso fuerte. Así se muestra un ESTADO: se lee de reojo sin gritar.
 * - solida: fondo del color con texto blanco. Solo lo que exige actuar ya.
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
  fuerte: { solido: COLORES.texto, fondo: COLORES.superficieHonda, texto: COLORES.texto },
  neutro: { solido: COLORES.superficieHonda, fondo: COLORES.superficieHonda, texto: COLORES.texto },
  referencia: { solido: COLORES.superficieHonda, fondo: COLORES.superficieHonda, texto: COLORES.textoSecundario },
};

export function Etiqueta({
  texto,
  tono = 'neutro',
  relleno = 'tintada',
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
  } else if (relleno === 'tintada' || tono === 'neutro' || tono === 'referencia') {
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
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
  },
  texto_normal: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
  },
  texto_destacada: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    ...CIFRAS,
  },
  texto_grande: {
    ...TIPOGRAFIA.titulo,
    ...CIFRAS,
  },
});
