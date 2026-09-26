import { obtenerEvento } from '../api/cargas';
import { ErrorApi } from '../api/cliente';
import { olvidarCarga, type CargaAbierta } from './almacen-conteo';
import { limpiarConteoLocal } from './almacen-local';
import { descartarCola } from './cola-sincronizacion';
import { vigenciaDesdeEstadoHttp, vigenciaDesdeEvento, type VigenciaCarga } from './vigencia-carga';

/**
 * La carga guardada en el teléfono puede desaparecer del servidor (se canceló,
 * o en pruebas se borró). Sin esto la app ofrecería "Continuar carga" para
 * siempre y el conteo fallaría al abrir, sin salida.
 */

/** Con señal agonizante no se deja al usuario esperando: se ofrece continuar y el conteo lo resuelve. */
const TIEMPO_LIMITE_VERIFICACION_MS = 8_000;

export interface VerificacionCarga {
  vigencia: VigenciaCarga;
  /** Estado del evento según el servidor; `null` si no se pudo saber (sin señal). */
  estado: string | null;
}

export async function verificarCargaAbierta(carga: CargaAbierta): Promise<VerificacionCarga | 'sesion-vencida'> {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), TIEMPO_LIMITE_VERIFICACION_MS);
  try {
    const respuesta = await obtenerEvento(carga.eventoId, control.signal);
    return { vigencia: vigenciaDesdeEvento(respuesta, carga.sesionId), estado: respuesta?.evento?.estado ?? null };
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 401) return 'sesion-vencida';
    return { vigencia: e instanceof ErrorApi ? vigenciaDesdeEstadoHttp(e.estado) : 'sin-verificar', estado: null };
  } finally {
    clearTimeout(limite);
  }
}

/** Lo contado de una carga que ya no existe no tiene a dónde ir: se borra del teléfono. */
export async function descartarCargaNoDisponible(
  usuarioId: string | null,
  carga: Pick<CargaAbierta, 'eventoId' | 'sesionId'>,
): Promise<void> {
  descartarCola(carga.eventoId, carga.sesionId);
  await (usuarioId ? olvidarCarga(usuarioId, carga) : limpiarConteoLocal(carga.eventoId, carga.sesionId)).catch(
    () => undefined,
  );
}

// Aviso para el inicio cuando el conteo es quien la descubre: vive en memoria,
// solo sirve para ese regreso.
let avisoPendiente = false;

export function avisarCargaNoDisponible(): void {
  avisoPendiente = true;
}

/** Lo entrega una sola vez. */
export function tomarAvisoCargaNoDisponible(): boolean {
  const aviso = avisoPendiente;
  avisoPendiente = false;
  return aviso;
}
