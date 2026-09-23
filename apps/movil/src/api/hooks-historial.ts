import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { diaNegocio, sumarDias } from '../conteo/fecha-operativa';
import { normalizarDetalle, resumirSinLiquidar } from '../historial/modelo-historial';
import { ErrorApi } from './cliente';
import { listarHistorial, obtenerDetalleHistorial } from './historial';

/** El máximo que acepta el servidor es 100; con 50 dos semanas de un contador caben en pocas páginas. */
const TAMANO_PAGINA = 50;

export const clavesHistorial = {
  // El usuario va en la clave: el alcance cambia con quien pregunta, y al
  // cambiar de sesión en el mismo teléfono no debe verse la lista del anterior.
  lista: (usuarioId: string, soloSinLiquidar = false) =>
    ['historial', usuarioId, 'lista', soloSinLiquidar ? 'sin-liquidar' : 'todas'] as const,
  resumenSinLiquidar: (usuarioId: string) => ['historial', usuarioId, 'resumen-sin-liquidar'] as const,
  detalle: (eventoId: string) => ['historial', 'detalle', eventoId] as const,
};

/** Un 403 o 404 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** El resumen mira lo reciente: una carga sin liquidar de hace meses ya no dice si hoy alguien acumula. */
export const DIAS_RESUMEN_SIN_LIQUIDAR = 14;
/** Lo más que acepta el servidor por página; de sobra para dos semanas de cinco rutas. */
const TAMANO_RESUMEN = 100;

export function useHistorial(usuarioId: string, soloSinLiquidar = false) {
  return useInfiniteQuery({
    queryKey: clavesHistorial.lista(usuarioId, soloSinLiquidar),
    queryFn: ({ pageParam }) => listarHistorial(pageParam, TAMANO_PAGINA, { sinLiquidar: soloSinLiquidar }),
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

/**
 * Cargas iniciadas sin liquidar en las últimas 2 semanas, por vendedor. Al
 * vendedor el servidor solo le devuelve las suyas.
 */
export function useResumenSinLiquidar(usuarioId: string) {
  return useQuery({
    queryKey: clavesHistorial.resumenSinLiquidar(usuarioId),
    queryFn: () =>
      listarHistorial(1, TAMANO_RESUMEN, {
        sinLiquidar: true,
        fechaInicio: sumarDias(diaNegocio(new Date()), -(DIAS_RESUMEN_SIN_LIQUIDAR - 1)),
      }),
    enabled: usuarioId.length > 0,
    staleTime: 0,
    retry: reintentar,
    select: (pagina) => ({
      vendedores: resumirSinLiquidar(pagina?.items ?? []),
      /** Si hubo más de las que cupieron, los números son un mínimo. */
      incompleto: (pagina?.total ?? 0) > (pagina?.items?.length ?? 0),
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
