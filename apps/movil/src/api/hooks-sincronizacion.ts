import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ErrorApi } from './cliente';
import { clavesFactores } from './hooks-factores';
import { clavesFamilias } from './hooks-familias';
import { clavesPlantillas } from './hooks-plantillas';
import {
  consultarEstadoSincronizacion,
  sincronizarConHandy,
} from './sincronizacion';

export const clavesSincronizacion = {
  estado: ['sincronizacion', 'estado'] as const,
};

/** Un 403 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** Los tres roles pueden consultarlo; `habilitado` = con sesión iniciada. */
export function useEstadoSincronizacion(habilitado: boolean) {
  return useQuery({
    queryKey: clavesSincronizacion.estado,
    queryFn: consultarEstadoSincronizacion,
    enabled: habilitado,
    retry: reintentar,
  });
}

/**
 * Sincroniza con Handy. Al terminar bien se refresca solo todo lo que sale del
 * catálogo: el estado, los empaques, las plantillas, las familias, los
 * productos de las cargas y las fotos de los vendedores.
 */
export function useSincronizarConHandy() {
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: sincronizarConHandy,
    onSuccess: () => {
      for (const queryKey of [
        clavesSincronizacion.estado,
        clavesFactores.todo,
        clavesPlantillas.todo,
        clavesFamilias.lista,
        ['cargas'],
        ['auth', 'usuarios'],
      ]) {
        void clienteConsultas.invalidateQueries({ queryKey });
      }
    },
  });
}
