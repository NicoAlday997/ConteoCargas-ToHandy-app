import { StyleSheet, Text, View } from 'react-native';

import { Pulsable } from './base/Pulsable';

import { BORDES, CIFRAS, COLORES, ESCALA_TEXTO, ESPACIADO, OPACIDAD, FUENTE, ONDA, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';

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
  /** Sobre asfalto (la entrada): teclas en relieve tonal con dígitos blancos. */
  oscuro?: boolean;
}

/**
 * Teclado numérico propio: nunca el teclado del sistema, que cambia de
 * tamaño y distribución según el dispositivo.
 */
export function TecladoPin({ onDigito, onBorrar, deshabilitado = false, oscuro = false }: Props) {
  return (
    <View style={estilos.teclado}>
      {FILAS.map((fila) => (
        <View key={fila.join('')} style={estilos.fila}>
          {fila.map((digito) => (
            <Tecla key={digito} etiqueta={digito} onPress={() => onDigito(digito)} deshabilitado={deshabilitado} oscuro={oscuro} />
          ))}
        </View>
      ))}
      <View style={estilos.fila}>
        <View style={estilos.huecoVacio} />
        <Tecla etiqueta="0" onPress={() => onDigito('0')} deshabilitado={deshabilitado} oscuro={oscuro} />
        <Tecla
          etiqueta="Borrar"
          onPress={onBorrar}
          deshabilitado={deshabilitado}
          oscuro={oscuro}
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
  oscuro: boolean;
}

function Tecla({ etiqueta, onPress, deshabilitado, secundaria = false, etiquetaAccesible, oscuro }: PropsTecla) {
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitado}
      tacto="tecla"
      repetible
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      onda={oscuro ? ONDA.sobreColor : ONDA.sobreClaro}
      style={({ pressed }) => [
        estilos.tecla,
        oscuro && estilos.teclaOscura,
        pressed && (oscuro ? estilos.teclaPresionadaOscura : estilos.teclaPresionada),
        deshabilitado && estilos.teclaDeshabilitada,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            secundaria ? estilos.textoSecundario : estilos.textoDigito,
            oscuro && estilos.textoOscuro,
            pressed && (oscuro ? estilos.textoPresionadoOscuro : estilos.textoPresionado),
          ]}
          maxFontSizeMultiplier={ESCALA_TEXTO.control}
        >
          {etiqueta}
        </Text>
      )}
    </Pulsable>
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
  // Base 0: todas miden lo mismo aunque "Borrar" sea más ancho que un dígito.
  tecla: {
    flex: 1,
    flexBasis: 0,
    minHeight: ALTO_TECLA,
    alignItems: 'center',
    justifyContent: 'center',
    // Blanca: resalta sobre el fondo tintado de la pantalla, como una tarjeta.
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.bordeSinContar,
    borderRadius: RADIOS.medio,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  teclaPresionada: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  // Sobre asfalto: relieve tonal, y al presionar se enciende en blanco.
  teclaOscura: {
    backgroundColor: COLORES.marcaHonda,
    borderWidth: BORDES.fino,
    borderColor: COLORES.marcaClara,
  },
  teclaPresionadaOscura: {
    backgroundColor: COLORES.superficie,
    borderColor: COLORES.superficie,
  },
  teclaDeshabilitada: {
    opacity: OPACIDAD.deshabilitado,
  },
  // Con el mismo contorno (invisible) que una tecla: si no, las teclas de su fila se corren.
  huecoVacio: {
    flex: 1,
    flexBasis: 0,
    borderWidth: BORDES.medio,
    borderColor: 'transparent',
  },
  textoDigito: {
    ...TIPOGRAFIA.display,
    fontFamily: FUENTE.titular,
    color: COLORES.texto,
    ...CIFRAS,
  },
  textoSecundario: {
    fontFamily: FUENTE.titular,
    fontSize: 19,
    lineHeight: 23,
    color: COLORES.texto,
  },
  textoPresionado: {
    color: COLORES.textoSobreColor,
  },
  textoOscuro: {
    color: COLORES.textoSobreColor,
  },
  textoPresionadoOscuro: {
    color: COLORES.texto,
  },
});
