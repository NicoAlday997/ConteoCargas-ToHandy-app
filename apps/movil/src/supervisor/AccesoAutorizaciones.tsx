import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useColaAutorizacion, usePorEnviar } from '../api/hooks-supervisor';
import { Chevron, FilaMenu, GrupoMenu, Tarjeta } from '../componentes/base';
import { CIFRAS, COLORES, FUENTE, RITMO, ROTULO, TIPOGRAFIA, TONOS } from '../theme/tokens';
import { espera, TONO_ESPERA, useAhora } from './ComponentesSupervisor';

function abrir() {
  router.push('/supervisor');
}

function textoSinEnviar(n: number): string | null {
  if (n === 0) return null;
  return n === 1 ? '1 autorizada sin enviar a Handy' : `${n} autorizadas sin enviar a Handy`;
}

/**
 * Acceso del supervisor a su cola de autorización, primero en el inicio: una
 * carga esperando frena al camión. Con cargas esperando es una tarjeta con la
 * cifra al frente y el color de la que más lleva esperando. Sin ninguna (o sin
 * saberlo aún) es una fila de menú más, que no pide nada.
 */
export function AccesoAutorizaciones() {
  const cola = useColaAutorizacion(true);
  const porEnviar = usePorEnviar(true);
  const ahora = useAhora();
  const { refetch: releerCola } = cola;
  const { refetch: releerPorEnviar } = porEnviar;

  // Al volver de la cola, la cifra ya cambió.
  useFocusEffect(
    useCallback(() => {
      void releerCola();
      void releerPorEnviar();
    }, [releerCola, releerPorEnviar]),
  );

  const cargas = cola.data ?? null;
  const sinEnviar = textoSinEnviar(porEnviar.data?.length ?? 0);

  if (cargas === null || cargas.length === 0) {
    return (
      <GrupoMenu>
        <FilaMenu
          texto="Autorizar cargas"
          detalle={sinEnviar ?? (cargas ? 'Ninguna carga espera tu autorización' : undefined)}
          onPress={abrir}
        />
      </GrupoMenu>
    );
  }

  // La cola viene ordenada: la primera es la que más lleva esperando.
  const masAntigua = espera(cargas[0]?.esperaDesde ?? null, ahora);
  const tono = TONO_ESPERA[masAntigua.nivel];
  const colorCifra = TONOS[tono].texto;
  const n = cargas.length;

  return (
    <Tarjeta
      conAcento={{ titulo: 'Cargas por autorizar', tono }}
      onPress={abrir}
      accessibilityLabel={[
        `${n === 1 ? '1 carga espera' : `${n} cargas esperan`} tu autorización`,
        `La que más lleva: ${masAntigua.titulo.toLowerCase()}`,
        sinEnviar,
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={estilos.fila}>
        <View style={estilos.textos}>
          <Text style={estilos.explicacion}>Ninguna llega a Handy sin tu visto bueno.</Text>
          <Text style={[estilos.espera, { color: colorCifra }]}>La que más lleva: {masAntigua.titulo.toLowerCase()}</Text>
          {sinEnviar && <Text style={estilos.detalle}>{sinEnviar}</Text>}
        </View>
        {/* Lo que falta domina: es lo que hay que hacer. */}
        <View style={estilos.cifra}>
          <Text style={[estilos.numero, { color: colorCifra }]}>{n}</Text>
          <Text style={[estilos.unidad, { color: colorCifra }]}>{n === 1 ? 'espera' : 'esperan'}</Text>
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
  explicacion: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  espera: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    ...CIFRAS,
  },
  detalle: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
  },
  cifra: {
    alignItems: 'flex-end',
  },
  numero: {
    ...TIPOGRAFIA.numero,
    ...CIFRAS,
  },
  unidad: ROTULO,
});
