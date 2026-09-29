import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ANCHO_MAXIMO_LISTA, BARRA_INFERIOR, COLORES, ESCALA_TEXTO, ESPACIADO, RITMO, TIPOGRAFIA } from '../../theme/tokens';

/**
 * La acción de la pantalla, fija abajo: donde llega el pulgar con el teléfono
 * en una mano y la otra ocupada. Sobre ella, en una línea, por qué todavía no
 * se puede (si no se puede). Una pieza blanca de esquinas altas redondeadas
 * con sombra que sube: flota sobre la lista que pasa por debajo.
 */
export function BarraAccion({
  children,
  nota,
  sinAreaSegura = false,
}: {
  children: ReactNode;
  /** Por qué la acción aún no procede, o qué va a pasar. Una línea. */
  nota?: string | null;
  /** Cuando algo debajo (un teclado propio) ya ocupa el área segura. */
  sinAreaSegura?: boolean;
}) {
  const margenes = useSafeAreaInsets();
  return (
    <View style={[estilos.barra, { paddingBottom: (sinAreaSegura ? 0 : margenes.bottom) + ESPACIADO.md }]}>
      <View style={estilos.columna}>
        {nota ? (
          <Text style={estilos.nota} numberOfLines={2} maxFontSizeMultiplier={ESCALA_TEXTO.compacto} accessibilityLiveRegion="polite">
            {nota}
          </Text>
        ) : null}
        <View style={estilos.acciones}>{children}</View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: BARRA_INFERIOR,
  // En tablet, la barra va a todo el ancho pero el botón no: la misma columna que la lista.
  columna: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.sm,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  acciones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
});
