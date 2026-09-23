import { peticion } from './cliente';

export type TipoCarga = 'INICIAL' | 'RECARGA';

export const ETIQUETAS_TIPO_CARGA: Record<TipoCarga, string> = {
  INICIAL: 'Carga inicial',
  RECARGA: 'Recarga',
};

export function esTipoCarga(valor: unknown): valor is TipoCarga {
  return valor === 'INICIAL' || valor === 'RECARGA';
}

/** Vista del evento tal como la devuelve el backend. */
export interface EventoCargaApi {
  id: string | null;
  rutaId: string | null;
  plantillaId: string | null;
  tipo: TipoCarga | null;
  estado: string | null;
  fechaConteo: string | null;
  creadoEn: string | null;
}

export interface SesionConteoApi {
  id: string | null;
  eventoCargaId: string | null;
  tipo: string | null;
  usuarioAppId: string | null;
  estado: 'ABIERTA' | 'CERRADA' | null;
  iniciadaEn: string | null;
  finalizadaEn: string | null;
}

/** `POST /eventos-carga` crea el evento y, de una vez, la sesión del vendedor. */
export interface RespuestaIniciarCarga {
  evento: EventoCargaApi | null;
  sesion: SesionConteoApi | null;
}

export interface ProductoApi {
  code: string | null;
  nombre: string | null;
  unidadCode: string | null;
  familia: string | null;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
}

export interface FamiliaApi {
  familia: string | null;
  productos: ProductoApi[] | null;
}

export interface RespuestaProductos {
  plantillaId: string | null;
  familias: FamiliaApi[] | null;
}

/** Lo que se contó en bodega. El total en piezas lo calcula el backend. */
export interface ItemEnvio {
  productoCode: string;
  paquetes: number;
  sueltas: number;
  /** ISO 8601, reloj del dispositivo al capturar. El servidor sella aparte cuándo llegó. */
  capturadoEn?: string;
}

export interface ItemGuardadoApi {
  productoCode: string | null;
  paquetes: number | null;
  sueltas: number | null;
  cantidad: number | null;
  capturadoEn: string | null;
  recibidoEn: string | null;
  sueltasExcedenPaquete: boolean | null;
}

/** `GET .../items`: lo que el servidor tiene de la sesión. */
export interface RespuestaItemsSesion {
  items: ItemGuardadoApi[] | null;
}

export interface RespuestaGuardarItems {
  sesion: SesionConteoApi | null;
  items: ItemGuardadoApi[] | null;
}

export interface RespuestaFinalizarSesion {
  evento: EventoCargaApi | null;
  sesion: SesionConteoApi | null;
  discrepancias: unknown[] | null;
}

export function iniciarCarga(tipo: TipoCarga): Promise<RespuestaIniciarCarga | null> {
  return peticion<RespuestaIniciarCarga | null>('/eventos-carga', {
    method: 'POST',
    cuerpo: { tipo },
  });
}

export function obtenerProductos(eventoId: string): Promise<RespuestaProductos | null> {
  return peticion<RespuestaProductos | null>(`/eventos-carga/${encodeURIComponent(eventoId)}/productos`);
}

export function abrirSesion(eventoId: string): Promise<SesionConteoApi | null> {
  return peticion<SesionConteoApi | null>(`/eventos-carga/${encodeURIComponent(eventoId)}/sesiones`, {
    method: 'POST',
    cuerpo: {},
  });
}

const rutaItems = (eventoId: string, sesionId: string) =>
  `/eventos-carga/${encodeURIComponent(eventoId)}/sesiones/${encodeURIComponent(sesionId)}/items`;

/** Reemplazo total: un producto que no venga en `items` se borra de la sesión. */
export function guardarItems(
  eventoId: string,
  sesionId: string,
  items: readonly ItemEnvio[],
  signal?: AbortSignal,
): Promise<RespuestaGuardarItems | null> {
  return peticion<RespuestaGuardarItems | null>(rutaItems(eventoId, sesionId), {
    method: 'PATCH',
    cuerpo: { items },
    signal,
  });
}

export function obtenerItemsSesion(
  eventoId: string,
  sesionId: string,
  signal?: AbortSignal,
): Promise<RespuestaItemsSesion | null> {
  return peticion<RespuestaItemsSesion | null>(rutaItems(eventoId, sesionId), { signal });
}

export function finalizarSesion(eventoId: string, sesionId: string): Promise<RespuestaFinalizarSesion | null> {
  return peticion<RespuestaFinalizarSesion | null>(
    `/eventos-carga/${encodeURIComponent(eventoId)}/sesiones/${encodeURIComponent(sesionId)}/finalizar`,
    { method: 'POST', cuerpo: {} },
  );
}
