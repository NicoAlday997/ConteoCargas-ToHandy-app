import { StyleSheet, Text, View } from 'react-native';

import { BORDES, CIFRAS, COLORES, ESPACIADO, PESOS, TIPOGRAFIA, type ColorEstado } from '../../theme/tokens';

interface Props {
  /** Qué es: rótulo pequeño en mayúsculas, se retira, a la izquierda. */
  etiqueta: string;
  /** El dato: domina, a la derecha. */
  valor: string;
  /** Aclaración bajo el valor, p. ej. "(18 piezas)". */
  detalle?: string | null;
  /** Colorea etiqueta y valor: el renglón comunica un estado (la diferencia, un error). */
  tono?: ColorEstado;
  /** El valor al tamaño de un título: el dato que se busca en la tarjeta. */
  principal?: boolean;
  /** Etiqueta arriba y valor abajo, a todo el ancho: para textos largos (un motivo). */
  apilado?: boolean;
  /** Línea arriba: cierra una tabla (p. ej. el total bajo los sumandos). */
  separado?: boolean;
  accessibilityLabel?: string;
}

/** Etiqueta a la izquierda, valor a la derecha: el patrón que más se repite. */
export function FilaDato({
  etiqueta,
  valor,
  detalle,
  tono,
  principal = false,
  apilado = false,
  separado = false,
  accessibilityLabel,
}: Props) {
  const color = tono ? { color: COLORES[tono] } : null;

  return (
    <View
      style={[apilado ? estilos.apilado : estilos.fila, separado && estilos.separado]}
      accessible
      accessibilityLabel={accessibilityLabel ?? [`${etiqueta}: ${valor}`, detalle].filter(Boolean).join(', ')}
    >
      <Text style={[estilos.etiqueta, apilado && estilos.etiquetaApilada, color]} numberOfLines={apilado ? undefined : 2}>
        {etiqueta}
      </Text>
      <View style={apilado ? null : estilos.columnaValor}>
        <Text style={[principal ? estilos.valorPrincipal : estilos.valor, !apilado && estilos.alDerecha, color]}>{valor}</Text>
        {detalle && <Text style={[estilos.detalle, !apilado && estilos.alDerecha]}>{detalle}</Text>}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs,
  },
  apilado: {
    gap: ESPACIADO.xs,
    paddingVertical: ESPACIADO.xs,
  },
  // La única línea de una tabla: cierra los sumandos antes del total.
  separado: {
    marginTop: ESPACIADO.xs,
    paddingTop: ESPACIADO.sm,
    borderTopWidth: BORDES.fino,
    borderTopColor: COLORES.divisor,
  },
  // El rótulo se retira y el dato domina: nunca el mismo estilo para los dos,
  // o "Contó Irvin Alday" se lee como una frase donde todo pesa igual.
  etiqueta: {
    flex: 1,
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.medio,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etiquetaApilada: {
    flex: 0,
  },
  columnaValor: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  valor: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
    ...CIFRAS,
  },
  valorPrincipal: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
    ...CIFRAS,
  },
  alDerecha: {
    textAlign: 'right',
  },
  detalle: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
});
