import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listarDiasNoLaborables,
  marcarDiaNoLaborable,
  previsualizarRecorrido,
  quitarDiaNoLaborable,
  recorrerCargas,
} from './calendario';
import { ErrorApi } from './cliente';
import { clavesCargas } from './hooks-cargas';

export const clavesCalendario = {
  noLaborables: ['calendario', 'no-laborables'] as const,
  cargasDelDia: (fecha: string) => ['calendario', 'cargas-del-dia', fecha] as const,
};

/** Un 403 o un 409 no se arreglan reintentando. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** `habilitado` = solo con sesión de supervisor. */
export function useDiasNoLaborables(habilitado: boolean) {
  return useQuery({
    queryKey: clavesCalendario.noLaborables,
    queryFn: listarDiasNoLaborables,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
  });
}

/** Al marcar o quitar un día cambian también las fechas que se ofrecen al cargar. */
function useInvalidarCalendario() {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: clavesCalendario.noLaborables });
    void cliente.invalidateQueries({ queryKey: clavesCargas.fechasDisponibles });
  };
}

export function useMarcarDiaNoLaborable() {
  const invalidar = useInvalidarCalendario();
  return useMutation({
    mutationFn: ({ fecha, motivo }: { fecha: string; motivo: string }) => marcarDiaNoLaborable(fecha, motivo),
    onSettled: invalidar,
  });
}

export function useQuitarDiaNoLaborable() {
  const invalidar = useInvalidarCalendario();
  return useMutation({
    mutationFn: (fecha: string) => quitarDiaNoLaborable(fecha),
    onSettled: invalidar,
  });
}

/** Las cargas de un día, antes de recorrerlas. `fecha` null: sin consultar. */
export function useCargasDelDia(fecha: string | null) {
  return useQuery({
    queryKey: clavesCalendario.cargasDelDia(fecha ?? ''),
    queryFn: () => previsualizarRecorrido(fecha as string),
    enabled: fecha !== null,
    staleTime: 0,
    gcTime: 0,
    retry: reintentar,
  });
}

/**
 * Recorre las cargas de un día. Cambia la fecha de muchas cargas a la vez: se
 * releen el historial, las vistas del supervisor y la cola del contador.
 */
export function useRecorrerCargas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ fechaOrigen, fechaDestino, motivo }: { fechaOrigen: string; fechaDestino: string; motivo: string }) =>
      recorrerCargas(fechaOrigen, fechaDestino, motivo),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: ['calendario'] });
      void cliente.invalidateQueries({ queryKey: ['cargas'] });
      void cliente.invalidateQueries({ queryKey: ['historial'] });
      void cliente.invalidateQueries({ queryKey: ['supervisor'] });
    },
  });
}
