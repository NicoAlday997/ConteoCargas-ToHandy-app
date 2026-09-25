import { peticion } from './cliente';
import type { EstadoCargaApi, PaginaHistorialApi } from './historial';

/**
 * Autorización y envío a Handy (docs/04 §1.4). Autorizar, rechazar y modificar
 * son solo del Supervisor; enviar lo acepta el servidor de los tres roles. La
 * app nunca habla con Handy: el backend es el único que tiene su token.
 */

/** El máximo que acepta el servidor; con 5 rutas nunca hay tantas esperando. */
const TAMANO_PAGINA = 100;

/** Cargas en un estado, de todas las rutas (el supervisor ve todo el historial). */
export async function listarCargasPorEstado(estado: EstadoCargaApi): Promise<PaginaHistorialApi | null> {
  return peticion<PaginaHistorialApi | null>(`/historial?estado=${estado}&page=1&pageSize=${TAMANO_PAGINA}`);
}

/**
 * Lo que `GET /eventos-carga/:id` trae para saber desde cuándo espera una
 * carga: el último conteo cerrado o la última diferencia confirmada.
 */
export interface EventoConTiemposApi {
  evento: { estado: EstadoCargaApi | null } | null;
  sesiones: { finalizadaEn: string | null }[] | null;
  discrepancias: { fechaConfirmacion: string | null }[] | null;
}

export function obtenerTiemposEvento(eventoId: string): Promise<EventoConTiemposApi | null> {
  return peticion<EventoConTiemposApi | null>(`/eventos-carga/${encodeURIComponent(eventoId)}`);
}

const rutaEvento = (eventoId: string) => `/eventos-carga/${encodeURIComponent(eventoId)}`;

export function autorizarCarga(eventoId: string): Promise<unknown> {
  return peticion<unknown>(`${rutaEvento(eventoId)}/autorizar`, { method: 'POST', cuerpo: {} });
}

export interface ProductoRechazado {
  productoCode: string;
  motivo: string;
}

/** Solo los productos indicados vuelven a resolverse; nunca la carga completa. */
export function rechazarProductos(eventoId: string, productos: readonly ProductoRechazado[]): Promise<unknown> {
  return peticion<unknown>(`${rutaEvento(eventoId)}/rechazar-productos`, { method: 'POST', cuerpo: { productos } });
}

/**
 * La cantidad va en piezas. No queda aplicada: el servidor la deja capturada
 * por el supervisor y sin confirmar, y la carga vuelve a diferencias por
 * resolver hasta que el vendedor o el contador la confirmen con su PIN.
 */
export function modificarCantidad(eventoId: string, productoCode: string, cantidadNueva: number, motivo: string): Promise<unknown> {
  return peticion<unknown>(`${rutaEvento(eventoId)}/productos/${encodeURIComponent(productoCode)}/modificar`, {
    method: 'POST',
    cuerpo: { cantidadNueva, motivo },
  });
}

export interface RespuestaEnviarApi {
  idHandy: string | null;
  /** La ruta ya existía en Handy de un intento anterior incierto: no se reenvió nada. */
  yaExistia: boolean | null;
  /** Códigos que Handy rechazó por inventario; el resto sí se envió. */
  productosRechazados: string[] | null;
}

export function enviarCarga(eventoId: string): Promise<RespuestaEnviarApi | null> {
  return peticion<RespuestaEnviarApi | null>(`${rutaEvento(eventoId)}/enviar`, { method: 'POST', cuerpo: {} });
}
