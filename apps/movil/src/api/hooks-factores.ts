import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { agruparCatalogo, agruparPendientes } from '../factores/modelo-factores';
import { ErrorApi } from './cliente';
import {
  confirmarFactor,
  contarCargasEnCurso,
  listarFactores,
  listarFactoresPendientes,
  type ConfirmacionFactor,
  type FactorPendienteApi,
} from './factores';

export const clavesFactores = {
  todo: ['factores'] as const,
  pendientes: ['factores', 'pendientes'] as const,
  catalogo: ['factores', 'catalogo'] as const,
  cargasEnCurso: (code: string) => ['factores', 'cargas-en-curso', code] as const,
};

/** Un 403 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** `habilitado` = solo con sesión de supervisor: a los demás el servidor responde 403. */
export function useFactoresPendientes(habilitado: boolean) {
  return useQuery({
    queryKey: clavesFactores.pendientes,
    queryFn: listarFactoresPendientes,
    enabled: habilitado,
    // Otro supervisor puede estar confirmando al mismo tiempo.
    staleTime: 0,
    retry: reintentar,
    select: agruparPendientes,
  });
}

/** Todo el catálogo activo, confirmado o no: para corregir una confirmación equivocada. */
export function useFactoresCatalogo(habilitado: boolean) {
  return useQuery({
    queryKey: clavesFactores.catalogo,
    queryFn: listarFactores,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
    select: agruparCatalogo,
  });
}

/**
 * Cuántas cargas aún no enviadas tienen conteos del producto. Se pregunta al
 * abrir el cambio, antes de guardar: esos conteos no se recalculan.
 */
export function useCargasEnCurso(code: string) {
  return useQuery({
    queryKey: clavesFactores.cargasEnCurso(code),
    queryFn: () => contarCargasEnCurso(code),
    staleTime: 0,
    retry: reintentar,
    select: (r) => (typeof r?.cargasEnCurso === 'number' ? r.cargasEnCurso : null),
  });
}

/** Quita de la lista lo ya confirmado sin esperar a releerla. */
function quitarDeLista(clienteConsultas: ReturnType<typeof useQueryClient>, codes: readonly string[]) {
  clienteConsultas.setQueryData<FactorPendienteApi[] | null>(clavesFactores.pendientes, (actual) =>
    actual ? actual.filter((f) => !f.code || !codes.includes(f.code.trim())) : actual,
  );
}

export function useConfirmarFactor() {
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: ({ code, confirmacion }: { code: string; confirmacion: ConfirmacionFactor }) =>
      confirmarFactor(code, confirmacion),
    onSuccess: (_respuesta, { code }) => {
      quitarDeLista(clienteConsultas, [code]);
      // Pendientes, catálogo y cargas en curso: todo cambia con un empaque.
      void clienteConsultas.invalidateQueries({ queryKey: clavesFactores.todo });
    },
  });
}

export interface ProgresoFamilia {
  hechos: number;
  total: number;
}

/**
 * Toda una familia como "se vende completo". No hay endpoint por lote: uno por
 * uno, y al primer fallo se detiene. Lo ya guardado queda guardado; el error
 * dice cuántos alcanzaron.
 */
export function useConfirmarFamiliaCompleta(onProgreso: (progreso: ProgresoFamilia) => void) {
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: async (codes: readonly string[]) => {
      const hechos: string[] = [];
      try {
        for (const code of codes) {
          onProgreso({ hechos: hechos.length, total: codes.length });
          await confirmarFactor(code, { modalidadVenta: 'COMPLETO' });
          hechos.push(code);
        }
        onProgreso({ hechos: hechos.length, total: codes.length });
        return hechos.length;
      } catch (e) {
        throw new ErrorFamilia(hechos.length, codes.length, e);
      } finally {
        quitarDeLista(clienteConsultas, hechos);
      }
    },
    onSettled: () => {
      void clienteConsultas.invalidateQueries({ queryKey: clavesFactores.todo });
    },
  });
}

/** Falló a la mitad: cuántos sí se guardaron y la causa original. */
export class ErrorFamilia extends Error {
  constructor(
    readonly guardados: number,
    readonly total: number,
    readonly causa: unknown,
  ) {
    super(causa instanceof Error ? causa.message : 'No se pudo confirmar la familia.');
    this.name = 'ErrorFamilia';
  }
}
