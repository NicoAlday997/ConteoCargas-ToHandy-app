import { StyleSheet, Text, View } from 'react-native';

import { CIFRAS, COLORES, DATO, DATO_AUSENTE, ESPACIADO, PESOS, ROTULO, TIPOGRAFIA, type ColorEstado } from '../../theme/tokens';

interface Props {
  /** Qué es: rótulo pequeño en mayúsculas, se retira, a la izquierda. */
  etiqueta: string;
  /** El dato: domina, a la derecha. `null` = todavía no existe (se muestra `ausente`, sin peso). */
  valor: string | null;
  /** Qué decir cuando falta el dato. */
  ausente?: string;
  /** Aclaración bajo el valor, p. ej. "(18 piezas)". */
  detalle?: string | null;
  /** Colorea etiqueta y valor: el renglón comunica un estado (la diferencia, un error). */
  tono?: ColorEstado;
  /** El valor al tamaño de un título: el dato que se busca en la tarjeta. */
  principal?: boolean;
  /** Etiqueta arriba y valor abajo, a todo el ancho: para textos largos (un motivo). */
  apilado?: boolean;
  /** Aire arriba: empieza otro grupo (p. ej. el resultado bajo los sumandos). Espacio, nunca una línea. */
  separado?: boolean;
  accessibilityLabel?: string;
}

/** Etiqueta a la izquierda, valor a la derecha: el patrón que más se repite. */
export function FilaDato({
  etiqueta,
  valor,
  ausente = 'Pendiente',
  detalle,
  tono,
  principal = false,
  apilado = false,
  separado = false,
  accessibilityLabel,
}: Props) {
  const color = tono ? { color: COLORES[tono] } : null;
  const texto = valor ?? ausente;
  const estiloValor = valor === null ? estilos.valorAusente : principal ? estilos.valorPrincipal : estilos.valor;

  return (
    <View
      style={[apilado ? estilos.apilado : estilos.fila, separado && estilos.separado]}
      accessible
      accessibilityLabel={accessibilityLabel ?? [`${etiqueta}: ${texto}`, detalle].filter(Boolean).join(', ')}
    >
      <Text style={[estilos.etiqueta, apilado && estilos.etiquetaApilada, color]} numberOfLines={apilado ? undefined : 2}>
        {etiqueta}
      </Text>
      <View style={apilado ? null : estilos.columnaValor}>
        <Text style={[estiloValor, !apilado && estilos.alDerecha, valor !== null && color]}>{texto}</Text>
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
  // Rótulo pegado a su dato: son un solo bloque.
  apilado: {
    paddingVertical: ESPACIADO.xs,
  },
  // Otro grupo: lo separa el aire, no un divisor.
  separado: {
    marginTop: ESPACIADO.md,
  },
  // El rótulo se retira y el dato domina: nunca el mismo estilo para los dos,
  // o "Contó Irvin Alday" se lee como una frase donde todo pesa igual.
  etiqueta: {
    flex: 1,
    ...ROTULO,
  },
  etiquetaApilada: {
    flex: 0,
  },
  columnaValor: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  valor: {
    ...DATO,
    ...CIFRAS,
  },
  valorAusente: DATO_AUSENTE,
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
