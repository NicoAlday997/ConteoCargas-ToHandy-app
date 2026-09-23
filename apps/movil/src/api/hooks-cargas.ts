import { useMutation, useQuery } from '@tanstack/react-query';

import { guardarProductosLocal, obtenerProductosLocal } from '../conteo/almacen-local';
import type { FamiliaConteo, ProductoConteo } from '../conteo/estado-conteo';
import { abrirSesion, finalizarSesion, iniciarCarga, obtenerProductos, type RespuestaProductos, type TipoCarga } from './cargas';
import { ErrorRed } from './cliente';

/** La plantilla es un snapshot del evento: no cambia mientras se cuenta. */
const STALE_TIME_PRODUCTOS_MS = 1000 * 60 * 60 * 12;

export const clavesCargas = {
  productos: (eventoId: string) => ['cargas', eventoId, 'productos'] as const,
};

export interface ProductosDeCarga {
  familias: FamiliaConteo[];
  /** Mismo orden que `familias`, aplanado: es el orden del recorrido. */
  productos: ProductoConteo[];
}

/** Descarta lo que no se puede contar (sin código) en vez de romper la pantalla. */
function normalizarProductos(respuesta: RespuestaProductos | null): ProductosDeCarga {
  const familias: FamiliaConteo[] = [];
  const productos: ProductoConteo[] = [];
  const vistos = new Set<string>();

  for (const grupo of respuesta?.familias ?? []) {
    const familia = grupo.familia?.trim() || null;
    const deFamilia: ProductoConteo[] = [];
    for (const p of grupo.productos ?? []) {
      const code = p.code?.trim();
      if (!code || vistos.has(code)) continue;
      vistos.add(code);
      deFamilia.push({
        code,
        nombre: p.nombre?.trim() || code,
        familia,
        piezasPorPaquete: typeof p.piezasPorPaquete === 'number' ? p.piezasPorPaquete : null,
        factorConfirmado: p.factorConfirmado === true,
      });
    }
    if (deFamilia.length > 0) {
      familias.push({ familia, productos: deFamilia });
      productos.push(...deFamilia);
    }
  }

  return { familias, productos };
}

/**
 * Sin señal se usa la copia guardada la última vez: si la app se cierra a
 * media carga en bodega, el conteo debe poder reabrirse ahí mismo.
 */
async function productosConRespaldo(eventoId: string): Promise<RespuestaProductos | null> {
  try {
    const respuesta = await obtenerProductos(eventoId);
    if (respuesta) void guardarProductosLocal(eventoId, respuesta).catch(() => undefined);
    return respuesta;
  } catch (error) {
    if (error instanceof ErrorRed) {
      const local = await obtenerProductosLocal(eventoId);
      if (local) return local;
    }
    throw error;
  }
}

export function useProductosCarga(eventoId: string) {
  return useQuery({
    queryKey: clavesCargas.productos(eventoId),
    queryFn: () => productosConRespaldo(eventoId),
    staleTime: STALE_TIME_PRODUCTOS_MS,
    gcTime: STALE_TIME_PRODUCTOS_MS,
    enabled: eventoId.length > 0,
    // Sin esto, si algún día se conecta `onlineManager` a NetInfo, la consulta
    // se pausaría sin red y nunca llegaría al respaldo local.
    networkMode: 'always',
    select: normalizarProductos,
  });
}

export function useIniciarCarga() {
  return useMutation({
    mutationFn: (tipo: TipoCarga) => iniciarCarga(tipo),
  });
}

export function useAbrirSesion() {
  return useMutation({
    mutationFn: (eventoId: string) => abrirSesion(eventoId),
  });
}

interface VariablesFinalizarSesion {
  eventoId: string;
  sesionId: string;
}

export function useFinalizarSesion() {
  return useMutation({
    mutationFn: ({ eventoId, sesionId }: VariablesFinalizarSesion) => finalizarSesion(eventoId, sesionId),
  });
}
