import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { normalizarDetalle } from '../historial/modelo-historial';
import { ErrorApi } from './cliente';
import { listarHistorial, obtenerDetalleHistorial } from './historial';

/** El máximo que acepta el servidor es 100; con 50 dos semanas de un contador caben en pocas páginas. */
const TAMANO_PAGINA = 50;

export const clavesHistorial = {
  // El usuario va en la clave: el alcance cambia con quien pregunta, y al
  // cambiar de sesión en el mismo teléfono no debe verse la lista del anterior.
  lista: (usuarioId: string) => ['historial', usuarioId, 'lista'] as const,
  detalle: (eventoId: string) => ['historial', 'detalle', eventoId] as const,
};

/** Un 403 o 404 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

export function useHistorial(usuarioId: string) {
  return useInfiniteQuery({
    queryKey: clavesHistorial.lista(usuarioId),
    queryFn: ({ pageParam }) => listarHistorial(pageParam, TAMANO_PAGINA),
    initialPageParam: 1,
    getNextPageParam: (ultima, _todas, paginaActual) => {
      const total = ultima?.total ?? 0;
      return paginaActual * TAMANO_PAGINA < total ? paginaActual + 1 : undefined;
    },
    enabled: usuarioId.length > 0,
    staleTime: 0,
    retry: reintentar,
  });
}

export function useDetalleHistorial(eventoId: string) {
  return useQuery({
    queryKey: clavesHistorial.detalle(eventoId),
    queryFn: () => obtenerDetalleHistorial(eventoId),
    enabled: eventoId.length > 0,
    staleTime: 0,
    retry: reintentar,
    select: normalizarDetalle,
  });
}
