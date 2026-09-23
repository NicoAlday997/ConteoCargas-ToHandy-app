import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../api/cargas';
import { useConflictosPendientes } from '../api/hooks-cargas';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';

const ANCHO_BARRA_ESTADO = 6;

/**
 * Acceso directo a las cargas con diferencias por resolver donde el usuario
 * contó. Va antes que cualquier otra acción: mientras no se resuelvan, la carga
 * no avanza a autorización ni a Handy. Si no hay ninguna, no ocupa lugar.
 */
export function AccesoConflictos() {
  const consulta = useConflictosPendientes(true);
  const cargas = (consulta.data ?? []).filter((c): c is typeof c & { id: string } => typeof c.id === 'string' && c.id.length > 0);

  if (cargas.length === 0) return null;

  return (
    <View style={estilos.contenedor}>
      {cargas.map((c) => {
        const total = c.totalDiscrepancias ?? 0;
        const faltan = Math.max(0, total - (c.resueltas ?? 0));
        const tipo = c.tipo ? ETIQUETAS_TIPO_CARGA[c.tipo] : 'Carga';
        const ruta = c.rutaNombre?.trim() || 'Ruta sin nombre';
        const cuantas = faltan === 1 ? 'Falta 1 diferencia' : `Faltan ${faltan} diferencias`;
        return (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: '/discrepancias/[eventoId]', params: { eventoId: c.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Resolver diferencias de ${ruta}, ${tipo}. ${cuantas} de ${total}.`}
            style={({ pressed }) => [estilos.fila, pressed && estilos.filaPresionada]}
          >
            {({ pressed }) => (
              <>
                <View style={estilos.barraEstado} />
                <View style={estilos.cuerpo}>
                  <Text style={[estilos.titulo, pressed && estilos.textoInvertido]}>Resolver diferencias</Text>
                  <Text style={[estilos.detalle, pressed && estilos.textoInvertido]} numberOfLines={1}>
                    {ruta} · {tipo}
                  </Text>
                  <Text style={[estilos.cuantas, pressed && estilos.textoInvertido]}>
                    {cuantas} de {total}
                  </Text>
                </View>
                <Text style={[estilos.flecha, pressed && estilos.textoInvertido]}>›</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    width: '100%',
    gap: ESPACIADO.sm,
  },
  fila: {
    minHeight: TOQUE_MINIMO + ESPACIADO.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    paddingRight: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
    borderRadius: RADIOS.md,
    overflow: 'hidden',
  },
  filaPresionada: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  barraEstado: {
    alignSelf: 'stretch',
    width: ANCHO_BARRA_ESTADO,
    backgroundColor: COLORES.discrepancia,
  },
  cuerpo: {
    flex: 1,
    paddingVertical: ESPACIADO.md,
    gap: 2,
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  detalle: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  cuantas: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.discrepancia,
  },
  flecha: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});
