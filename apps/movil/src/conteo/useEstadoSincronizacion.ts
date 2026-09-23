import { useSyncExternalStore } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';

import { estaConectado, type ColaSincronizacion, type ErrorCola } from './cola-sincronizacion';

export interface EstadoSincronizacion {
  hayConexion: boolean;
  pendientes: number;
  sincronizando: boolean;
  /** ISO 8601 del último envío aceptado. */
  ultimaSincronizacion: string | null;
  fallidos: number;
  ultimoError: ErrorCola | null;
}

/** Estado de la red (NetInfo) junto con el de la cola de envío del conteo. */
export function useEstadoSincronizacion(cola: ColaSincronizacion): EstadoSincronizacion {
  const red = useNetInfo();
  const estado = useSyncExternalStore(cola.suscribir, cola.obtenerEstado);
  return {
    hayConexion: estaConectado(red),
    pendientes: estado.pendientes,
    sincronizando: estado.sincronizando,
    ultimaSincronizacion: estado.ultimaSincronizacion,
    fallidos: estado.fallidos,
    ultimoError: estado.ultimoError,
  };
}
