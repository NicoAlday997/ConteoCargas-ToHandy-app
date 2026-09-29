import { StyleSheet, Text, View } from 'react-native';

import { Glifo } from './base/Icono';
import { Pulsable } from './base/Pulsable';

import {
  BORDES,
  CIFRAS,
  COLORES,
  ESCALA_PRESIONADO_CONTROL,
  ESCALA_TEXTO,
  ESPACIADO,
  OPACIDAD,
  ONDA,
  RADIOS,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../theme/tokens';

/** Diámetro máximo de una tecla: en tablet no crece más, el pulgar no lo necesita. */
const LADO_MAXIMO_TECLA = 78;

const FILAS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface Props {
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  deshabilitado?: boolean;
  /** Sobre el héroe azul noche (la entrada): teclas translúcidas con dígitos blancos. */
  oscuro?: boolean;
}

/**
 * Teclado numérico propio (nunca el del sistema, que cambia de tamaño y
 * distribución según el dispositivo). Teclas circulares: la misma geometría
 * que los círculos del PIN, y un blanco grande y centrado para el pulgar. Se
 * hunden con un resorte y se encienden al presionar.
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
        <View style={estilos.hueco} />
        <Tecla etiqueta="0" onPress={() => onDigito('0')} deshabilitado={deshabilitado} oscuro={oscuro} />
        <Tecla
          etiqueta="Borrar"
          onPress={onBorrar}
          deshabilitado={deshabilitado}
          oscuro={oscuro}
          borrar
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
  /** La tecla de borrar: sin fondo, con su ícono. */
  borrar?: boolean;
  etiquetaAccesible?: string;
  oscuro: boolean;
}

function Tecla({ etiqueta, onPress, deshabilitado, borrar = false, etiquetaAccesible, oscuro }: PropsTecla) {
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitado}
      tacto="tecla"
      repetible
      escala={ESCALA_PRESIONADO_CONTROL - 0.04}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      onda={oscuro ? ONDA.sobreColor : ONDA.sobreClaro}
      style={({ pressed }) => [
        estilos.tecla,
        borrar ? estilos.teclaBorrar : oscuro ? estilos.teclaOscura : estilos.teclaClara,
        pressed && (oscuro ? estilos.teclaPresionadaOscura : estilos.teclaPresionada),
        deshabilitado && estilos.teclaDeshabilitada,
      ]}
    >
      {({ pressed }) => {
        const color = pressed && !borrar ? (oscuro ? COLORES.marca : COLORES.textoSobreColor) : oscuro ? COLORES.textoSobreColor : COLORES.texto;
        return borrar ? (
          <Glifo nombre="borrar" color={pressed ? (oscuro ? COLORES.marca : COLORES.textoSobreColor) : color} tamano={ESPACIADO.xl + ESPACIADO.xs} />
        ) : (
          <Text style={[estilos.textoDigito, { color }]} maxFontSizeMultiplier={ESCALA_TEXTO.control}>
            {etiqueta}
          </Text>
        );
      }}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  teclado: {
    gap: ESPACIADO.md + 2,
    width: '100%',
    maxWidth: LADO_MAXIMO_TECLA * 3 + ESPACIADO.xl * 2 + ESPACIADO.lg,
    alignSelf: 'center',
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ESPACIADO.xl,
  },
  // Círculo: base 0 y lado máximo, así las tres miden igual en cualquier ancho.
  tecla: {
    flex: 1,
    flexBasis: 0,
    maxWidth: LADO_MAXIMO_TECLA,
    minHeight: TOQUE_MINIMO,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  // Sobre el héroe: vidrio tenue sin desenfoque, con un filo de luz.
  teclaOscura: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: BORDES.fino,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  // Sobre claro: pieza blanca con contorno y sombra corta.
  teclaClara: {
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
    boxShadow: SOMBRAS.tecla,
  },
  teclaBorrar: {
    backgroundColor: 'transparent',
  },
  // Se enciende al presionar: blanco sobre azul noche, azul señal sobre claro.
  teclaPresionadaOscura: {
    backgroundColor: COLORES.superficie,
    borderColor: COLORES.superficie,
  },
  teclaPresionada: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
  },
  teclaDeshabilitada: {
    opacity: OPACIDAD.deshabilitado,
  },
  hueco: {
    flex: 1,
    flexBasis: 0,
    maxWidth: LADO_MAXIMO_TECLA,
  },
  textoDigito: {
    ...TIPOGRAFIA.tecla,
    fontSize: 28,
    lineHeight: 34,
    ...CIFRAS,
  },
});
