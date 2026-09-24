import { StyleSheet, Text, View } from 'react-native';

import { COLORES, ESPACIADO, PESOS, TIPOGRAFIA } from '../../theme/tokens';

/** Quién hizo qué: "Contó" + "Irvin Alday". */
export interface Persona {
  /** El rol o la acción ("Contó", "Verificó", "Capturó"): se retira. */
  rol: string;
  /** El nombre: es el dato, domina. */
  nombre: string;
}

interface Props {
  personas: readonly Persona[];
  /** Sobre un fondo de color (una tarjeta presionada): todo en blanco. */
  invertido?: boolean;
}

/**
 * Personas de una carga, con jerarquía: el rol como rótulo pequeño en
 * mayúsculas y color secundario; el nombre grande, fuerte, en el color de
 * texto principal. "CONTÓ Irvin Alday   VERIFICÓ Bodeguero Prueba" se lee
 * como dos datos, no como una frase donde todo pesa igual.
 */
export function Personas({ personas, invertido = false }: Props) {
  if (personas.length === 0) return null;
  return (
    <View style={estilos.grupo}>
      {personas.map(({ rol, nombre }) => (
        <View key={`${rol}-${nombre}`} style={estilos.persona} accessible accessibilityLabel={`${rol} ${nombre}`}>
          <Text style={[estilos.rol, invertido && estilos.invertido]}>{rol}</Text>
          <Text style={[estilos.nombre, invertido && estilos.invertido]} numberOfLines={1}>
            {nombre}
          </Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Lado a lado mientras quepan; si no, uno bajo otro.
  grupo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: ESPACIADO.lg,
    rowGap: ESPACIADO.xs,
  },
  persona: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ESPACIADO.xs,
    flexShrink: 1,
  },
  rol: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.medio,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nombre: {
    flexShrink: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  invertido: {
    color: COLORES.textoSobreColor,
  },
});
