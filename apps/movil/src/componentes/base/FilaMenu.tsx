import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { COLORES, ELEVACION, ESCALA_PRESIONADO, ESPACIADO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO, type Tarea } from '../../theme/tokens';
import { Chevron, IconoTarea } from './Icono';
import { Pulsable } from './Pulsable';

/**
 * Opciones de navegación agrupadas en un solo bloque blanco que flota, sin
 * líneas entre ellas: cada renglón ya mide un toque y el círculo de su ícono
 * lo separa. Al presionar, el renglón se enciende como una pastilla interior.
 */
export function GrupoMenu({ children }: { children: ReactNode }) {
  return <View style={estilos.grupo}>{children}</View>;
}

interface Props {
  texto: string;
  /** Lo que hay detrás, en una línea que se retira. */
  detalle?: string;
  /**
   * La tarea a la que lleva: pone a la izquierda su ícono en un círculo azul
   * suave. El ícono ubica la tarea; el color de estado queda para los estados.
   */
  tarea?: Tarea;
  onPress: () => void;
  /** Salir, cerrar sesión: sin flecha, porque no lleva a otra pantalla. */
  salida?: boolean;
  cargando?: boolean;
  accessibilityHint?: string;
}

export function FilaMenu({ texto, detalle, tarea, onPress, salida = false, cargando = false, accessibilityHint }: Props) {
  return (
    <Pulsable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: cargando }}
      escala={ESCALA_PRESIONADO}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
    >
      {({ pressed }) => (
        <>
          {tarea && <IconoTarea tarea={tarea} invertido={pressed} />}
          <View style={estilos.textos}>
            <Text style={[estilos.texto, salida && estilos.textoSalida]}>{cargando ? 'Un momento…' : texto}</Text>
            {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
          </View>
          {!salida && (
            <View style={[estilos.circuloChevron, pressed && estilos.circuloChevronPresionado]}>
              <Chevron color={pressed ? COLORES.textoSobreColor : COLORES.textoTerciario} tamano={ESPACIADO.lg + ESPACIADO.xs} />
            </View>
          )}
        </>
      )}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    ...ELEVACION[1],
    borderRadius: RADIOS.grande,
    padding: ESPACIADO.sm - 2,
  },
  fila: {
    minHeight: TOQUE_MINIMO + ESPACIADO.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    borderRadius: RADIOS.control,
  },
  // Pastilla interior azul: el toque se nota aun con poca luz.
  presionada: {
    backgroundColor: COLORES.marcaTinte,
  },
  circuloChevron: {
    width: ESPACIADO.xxl,
    height: ESPACIADO.xxl,
    borderRadius: RADIOS.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloChevronPresionado: {
    backgroundColor: COLORES.accion,
  },
  textos: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  texto: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 17,
    lineHeight: 22,
    color: COLORES.texto,
  },
  textoSalida: {
    color: COLORES.error,
  },
  detalle: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.medio,
    color: COLORES.textoSecundario,
  },
});
