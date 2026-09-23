import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { guardarProductosLocal, obtenerProductosLocal } from '../conteo/almacen-local';
import type { FamiliaConteo, ProductoConteo } from '../conteo/estado-conteo';
import { estadoDe, type ConteoLado, type Discrepancia } from '../discrepancias/estado-discrepancia';
import {
  abrirSesion,
  capturarDiscrepancia,
  confirmarDiscrepancia,
  desbloquearCarga,
  finalizarSesion,
  iniciarCarga,
  listarConflictosPendientes,
  listarPendientesVerificacion,
  obtenerDiscrepancias,
  obtenerProductos,
  type DiscrepanciaApi,
  type LadoDiscrepanciaApi,
  type RespuestaProductos,
  type TipoCarga,
} from './cargas';
import { ErrorRed } from './cliente';

/** La plantilla es un snapshot del evento: no cambia mientras se cuenta. */
const STALE_TIME_PRODUCTOS_MS = 1000 * 60 * 60 * 12;

export const clavesCargas = {
  productos: (eventoId: string) => ['cargas', eventoId, 'productos'] as const,
  pendientesVerificacion: ['cargas', 'pendientes-verificacion'] as const,
  conflictosPendientes: ['cargas', 'conflictos-pendientes'] as const,
  discrepancias: (eventoId: string) => ['cargas', eventoId, 'discrepancias'] as const,
};

/**
 * Mientras quede algo por resolver se relee seguido: la otra persona captura o
 * confirma desde su propio dispositivo y aquí hay que verlo sin tocar nada.
 */
const INTERVALO_DISCREPANCIAS_MS = 5_000;
/** La cola cambia cuando un vendedor termina: no hace falta más seguido. */
const INTERVALO_COLA_MS = 30_000;

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

// ---------------------------------------------------------------------------
// Verificación y resolución de discrepancias
// ---------------------------------------------------------------------------

/** Cola del contador. Siempre fresca: una carga ya tomada no debe verse libre. */
export function usePendientesVerificacion(habilitada: boolean) {
  return useQuery({
    queryKey: clavesCargas.pendientesVerificacion,
    queryFn: listarPendientesVerificacion,
    enabled: habilitada,
    staleTime: 0,
    refetchInterval: INTERVALO_COLA_MS,
  });
}

export function useConflictosPendientes(habilitada: boolean) {
  return useQuery({
    queryKey: clavesCargas.conflictosPendientes,
    queryFn: listarConflictosPendientes,
    enabled: habilitada,
    staleTime: 0,
    refetchInterval: INTERVALO_COLA_MS,
  });
}

export function useDesbloquearCarga() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => desbloquearCarga(eventoId),
    onSettled: () => cliente.invalidateQueries({ queryKey: clavesCargas.pendientesVerificacion }),
  });
}

function numeroONulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : null;
}

function lado(api: LadoDiscrepanciaApi | null | undefined, piezas: number): ConteoLado {
  return {
    tipoSesion: typeof api?.tipoSesion === 'string' ? api.tipoSesion : null,
    piezas,
    paquetes: numeroONulo(api?.paquetes),
    sueltas: numeroONulo(api?.sueltas),
  };
}

/** Descarta filas sin código o sin los dos conteos: no hay nada honesto que mostrar. */
function normalizarDiscrepancias(filas: DiscrepanciaApi[]): Discrepancia[] {
  const resultado: Discrepancia[] = [];
  for (const f of filas) {
    const code = f.productoCode?.trim();
    if (!code || typeof f.cantidadVendedorOriginal !== 'number' || typeof f.cantidadContadorOriginal !== 'number') {
      continue;
    }
    resultado.push({
      code,
      producto: {
        code,
        nombre: f.productoNombre?.trim() || code,
        familia: null,
        piezasPorPaquete: typeof f.piezasPorPaquete === 'number' ? f.piezasPorPaquete : null,
        factorConfirmado: f.factorConfirmado === true,
      },
      primerConteo: lado(f.primerConteo, f.cantidadVendedorOriginal),
      segundoConteo: lado(f.segundoConteo, f.cantidadContadorOriginal),
      cantidadFinal: typeof f.cantidadFinal === 'number' ? f.cantidadFinal : null,
      capturadaPor: f.capturadaPor ?? null,
      capturadaPorNombre: f.capturadaPorNombre?.trim() || null,
      confirmadaPor: f.confirmadaPor ?? null,
      confirmadaPorNombre: f.confirmadaPorNombre?.trim() || null,
    });
  }
  return resultado;
}

export function useDiscrepancias(eventoId: string) {
  return useQuery({
    queryKey: clavesCargas.discrepancias(eventoId),
    queryFn: () => obtenerDiscrepancias(eventoId),
    enabled: eventoId.length > 0,
    staleTime: 0,
    select: normalizarDiscrepancias,
    refetchInterval: (consulta) => {
      const filas = consulta.state.data;
      if (!filas) return false;
      const pendientes = normalizarDiscrepancias(filas).some((d) => estadoDe(d) !== 'confirmada');
      return pendientes ? INTERVALO_DISCREPANCIAS_MS : false;
    },
  });
}

interface VariablesCapturar {
  productoCode: string;
  cantidadFinal: number;
}

export function useCapturarDiscrepancia(eventoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ productoCode, cantidadFinal }: VariablesCapturar) =>
      capturarDiscrepancia(eventoId, productoCode, cantidadFinal),
    onSettled: () => cliente.invalidateQueries({ queryKey: clavesCargas.discrepancias(eventoId) }),
  });
}

interface VariablesConfirmar {
  productoCode: string;
  cantidadFinal: number;
  pin: string;
}

export function useConfirmarDiscrepancia(eventoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ productoCode, cantidadFinal, pin }: VariablesConfirmar) =>
      confirmarDiscrepancia(eventoId, productoCode, cantidadFinal, pin),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: clavesCargas.discrepancias(eventoId) });
      void cliente.invalidateQueries({ queryKey: clavesCargas.conflictosPendientes });
    },
  });
}
