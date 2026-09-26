import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { armarCola, armarPorEnviar } from '../supervisor/modelo-supervisor';
import { cancelarCarga } from './cargas';
import { ErrorApi } from './cliente';
import type { EstadoCargaApi } from './historial';
import {
  autorizarCarga,
  cancelarEnHandy,
  enviarCarga,
  listarCargasPorEstado,
  modificarCantidad,
  obtenerTiemposEvento,
  rechazarProductos,
  type EventoConTiemposApi,
  type ProductoRechazado,
} from './supervisor';

export const clavesSupervisor = {
  cola: ['supervisor', 'cola'] as const,
  porEnviar: ['supervisor', 'por-enviar'] as const,
};

/** Las cargas llegan cuando alguien termina de contar o de resolver: basta cada minuto. */
const INTERVALO_COLA_MS = 60_000;

/** Autorizadas que aún no están en Handy: listas, con error o con envío sin confirmar. */
const ESTADOS_POR_ENVIAR: readonly EstadoCargaApi[] = ['LISTA_PARA_ENVIAR', 'ENVIO_INCIERTO', 'ERROR_ENVIO'];

/** Un 403 no se arregla reintentando: se muestra de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/**
 * El historial no trae desde cuándo espera cada carga: se pregunta a cada
 * una. Son pocas (5 rutas) y en paralelo. Si una falla, se muestra sin espera
 * en vez de tirar la cola completa.
 */
async function leerCola() {
  const items = (await listarCargasPorEstado('EN_ESPERA_AUTORIZACION'))?.items ?? [];
  const tiempos = await Promise.all(
    items.map(async (c): Promise<[string, EventoConTiemposApi | null]> => {
      const id = c.id ?? '';
      if (!id) return [id, null];
      try {
        return [id, await obtenerTiemposEvento(id)];
      } catch {
        return [id, null];
      }
    }),
  );
  return armarCola(items, new Map(tiempos));
}

async function leerPorEnviar() {
  const paginas = await Promise.all(ESTADOS_POR_ENVIAR.map((estado) => listarCargasPorEstado(estado)));
  return armarPorEnviar(paginas.flatMap((p) => p?.items ?? []));
}

/** `habilitado` = solo con sesión de supervisor: a los demás el servidor no les muestra todo. */
export function useColaAutorizacion(habilitado: boolean) {
  return useQuery({
    queryKey: clavesSupervisor.cola,
    queryFn: leerCola,
    enabled: habilitado,
    // Otro supervisor puede estar autorizando al mismo tiempo.
    staleTime: 0,
    refetchInterval: INTERVALO_COLA_MS,
    retry: reintentar,
  });
}

export function usePorEnviar(habilitado: boolean) {
  return useQuery({
    queryKey: clavesSupervisor.porEnviar,
    queryFn: leerPorEnviar,
    enabled: habilitado,
    staleTime: 0,
    refetchInterval: INTERVALO_COLA_MS,
    retry: reintentar,
  });
}

/** Cualquier acción cambia el estado de la carga: la cola, el detalle y el historial ya no valen. */
function useInvalidarTrasAccion() {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: ['supervisor'] });
    void cliente.invalidateQueries({ queryKey: ['historial'] });
  };
}

export function useAutorizarCarga(eventoId: string) {
  const invalidar = useInvalidarTrasAccion();
  return useMutation({
    mutationFn: () => autorizarCarga(eventoId),
    onSettled: invalidar,
  });
}

export function useRechazarProductos(eventoId: string) {
  const invalidar = useInvalidarTrasAccion();
  return useMutation({
    mutationFn: (productos: readonly ProductoRechazado[]) => rechazarProductos(eventoId, productos),
    onSettled: invalidar,
  });
}

interface VariablesModificar {
  productoCode: string;
  /** Piezas. */
  cantidadNueva: number;
  motivo: string;
}

export function useModificarCantidad(eventoId: string) {
  const invalidar = useInvalidarTrasAccion();
  return useMutation({
    mutationFn: ({ productoCode, cantidadNueva, motivo }: VariablesModificar) =>
      modificarCantidad(eventoId, productoCode, cantidadNueva, motivo),
    onSettled: invalidar,
  });
}

export function useEnviarCarga(eventoId: string) {
  const invalidar = useInvalidarTrasAccion();
  return useMutation({
    mutationFn: () => enviarCarga(eventoId),
    // También al fallar: un 502 deja la carga en ENVIO_INCIERTO o ERROR_ENVIO.
    onSettled: invalidar,
  });
}

interface VariablesCancelar {
  /** Una carga ya enviada se cancela primero en Handy. */
  enHandy: boolean;
  motivo: string;
}

export function useCancelarCargaSupervisor(eventoId: string) {
  const invalidar = useInvalidarTrasAccion();
  return useMutation({
    mutationFn: ({ enHandy, motivo }: VariablesCancelar) =>
      enHandy ? cancelarEnHandy(eventoId, motivo) : cancelarCarga(eventoId, motivo),
    onSettled: invalidar,
  });
}
