import { StyleSheet, Text, View } from 'react-native';

import { BORDES, CIFRAS, COLORES, ESCALA_TEXTO, ESPACIADO, FUENTE, PLACA, RADIOS, TIPOGRAFIA, TONOS, type ColorTono } from '../../theme/tokens';

/**
 * - Un estado (`capturado`, `discrepancia`…): bloque tintado del estado, texto oscuro del mismo tono.
 * - `fuerte`: fondo oscuro; lo que debe resaltar sin ser un estado.
 * - `neutro`: fondo gris claro; para lo que no pide ninguna decisión.
 * - `referencia`: fondo gris claro y texto secundario; un dato que se consulta
 *   y no es un estado, como el factor de empaque confirmado. Se retira.
 * `marca` / `accion` (azul) no son estados: marcan lo seleccionado o en curso
 * (un producto elegido para la plantilla, un filtro activo).
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
  /**
   * Mismo ancho mínimo en todas las filas: las etiquetas quedan alineadas en
   * columna. Es un mínimo, no un tope: un texto más largo ensancha la pastilla.
   */
  anchoFijo?: boolean;
  accessibilityLabel?: string;
}

/**
 * Ancho mínimo con `anchoFijo`: cuatro caracteres ("C/10", "CAJA") con
 * holgura a tamaño completo, más el relleno lateral. Solo empareja la
 * columna; si un texto no cabe, la pastilla se ensancha.
 */
const EM_CUATRO_CARACTERES = 3.5;
const LETRA_DESTACADA = 17;
const ANCHO_MINIMO: Record<TamanoEtiqueta, number> = {
  normal: Math.ceil(EM_CUATRO_CARACTERES * PLACA.fontSize) + 2 * ESPACIADO.md,
  destacada: Math.ceil(EM_CUATRO_CARACTERES * LETRA_DESTACADA) + 2 * ESPACIADO.md,
  grande: Math.ceil(EM_CUATRO_CARACTERES * TIPOGRAFIA.titulo.fontSize) + 2 * ESPACIADO.md,
};

/** Sólido, fondo tintado y texto sobre ese fondo, por tono. */
const COLORES_TONO: Record<TonoEtiqueta, { solido: string; fondo: string; texto: string }> = {
  ...TONOS,
  fuerte: { solido: COLORES.marca, fondo: COLORES.superficieHonda, texto: COLORES.texto },
  neutro: { solido: COLORES.superficieHonda, fondo: COLORES.superficieHonda, texto: COLORES.texto },
  referencia: { solido: COLORES.superficieHonda, fondo: COLORES.superficieHonda, texto: COLORES.textoSecundario },
};

export function Etiqueta({
  texto,
  tono = 'neutro',
  relleno = 'tintada',
  tamano = 'normal',
  anchoFijo = false,
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
  } else if (tono === 'discrepancia') {
    // El aviso sólido es un letrero preventivo: amarillo con tinta asfalto.
    apariencia = { backgroundColor: COLORES.discrepancia };
    colorTexto = COLORES.texto;
  } else {
    apariencia = { backgroundColor: colores.solido };
    colorTexto = COLORES.textoSobreColor;
  }

  return (
    <View
      style={[
        estilos.etiqueta,
        estilos[tamano],
        anchoFijo ? [estilos.anchoFijo, { minWidth: ANCHO_MINIMO[tamano] }] : estilos.acotada,
        apariencia,
      ]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[estilos[`texto_${tamano}`], { color: colorTexto }]} numberOfLines={1} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sin alignSelf: va dentro de una fila y toma la alineación de esa fila.
  etiqueta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    // Pastilla: la forma de un estado en toda la app. Se reconoce como dato, no como texto suelto.
    borderRadius: RADIOS.completo,
  },
  normal: {
    paddingVertical: ESPACIADO.xs,
  },
  // Sin relleno vertical: va en el teclado de conteo, donde cada punto de alto
  // es lista que se deja de ver. El interlineado del subtítulo ya le da aire.
  destacada: {
    paddingVertical: 0,
    borderRadius: RADIOS.chico,
  },
  // Sin relleno vertical: el interlineado ya da aire y la fila no crece. Tampoco
  // más relleno lateral: le quitaría ancho al nombre y lo haría saltar de línea.
  grande: {
    paddingVertical: 0,
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.control,
  },
  // Sin ancho fijo, la pastilla no pasa del ancho de su fila.
  acotada: {
    maxWidth: '100%',
  },
  // Con ancho fijo no hay tope: el nombre al lado no la comprime y, si el texto
  // no cabe en el mínimo, crece la pastilla, nunca se encoge la letra.
  anchoFijo: {
    flexShrink: 0,
  },
  contorno: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
  },
  // La leyenda de una pastilla: negrita compacta, se lee de reojo.
  texto_normal: {
    ...PLACA,
    ...CIFRAS,
  },
  texto_destacada: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    fontSize: LETRA_DESTACADA,
    ...CIFRAS,
  },
  texto_grande: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.extraNegrita,
    ...CIFRAS,
  },
});
