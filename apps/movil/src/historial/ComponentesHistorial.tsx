import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { EstadoCargaApi } from '../api/historial';
import { Encabezado, type BandaTarjeta } from '../componentes/base';
import { BORDES, COLORES, FUENTE, RITMO, TIPOGRAFIA, type ColorTono } from '../theme/tokens';
import { estadoDeCarga, type Cancelacion, type TonoEstado } from './modelo-historial';

/** Ancho máximo de las listas en tablet: una columna legible, no una fila de 1000 px. */
export const ANCHO_MAXIMO_LISTA = 720;

export function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Un color por estado: verde listo, ámbar atención, rojo error. Lo que sigue
 * su curso (contando, en verificación) va en gris: no pide nada, y el azul no
 * es un estado (ver la regla del azul en tokens.ts).
 */
const TONO_ESTADO: Record<TonoEstado, ColorTono> = {
  exito: 'capturado',
  atencion: 'discrepancia',
  error: 'error',
  neutro: 'pendiente',
};

/** Banda de color de la tarjeta de una carga: el estado se lee antes que nada. */
export function bandaDeEstado(estado: EstadoCargaApi | null, detalle?: string | null): BandaTarjeta {
  const { etiqueta, tono } = estadoDeCarga(estado);
  return { titulo: etiqueta, tono: TONO_ESTADO[tono], detalle };
}

/**
 * Encabezado de las pantallas de trabajo: bloque azul con volver, título y
 * subtítulo. Sube bajo la barra de estado: la pantalla no aplica el margen
 * superior de área segura. `marca={false}` para las pantallas de
 * administración (plantillas), que van sobre el fondo de pantalla.
 */
export function BarraSuperior({
  titulo,
  subtitulo,
  marca = true,
  children,
}: {
  titulo: string;
  subtitulo?: string | null;
  marca?: boolean;
  children?: ReactNode;
}) {
  return (
    <Encabezado variante={marca ? 'marca' : 'barra'} titulo={titulo} subtitulo={subtitulo} onVolver={volver}>
      {children}
    </Encabezado>
  );
}

/**
 * Una carga cancelada se audita en el historial. El estado "Cancelada" ya lo
 * dice la banda de la tarjeta (una sola vez); aquí va quién y por qué, debajo
 * de una línea, en secundario y sin rojo. Sin motivo (el vendedor no está
 * obligado a darlo) se dice.
 */
export function textoCancelacion(cancelacion: Cancelacion): string {
  const quien = cancelacion.porNombre ? `Cancelada por ${cancelacion.porNombre}` : 'Cancelada';
  const porque = cancelacion.motivo ? `“${cancelacion.motivo}”` : 'sin motivo escrito';
  return `${quien} · ${porque}`;
}

export function DetalleCancelacion({ cancelacion }: { cancelacion: Cancelacion }) {
  return (
    <View style={estilos.cancelacion}>
      <Text style={estilos.textoCancelacion}>{textoCancelacion(cancelacion)}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cancelacion: {
    paddingTop: RITMO.relacionado,
    borderTopWidth: BORDES.fino,
    borderTopColor: COLORES.divisor,
  },
  textoCancelacion: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
  },
});
