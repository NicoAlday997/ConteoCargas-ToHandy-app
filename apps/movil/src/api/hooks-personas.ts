import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ErrorApi } from './cliente';
import {
  crearPersona,
  editarPersona,
  listarCuentasHandy,
  listarPersonas,
  restablecerPinPersona,
  type DatosAlta,
  type DatosEdicion,
} from './personas';

export const clavesPersonas = {
  todo: ['personas'] as const,
  lista: ['personas', 'lista'] as const,
  cuentasHandy: ['personas', 'cuentas-handy'] as const,
};

/** Un 403 o un 409 no se arreglan reintentando. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** `habilitado` = solo con sesión de supervisor. */
export function usePersonas(habilitado: boolean) {
  return useQuery({ queryKey: clavesPersonas.lista, queryFn: listarPersonas, enabled: habilitado, staleTime: 0, retry: reintentar });
}

export function useCuentasHandy(habilitado: boolean) {
  return useQuery({
    queryKey: clavesPersonas.cuentasHandy,
    queryFn: listarCuentasHandy,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
  });
}

/**
 * Cualquier cambio de personas cambia también la pantalla de login (quién
 * aparece) y qué cuentas de Handy quedan libres.
 */
function useRefrescarPersonas() {
  const clienteConsultas = useQueryClient();
  return () => {
    void clienteConsultas.invalidateQueries({ queryKey: clavesPersonas.todo });
    void clienteConsultas.invalidateQueries({ queryKey: ['auth', 'usuarios'] });
  };
}

export function useCrearPersona() {
  const refrescar = useRefrescarPersonas();
  return useMutation({ mutationFn: (datos: DatosAlta) => crearPersona(datos), onSuccess: refrescar });
}

export function useEditarPersona() {
  const refrescar = useRefrescarPersonas();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosEdicion }) => editarPersona(id, datos),
    onSuccess: refrescar,
  });
}

export function useRestablecerPin() {
  const refrescar = useRefrescarPersonas();
  return useMutation({ mutationFn: (id: string) => restablecerPinPersona(id), onSuccess: refrescar });
}
