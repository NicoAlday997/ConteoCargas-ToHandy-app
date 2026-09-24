import { StyleSheet, Text, View } from 'react-native';

import { CIFRAS, COLORES, DATO, DATO_AUSENTE, RITMO, ROTULO } from '../../theme/tokens';

/** Un dato con su rótulo: "RUTA" + "Norte 3", "PRODUCTOS" + "42". */
export interface Dato {
  /** Qué es: el rótulo, se retira. */
  rotulo: string;
  /** El dato: domina. `null` = todavía no existe. */
  valor: string | null;
  /** Qué decir cuando falta. */
  ausente?: string;
  /** Es una cifra: dígitos del mismo ancho. */
  cifra?: boolean;
}

/** Quién hizo qué: "Contó" + "Irvin Alday". */
export interface Persona {
  /** El rol o la acción ("Contó", "Verificó", "Capturó"): es el rótulo, se retira. */
  rol: string;
  /** El nombre: es el dato, domina. `null` = todavía nadie ("Pendiente"). */
  nombre: string | null;
}

interface PropsDatos {
  datos: readonly Dato[];
  /** Sobre un fondo de color (una tarjeta presionada): todo en blanco. */
  invertido?: boolean;
}

/**
 * Bloques de rótulo y dato: el rótulo ARRIBA, en micro y mayúsculas; el dato
 * DEBAJO, tres niveles más grande y fuerte. Apilados, y no en la misma línea,
 * para que "CONTÓ Irvin Alday" no se lea como una frase donde todo pesa igual.
 * Sin dato, el texto de ausencia va sin peso: se ve que falta, no parece un nombre.
 */
export function Datos({ datos, invertido = false }: PropsDatos) {
  if (datos.length === 0) return null;
  return (
    <View style={estilos.grupo}>
      {datos.map(({ rotulo, valor, ausente = 'Pendiente', cifra = false }) => (
        <View
          key={rotulo}
          style={estilos.dato}
          accessible
          accessibilityLabel={`${rotulo}: ${valor ?? ausente.toLowerCase()}`}
        >
          <Text style={[estilos.rotulo, invertido && estilos.invertido]} numberOfLines={1}>
            {rotulo}
          </Text>
          <Text
            style={[valor === null ? estilos.ausente : estilos.valor, cifra && CIFRAS, invertido && estilos.invertido]}
            numberOfLines={1}
          >
            {valor ?? ausente}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Personas de una carga ("Contó", "Verificó"), con la misma jerarquía que cualquier dato. */
export function Personas({ personas, invertido = false }: { personas: readonly Persona[]; invertido?: boolean }) {
  return <Datos datos={personas.map(({ rol, nombre }) => ({ rotulo: rol, valor: nombre }))} invertido={invertido} />;
}

const estilos = StyleSheet.create({
  // Lado a lado mientras quepan, con aire de grupo entre uno y otro; si no
  // caben, uno bajo otro.
  grupo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: RITMO.grupo,
    rowGap: RITMO.relacionado,
  },
  // Sin hueco entre rótulo y dato: van pegados, son un solo bloque.
  dato: {
    flexShrink: 1,
  },
  rotulo: ROTULO,
  valor: DATO,
  ausente: DATO_AUSENTE,
  invertido: {
    color: COLORES.textoSobreColor,
  },
});
