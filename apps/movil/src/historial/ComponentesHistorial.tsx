import type { ReactNode } from 'react';
import { router } from 'expo-router';

import type { EstadoCargaApi } from '../api/historial';
import { Encabezado, type BandaTarjeta } from '../componentes/base';
import type { ColorTono } from '../theme/tokens';
import { estadoDeCarga, type TonoEstado } from './modelo-historial';

/** Ancho máximo de las listas en tablet: una columna legible, no una fila de 1000 px. */
export const ANCHO_MAXIMO_LISTA = 720;

export function volver() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Un color por estado: verde listo, ámbar atención, rojo error. Lo que sigue
 * su curso (contando, en verificación) va en azul de marca: no pide nada.
 */
const TONO_ESTADO: Record<TonoEstado, ColorTono> = {
  exito: 'capturado',
  atencion: 'discrepancia',
  error: 'error',
  neutro: 'marca',
};

/** Banda de color de la tarjeta de una carga: el estado se lee antes que nada. */
export function bandaDeEstado(estado: EstadoCargaApi | null, detalle?: string | null): BandaTarjeta {
  const { etiqueta, tono } = estadoDeCarga(estado);
  return { titulo: etiqueta, tono: TONO_ESTADO[tono], detalle };
}

/**
 * Barra superior fija: volver, título y, con peso propio, el subtítulo. Lo
 * demás (contexto que se retira) lo pone cada pantalla como hijos.
 */
export function BarraSuperior({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string | null;
  children?: ReactNode;
}) {
  return (
    <Encabezado titulo={titulo} subtitulo={subtitulo} onVolver={volver} marca>
      {children}
    </Encabezado>
  );
}
