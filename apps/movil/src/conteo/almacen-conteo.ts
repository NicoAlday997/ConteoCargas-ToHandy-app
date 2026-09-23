import AsyncStorage from '@react-native-async-storage/async-storage';

import { esTipoCarga, type TipoCarga } from '../api/cargas';
import { limpiarConteoLocal } from './almacen-local';

/**
 * Qué carga dejó a medias cada usuario en este dispositivo, para ofrecerle
 * "Continuar carga" al volver a entrar. Las cantidades viven aparte, en
 * `almacen-local`.
 */

/** Carga que el usuario dejó a medias en este dispositivo. */
export interface CargaAbierta {
  eventoId: string;
  sesionId: string;
  tipo: TipoCarga | null;
}

const PREFIJO = 'conteo_cargas';
const claveCarga = (usuarioId: string) => `${PREFIJO}:carga_abierta:${usuarioId}`;

async function leerJson(clave: string): Promise<unknown> {
  try {
    const texto = await AsyncStorage.getItem(clave);
    return texto ? (JSON.parse(texto) as unknown) : null;
  } catch {
    return null;
  }
}

export async function guardarCargaAbierta(usuarioId: string, carga: CargaAbierta): Promise<void> {
  await AsyncStorage.setItem(claveCarga(usuarioId), JSON.stringify(carga));
}

export async function obtenerCargaAbierta(usuarioId: string): Promise<CargaAbierta | null> {
  const valor = await leerJson(claveCarga(usuarioId));
  if (typeof valor !== 'object' || valor === null) return null;
  const { eventoId, sesionId, tipo } = valor as Record<string, unknown>;
  if (typeof eventoId !== 'string' || !eventoId || typeof sesionId !== 'string' || !sesionId) return null;
  return { eventoId, sesionId, tipo: esTipoCarga(tipo) ? tipo : null };
}

/** Al finalizar: la sesión ya quedó cerrada en el servidor. */
export async function olvidarCarga(usuarioId: string, carga: Pick<CargaAbierta, 'eventoId' | 'sesionId'>): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(claveCarga(usuarioId)), limpiarConteoLocal(carga.eventoId, carga.sesionId)]);
}
