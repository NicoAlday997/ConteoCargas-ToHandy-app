import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  normalizarRutas,
  normalizarVendedores,
  parametrosHistorial,
  type FiltrosHistorial,
} from '../historial/filtros-historial';
import { normalizarDetalle } from '../historial/modelo-historial';
import { ErrorApi } from './cliente';
import {
  listarHistorial,
  obtenerDetalleHistorial,
  obtenerOpcionesFiltro,
} from './historial';

/** El máximo que acepta el servidor es 100; con 50 dos semanas de un contador caben en pocas páginas. */
const TAMANO_PAGINA = 50;

export const clavesHistorial = {
  // El usuario va en la clave: el alcance cambia con quien pregunta, y al
  // cambiar de sesión en el mismo teléfono no debe verse la lista del anterior.
  lista: (usuarioId: string, filtros = '') =>
    ['historial', usuarioId, 'lista', filtros] as const,
  opcionesFiltro: ['historial', 'opciones-filtro'] as const,
  detalle: (eventoId: string) => ['historial', 'detalle', eventoId] as const,
};

/** Un 403 o 404 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

export function useHistorial(usuarioId: string, filtros: FiltrosHistorial) {
  const parametros = parametrosHistorial(filtros);
  return useInfiniteQuery({
    queryKey: clavesHistorial.lista(usuarioId, parametros),
    queryFn: ({ pageParam }) =>
      listarHistorial(pageParam, TAMANO_PAGINA, parametros),
    initialPageParam: 1,
    getNextPageParam: (ultima, _todas, paginaActual) => {
      const total = ultima?.total ?? 0;
      return paginaActual * TAMANO_PAGINA < total
        ? paginaActual + 1
        : undefined;
    },
    enabled: usuarioId.length > 0,
    staleTime: 0,
    retry: reintentar,
  });
}

/** Vendedores y rutas para los filtros; solo se pide si el rol puede filtrar por persona. */
export function useOpcionesFiltroHistorial(habilitada: boolean) {
  return useQuery({
    queryKey: clavesHistorial.opcionesFiltro,
    queryFn: obtenerOpcionesFiltro,
    enabled: habilitada,
    staleTime: 5 * 60 * 1000,
    retry: reintentar,
    select: (api) => ({
      vendedores: normalizarVendedores(api?.vendedores),
      rutas: normalizarRutas(api?.rutas),
    }),
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
