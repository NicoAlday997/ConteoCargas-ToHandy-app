import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORES, FUENTE, RADIOS } from '../../theme/tokens';
import { iniciales } from './iniciales';

interface Props {
  nombre: string | null;
  /** Foto de perfil de Handy (solo vendedores). `null`: las iniciales. */
  fotoUrl?: string | null;
  tamano: number;
  /** El marco de donde va (borde, sombra, márgenes). La forma y el contenido los pone el avatar. */
  style?: StyleProp<ViewStyle>;
}

/**
 * El gafete de una persona: un círculo azul señal plano con sus iniciales,
 * o su foto de Handy si tiene. Sin degradado: es un control chico (ver la
 * regla junto a DEGRADADOS en tokens.ts).
 *
 * Las iniciales se ven siempre hasta que la foto termina de cargar, y vuelven
 * si la foto falla (sin señal, URL muerta): nunca un hueco ni un ícono roto,
 * y sin spinner (parpadear en una lista es peor que esperar). La foto se
 * guarda en memoria y en disco: casi no cambia y la bodega tiene señal
 * irregular, no hay por qué bajarla en cada arranque.
 */
export function Avatar({ nombre, fotoUrl, tamano, style }: Props) {
  const foto = fotoUrl?.trim() || null;
  return (
    <View
      style={[estilos.marco, { width: tamano, height: tamano }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* La foto se recorta en un círculo interior: el marco conserva su sombra. */}
      <View style={[StyleSheet.absoluteFill, estilos.recorte, { borderRadius: tamano / 2 }]}>
        {/* `key`: si cambia la foto, se vuelve a empezar desde las iniciales. */}
        <Contenido key={foto ?? ''} nombre={nombre} foto={foto} tamano={tamano} />
      </View>
    </View>
  );
}

function Contenido({ nombre, foto, tamano }: { nombre: string | null; foto: string | null; tamano: number }) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'fallo'>('cargando');
  const conFoto = foto !== null && estado !== 'fallo';

  return (
    <>
      {estado !== 'lista' && (
        <View style={[StyleSheet.absoluteFill, estilos.centro]}>
          <Text style={[estilos.iniciales, { fontSize: tamano * 0.36, lineHeight: tamano * 0.44 }]}>{iniciales(nombre)}</Text>
        </View>
      )}
      {conFoto && (
        <Image
          source={{ uri: foto }}
          style={[StyleSheet.absoluteFill, estado !== 'lista' && estilos.oculta]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          onLoad={() => setEstado('lista')}
          onError={() => setEstado('fallo')}
        />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  marco: {
    borderRadius: RADIOS.completo,
  },
  recorte: {
    overflow: 'hidden',
  },
  // El fondo va en el estilo: las iniciales blancas nunca quedan al aire.
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.accion,
  },
  iniciales: {
    fontFamily: FUENTE.extraNegrita,
    letterSpacing: 0.2,
    color: COLORES.textoSobreColor,
  },
  oculta: {
    opacity: 0,
  },
});
