import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { EstadoCargaApi } from '../api/historial';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import { estadoDeCarga, type TonoEstado } from './modelo-historial';

/** Ancho máximo de las listas en tablet: una columna legible, no una fila de 1000 px. */
export const ANCHO_MAXIMO_LISTA = 720;

export function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BotonVolver({ etiqueta }: { etiqueta: string }) {
  return (
    <Pressable
      onPress={volver}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={ESPACIADO.sm}
      style={({ pressed }) => [estilos.botonVolver, pressed && estilos.botonVolverPresionado]}
    >
      {({ pressed }) => <Text style={[estilos.textoVolver, pressed && estilos.textoInvertido]}>‹</Text>}
    </Pressable>
  );
}

const FONDO_TONO: Record<TonoEstado, string> = {
  exito: COLORES.capturado,
  atencion: COLORES.discrepancia,
  error: COLORES.error,
  neutro: COLORES.superficie,
};

/** Texto oscuro sobre ámbar y gris; blanco sobre verde y rojo: contraste suficiente en bodega. */
const TEXTO_TONO: Record<TonoEstado, string> = {
  exito: COLORES.textoSobreColor,
  atencion: COLORES.texto,
  error: COLORES.textoSobreColor,
  neutro: COLORES.texto,
};

export function InsigniaEstado({ estado }: { estado: EstadoCargaApi | null }) {
  const { etiqueta, tono } = estadoDeCarga(estado);
  return (
    <View style={[estilos.insignia, { backgroundColor: FONDO_TONO[tono] }]}>
      <Text style={[estilos.textoInsignia, { color: TEXTO_TONO[tono] }]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

export function EstadoCentral({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle?: string;
  accion?: { texto: string; onPress: () => void };
}) {
  return (
    <View style={estilos.centrado}>
      <Text style={estilos.tituloCentral} accessibilityRole="header">
        {titulo}
      </Text>
      {detalle && <Text style={estilos.detalleCentral}>{detalle}</Text>}
      {accion && (
        <Pressable
          onPress={accion.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.botonCentral, pressed && estilos.botonCentralPresionado]}
        >
          <Text style={estilos.textoBotonCentral}>{accion.texto}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Barra superior fija: volver y título; lo demás lo pone cada pantalla. */
export function BarraSuperior({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <View style={estilos.barra}>
      <View style={estilos.filaBarra}>
        <BotonVolver etiqueta="Volver" />
        <Text style={estilos.tituloBarra} accessibilityRole="header" numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    gap: ESPACIADO.xs,
    paddingHorizontal: ESPACIADO.md,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORES.texto,
    backgroundColor: COLORES.fondo,
  },
  filaBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  tituloBarra: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  botonVolver: {
    width: TOQUE_MINIMO,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -ESPACIADO.sm,
    borderRadius: RADIOS.md,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.texto,
  },
  textoVolver: {
    fontSize: TIPOGRAFIA.tamanos.xxxl,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  insignia: {
    alignSelf: 'flex-start',
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: 2,
    borderRadius: RADIOS.sm,
  },
  textoInsignia: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.xl,
  },
  tituloCentral: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  detalleCentral: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
    textAlign: 'center',
    maxWidth: 420,
  },
  botonCentral: {
    minHeight: TOQUE_MINIMO,
    minWidth: 220,
    marginTop: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.texto,
  },
  botonCentralPresionado: {
    backgroundColor: COLORES.textoSecundario,
  },
  textoBotonCentral: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSobreColor,
  },
});
