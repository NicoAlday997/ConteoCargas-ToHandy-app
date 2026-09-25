import { useEffect, useState } from 'react';

import type { BandaTarjeta } from '../componentes/base';
import type { ColorEstado, ColorTono } from '../theme/tokens';
import { minutosEspera, nivelEspera, textoEspera, type NivelEspera } from './modelo-supervisor';

/** Cada cuánto se recalcula "cuánto lleva esperando" en pantalla. */
const TICK_ESPERA_MS = 30_000;

/** La hora actual, que avanza sola: la espera se ve crecer sin tocar nada. */
export function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), TICK_ESPERA_MS);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

/**
 * Reciente sigue su curso (marca); ya pesa, ámbar; detenida frena al camión,
 * rojo. Sin dato, gris: no se puede afirmar nada.
 */
export const TONO_ESPERA: Record<NivelEspera, ColorTono> = {
  reciente: 'marca',
  atencion: 'discrepancia',
  detenida: 'error',
  desconocida: 'pendiente',
};

/** Barra lateral solo para lo que ya pesa: lo demás no pide mirar. */
export const ACENTO_ESPERA: Record<NivelEspera, ColorEstado | undefined> = {
  reciente: undefined,
  atencion: 'discrepancia',
  detenida: 'error',
  desconocida: undefined,
};

export interface Espera {
  nivel: NivelEspera;
  /** "Espera 12 min", "Detenida 1 h 5 min". */
  titulo: string;
}

export function espera(desde: number | null, ahora: number): Espera {
  const minutos = minutosEspera(desde, ahora);
  const nivel = nivelEspera(minutos);
  if (minutos === null) return { nivel, titulo: 'Espera sin dato' };
  return { nivel, titulo: `${nivel === 'detenida' ? 'Detenida' : 'Espera'} ${textoEspera(minutos)}` };
}

export function bandaDeEspera(e: Espera, detalle?: string | null): BandaTarjeta {
  return { titulo: e.titulo, tono: TONO_ESPERA[e.nivel], detalle };
}
