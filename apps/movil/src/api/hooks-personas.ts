import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { ErrorApi } from './cliente';
import {
  crearPersona,
  desbloquearPersona,
  editarPersona,
  listarAccesosPersona,
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
  // Bajo `personas`: restablecer o desbloquear agrega un renglón y lo refresca.
  accesosRecientes: (id: string) =>
    ['personas', 'accesos', id, 'recientes'] as const,
  accesosTodos: (id: string) => ['personas', 'accesos', id, 'todos'] as const,
};

/** Un 403 o un 409 no se arreglan reintentando. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/**
 * `habilitado` = solo con sesión de supervisor. `vigilar`: se vuelve a leer
 * cada minuto, para que el aviso de bloqueos del inicio aparezca solo, sin
 * que el supervisor tenga que salir y volver.
 */
export function usePersonas(habilitado: boolean, vigilar = false) {
  return useQuery({
    queryKey: clavesPersonas.lista,
    queryFn: listarPersonas,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
    refetchInterval: vigilar ? INTERVALO_VIGILANCIA_MS : false,
  });
}

const INTERVALO_VIGILANCIA_MS = 60_000;

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
  return useMutation({
    mutationFn: (datos: DatosAlta) => crearPersona(datos),
    onSuccess: refrescar,
  });
}

export function useEditarPersona() {
  const refrescar = useRefrescarPersonas();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosEdicion }) =>
      editarPersona(id, datos),
    onSuccess: refrescar,
  });
}

export function useRestablecerPin() {
  const refrescar = useRefrescarPersonas();
  return useMutation({
    mutationFn: (id: string) => restablecerPinPersona(id),
    onSuccess: refrescar,
  });
}

/**
 * Un 409 (`NO_BLOQUEADO`: venció mientras tanto) también refresca: la lista
 * tiene que dejar de mostrarlo bloqueado.
 */
export function useDesbloquearPersona() {
  const refrescar = useRefrescarPersonas();
  return useMutation({
    mutationFn: (id: string) => desbloquearPersona(id),
    onSettled: refrescar,
  });
}

/** Los que caben a la vista en la ficha; el resto, en "Ver todo". */
export const ACCESOS_RECIENTES = 5;
const TAMANO_PAGINA_ACCESOS = 50;

/** Los últimos movimientos de acceso de una persona, para su ficha. */
export function useAccesosRecientes(id: string) {
  return useQuery({
    queryKey: clavesPersonas.accesosRecientes(id),
    queryFn: () => listarAccesosPersona(id, 1, ACCESOS_RECIENTES),
    staleTime: 0,
    retry: reintentar,
  });
}

/** Todo el historial de acceso, por páginas, del más reciente al más antiguo. */
export function useAccesosTodos(id: string) {
  return useInfiniteQuery({
    queryKey: clavesPersonas.accesosTodos(id),
    queryFn: ({ pageParam }) =>
      listarAccesosPersona(id, pageParam, TAMANO_PAGINA_ACCESOS),
    initialPageParam: 1,
    getNextPageParam: (ultima, _todas, paginaActual) => {
      const total = ultima?.total ?? 0;
      return paginaActual * TAMANO_PAGINA_ACCESOS < total
        ? paginaActual + 1
        : undefined;
    },
    staleTime: 0,
    retry: reintentar,
  });
}
