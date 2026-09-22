import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';

/** Por encima del mínimo de 56: el PIN se teclea de pie y con prisa. */
const ALTO_TECLA = TOQUE_MINIMO + ESPACIADO.lg;

const FILAS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface Props {
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  deshabilitado?: boolean;
}

/**
 * Teclado numérico propio: nunca el teclado del sistema, que cambia de
 * tamaño y distribución según el dispositivo.
 */
export function TecladoPin({ onDigito, onBorrar, deshabilitado = false }: Props) {
  return (
    <View style={estilos.teclado}>
      {FILAS.map((fila) => (
        <View key={fila.join('')} style={estilos.fila}>
          {fila.map((digito) => (
            <Tecla key={digito} etiqueta={digito} onPress={() => onDigito(digito)} deshabilitado={deshabilitado} />
          ))}
        </View>
      ))}
      <View style={estilos.fila}>
        <View style={estilos.huecoVacio} />
        <Tecla etiqueta="0" onPress={() => onDigito('0')} deshabilitado={deshabilitado} />
        <Tecla
          etiqueta="Borrar"
          onPress={onBorrar}
          deshabilitado={deshabilitado}
          secundaria
          etiquetaAccesible="Borrar último dígito"
        />
      </View>
    </View>
  );
}

interface PropsTecla {
  etiqueta: string;
  onPress: () => void;
  deshabilitado: boolean;
  secundaria?: boolean;
  etiquetaAccesible?: string;
}

function Tecla({ etiqueta, onPress, deshabilitado, secundaria = false, etiquetaAccesible }: PropsTecla) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.tecla,
        pressed && estilos.teclaPresionada,
        deshabilitado && estilos.teclaDeshabilitada,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            secundaria ? estilos.textoSecundario : estilos.textoDigito,
            pressed && estilos.textoPresionado,
          ]}
        >
          {etiqueta}
        </Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  teclado: {
    gap: ESPACIADO.md,
  },
  fila: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
  },
  tecla: {
    flex: 1,
    minHeight: ALTO_TECLA,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  teclaPresionada: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  teclaDeshabilitada: {
    opacity: 0.4,
  },
  huecoVacio: {
    flex: 1,
  },
  textoDigito: {
    fontSize: TIPOGRAFIA.tamanos.xxxl,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoSecundario: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoPresionado: {
    color: COLORES.textoSobreColor,
  },
});
