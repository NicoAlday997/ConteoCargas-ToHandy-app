import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { usePersonas } from '../api/hooks-personas';
import { Chevron, Tarjeta } from '../componentes/base';
import { useAhora } from '../supervisor/ComponentesSupervisor';
import { COLORES, FUENTE, RITMO, TIPOGRAFIA } from '../theme/tokens';
import {
  detalleAvisoBloqueados,
  normalizarPersonas,
  personasBloqueadas,
  tituloAvisoBloqueados,
} from './modelo-personas';

function abrir() {
  router.push('/personas');
}

/**
 * Aviso del inicio del supervisor: alguien está bloqueado por intentos
 * fallidos de PIN AHORA MISMO. Arriba de todo, porque un vendedor bloqueado a
 * las seis de la mañana frena al camión. Un toque lleva a Personas, donde se
 * quita el bloqueo. Sin nadie bloqueado (o sin saberlo aún) no ocupa lugar.
 */
export function AvisoBloqueados() {
  const consulta = usePersonas(true, true);
  const ahora = useAhora();
  const { refetch } = consulta;

  // Al volver de Personas, el que se desbloqueó ya no está.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const bloqueadas = personasBloqueadas(
    normalizarPersonas(consulta.data ?? null, null),
    ahora,
  );
  if (bloqueadas.length === 0) return null;

  const titulo = tituloAvisoBloqueados(bloqueadas);
  const detalle = detalleAvisoBloqueados(bloqueadas, ahora);
  return (
    <Tarjeta
      conAcento={{ titulo: 'Bloqueo por PIN', tono: 'error' }}
      onPress={abrir}
      accessibilityLabel={`${titulo}. ${detalle}`}
      accessibilityHint="Abre Personas"
    >
      <View style={estilos.fila}>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>{titulo}</Text>
          <Text style={estilos.detalle}>{detalle}</Text>
        </View>
        <Chevron />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  textos: {
    flex: 1,
    gap: RITMO.interno,
  },
  titulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.textoSecundario,
  },
});
