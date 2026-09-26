import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colorFamiliaDesdeApi, type ColorFamilia } from '../theme/colores-familia';
import { ErrorApi } from './cliente';
import { asignarColorFamilia, listarFamilias, type FamiliaColorApi } from './familias';

export const clavesFamilias = {
  lista: ['familias', 'lista'] as const,
};

export interface FamiliaConColor {
  familia: string;
  color: ColorFamilia | null;
  productos: number;
}

/** Descarta renglones sin nombre; un color fuera de la paleta se ve neutro. */
export function normalizarFamilias(filas: FamiliaColorApi[] | null): FamiliaConColor[] {
  return (filas ?? []).flatMap((f) => {
    const familia = f.familia?.trim();
    if (!familia) return [];
    return [{ familia, color: colorFamiliaDesdeApi(f.color), productos: typeof f.productos === 'number' ? f.productos : 0 }];
  });
}

/** Un 403 o un 404 no se arreglan reintentando. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** `habilitado` = solo con sesión de supervisor. */
export function useFamilias(habilitado: boolean) {
  return useQuery({
    queryKey: clavesFamilias.lista,
    queryFn: listarFamilias,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
    select: normalizarFamilias,
  });
}

/**
 * Asigna o quita el color. Se refleja en la lista al instante (optimista) y
 * vuelve atrás si el servidor lo rechaza. Los productos de las cargas se
 * releen para que el conteo tome el color nuevo.
 */
export function useAsignarColorFamilia() {
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: ({ familia, color }: { familia: string; color: ColorFamilia | null }) => asignarColorFamilia(familia, color),
    onMutate: async ({ familia, color }) => {
      await clienteConsultas.cancelQueries({ queryKey: clavesFamilias.lista });
      const anterior = clienteConsultas.getQueryData<FamiliaColorApi[] | null>(clavesFamilias.lista);
      clienteConsultas.setQueryData<FamiliaColorApi[] | null>(clavesFamilias.lista, (filas) =>
        filas?.map((f) => (f.familia === familia ? { ...f, color } : f)) ?? filas,
      );
      return { anterior };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto) clienteConsultas.setQueryData(clavesFamilias.lista, contexto.anterior);
    },
    onSettled: () => {
      void clienteConsultas.invalidateQueries({ queryKey: clavesFamilias.lista });
      void clienteConsultas.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'cargas' && q.queryKey[2] === 'productos',
      });
    },
  });
}
