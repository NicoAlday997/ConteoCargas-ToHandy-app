import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useFactoresPendientes } from '../api/hooks-factores';
import { Chevron, FilaMenu, GrupoMenu, Tarjeta } from '../componentes/base';
import { CIFRAS, COLORES, FUENTE, RITMO, ROTULO, TIPOGRAFIA } from '../theme/tokens';
import { contarPendientes, textoProductos } from './modelo-factores';

function abrir() {
  router.push('/factores');
}

/**
 * Acceso del supervisor a la confirmación de empaques. Con pendientes es una
 * tarjeta de atención con la cifra al frente: esos productos no se pueden
 * contar en paquetes hasta confirmarlos. Sin pendientes (o sin saberlo aún) es
 * una fila de menú más, que no pide nada.
 */
export function AccesoFactores() {
  const consulta = useFactoresPendientes(true);
  const { refetch } = consulta;

  // Al volver de la pantalla de empaques, la cifra ya cambió.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const pendientes = consulta.data ? contarPendientes(consulta.data) : null;

  if (pendientes === null || pendientes === 0) {
    return (
      <GrupoMenu>
        <FilaMenu
          texto="Empaque de productos"
          detalle={pendientes === 0 ? 'Todos los productos tienen su empaque confirmado' : undefined}
          onPress={abrir}
        />
      </GrupoMenu>
    );
  }

  return (
    <Tarjeta
      conAcento={{ titulo: 'Empaques por confirmar', tono: 'discrepancia' }}
      onPress={abrir}
      accessibilityLabel={`Empaques por confirmar: ${textoProductos(pendientes)}. No se pueden contar en paquetes hasta confirmarlos.`}
    >
      <View style={estilos.fila}>
        <Text style={estilos.explicacion}>No se pueden contar en paquetes hasta que confirmes cómo se venden.</Text>
        {/* Lo que falta domina: es lo que hay que hacer. */}
        <View style={estilos.cifra}>
          <Text style={estilos.numero}>{pendientes}</Text>
          <Text style={estilos.unidad}>{pendientes === 1 ? 'producto' : 'productos'}</Text>
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
  explicacion: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
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
