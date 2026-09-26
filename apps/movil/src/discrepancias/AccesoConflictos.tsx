import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../api/cargas';
import { useConflictosPendientes } from '../api/hooks-cargas';
import { Chevron, Tarjeta } from '../componentes/base';
import { CIFRAS, COLORES, ETIQUETA_DATO, FUENTE, RITMO, ROTULO, TIPOGRAFIA } from '../theme/tokens';

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
          <Tarjeta
            key={c.id}
            conAcento={{ titulo: 'Resolver diferencias', tono: 'discrepancia' }}
            onPress={() => router.push({ pathname: '/discrepancias/[eventoId]', params: { eventoId: c.id } })}
            accessibilityLabel={`Resolver diferencias de ${ruta}, ${tipo}. ${cuantas} de ${total}.`}
          >
            <View style={estilos.fila}>
              <View style={estilos.cuerpo}>
                <Text style={estilos.tipo}>{tipo}</Text>
                <Text style={estilos.ruta} numberOfLines={2}>
                  {ruta}
                </Text>
              </View>
              {/* Lo que falta domina: es lo que hay que hacer. */}
              <View style={estilos.cifra}>
                <Text style={estilos.numero}>{faltan}</Text>
                <Text style={estilos.unidad}>de {total} por resolver</Text>
              </View>
              <Chevron />
            </View>
          </Tarjeta>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    width: '100%',
    gap: RITMO.relacionado,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  cuerpo: {
    flex: 1,
  },
  ruta: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  // El tipo es el rótulo de la ruta: arriba, pegado, se retira.
  tipo: ETIQUETA_DATO,
  cifra: {
    alignItems: 'flex-end',
  },
  numero: {
    ...TIPOGRAFIA.numero,
    color: COLORES.discrepanciaTexto,
    ...CIFRAS,
  },
  unidad: {
    ...ROTULO,
    color: COLORES.discrepanciaTexto,
  },
});
