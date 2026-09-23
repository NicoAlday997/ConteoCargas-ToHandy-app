import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { normalizarPermisos, normalizarRutas } from '../permisos/modelo-permisos';
import { ErrorApi } from './cliente';
import { listarPermisos, listarRutasPermiso, otorgarPermiso } from './permisos';

export const clavesPermisos = {
  lista: ['permisos-carga', 'lista'] as const,
  rutas: ['permisos-carga', 'rutas'] as const,
};

/** Un vendedor puede gastar el permiso en cualquier momento: se relee seguido. */
const INTERVALO_PERMISOS_MS = 60_000;

function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

export function usePermisosCarga() {
  return useQuery({
    queryKey: clavesPermisos.lista,
    queryFn: listarPermisos,
    staleTime: 0,
    refetchInterval: INTERVALO_PERMISOS_MS,
    retry: reintentar,
    select: normalizarPermisos,
  });
}

export function useRutasPermiso(habilitada: boolean) {
  return useQuery({
    queryKey: clavesPermisos.rutas,
    queryFn: listarRutasPermiso,
    enabled: habilitada,
    retry: reintentar,
    select: normalizarRutas,
  });
}

interface VariablesOtorgar {
  rutaId: string;
  motivo: string;
}

export function useOtorgarPermiso() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ rutaId, motivo }: VariablesOtorgar) => otorgarPermiso(rutaId, motivo),
    onSettled: () => cliente.invalidateQueries({ queryKey: clavesPermisos.lista }),
  });
}
