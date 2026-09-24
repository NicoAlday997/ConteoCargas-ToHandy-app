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
  /** Inicio del día para el que sale el camión, en hora de México (ISO 8601). */
  fechaOperativa: string | null;
  /**
   * Id en Handy de la ruta anterior que seguía sin liquidar al iniciar esta
   * carga inicial: solo pasa con permiso del supervisor. `null` si no.
   */
  rutaHandySinLiquidarId?: string | null;
  /** Handy no respondió al revisar la liquidación anterior y se dejó iniciar igual. */
  liquidacionNoVerificada?: boolean | null;
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

/** `GET /eventos-carga/:id`. Al vendedor solo le responde si contó en él. */
export interface RespuestaEvento {
  evento: EventoCargaApi | null;
  sesiones: SesionConteoApi[] | null;
}

/** 409 de `POST /eventos-carga`: la ruta ya tiene carga inicial para ese día. */
export const CODIGO_YA_TIENE_CARGA = 'YA_TIENE_CARGA_ABIERTA';
/** 400 de `POST /eventos-carga`: la fecha es un día pasado (reloj del teléfono atrasado). */
export const CODIGO_FECHA_INVALIDA = 'FECHA_OPERATIVA_INVALIDA';
/**
 * 409 de `POST /eventos-carga` (solo carga inicial): el vendedor tiene una
 * ruta abierta en Handy y la ruta no tiene permiso vigente del supervisor.
 */
export const CODIGO_RUTA_SIN_LIQUIDAR = 'RUTA_ANTERIOR_SIN_LIQUIDAR';

/**
 * Cómo arrancó la carga respecto a la liquidación de la ruta anterior:
 * `permiso` = seguía sin liquidar y la autorizó un supervisor;
 * `no-verificada` = Handy no respondió y se dejó pasar; `normal` = nada que avisar.
 */
export type InicioCarga = 'permiso' | 'no-verificada' | 'normal';

export function esInicioCarga(valor: unknown): valor is InicioCarga {
  return valor === 'permiso' || valor === 'no-verificada' || valor === 'normal';
}

/** `null` si el evento no trae con qué decidirlo (servidor viejo o respuesta rara). */
export function inicioDeEvento(evento: EventoCargaApi | null | undefined): InicioCarga | null {
  if (!evento) return null;
  if (evento.rutaHandySinLiquidarId) return 'permiso';
  if (evento.liquidacionNoVerificada === true) return 'no-verificada';
  if (evento.liquidacionNoVerificada === false) return 'normal';
  return null;
}

export interface ProductoApi {
  code: string | null;
  nombre: string | null;
  unidadCode: string | null;
  unidadDescripcion: string | null;
  familia: string | null;
  modalidadVenta: string | null;
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

/** `fechaOperativa` en `aaaa-mm-dd`: el día que eligió quien cuenta. */
export function iniciarCarga(tipo: TipoCarga, fechaOperativa: string): Promise<RespuestaIniciarCarga | null> {
  return peticion<RespuestaIniciarCarga | null>('/eventos-carga', {
    method: 'POST',
    cuerpo: { tipo, fechaOperativa },
  });
}

export function obtenerEvento(eventoId: string): Promise<RespuestaEvento | null> {
  return peticion<RespuestaEvento | null>(`/eventos-carga/${encodeURIComponent(eventoId)}`);
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

// ---------------------------------------------------------------------------
// Verificación (segundo conteo) y resolución de discrepancias
// ---------------------------------------------------------------------------

export type EstadoVerificacion = 'LISTA' | 'BLOQUEADA_CORTE_PENDIENTE' | 'EN_CURSO_PROPIA' | 'EN_CURSO_OTRO';

/** Fila de `GET /eventos-carga/pendientes-verificacion`. Nunca trae cantidades del vendedor. */
export interface CargaPendienteApi {
  id: string | null;
  rutaNombre: string | null;
  vendedorNombre: string | null;
  tipo: TipoCarga | null;
  fechaConteo: string | null;
  totalProductos: number | null;
  bloqueadaPorCorte: boolean | null;
  estadoVerificacion: EstadoVerificacion | null;
  miSesionId: string | null;
  verificandoPor: string | null;
}

/** Fila de `GET /eventos-carga/conflictos-pendientes`. */
export interface CargaConConflictosApi {
  id: string | null;
  rutaNombre: string | null;
  tipo: TipoCarga | null;
  fechaConteo: string | null;
  totalDiscrepancias: number | null;
  resueltas: number | null;
}

export interface DiscrepanciaApi {
  productoCode: string | null;
  productoNombre: string | null;
  unidadDescripcion: string | null;
  modalidadVenta: string | null;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
  /** Primer conteo (el vendedor en autoventa), en piezas. */
  cantidadVendedorOriginal: number | null;
  /** Segundo conteo (el contador en autoventa), en piezas. */
  cantidadContadorOriginal: number | null;
  cantidadFinal: number | null;
  capturadaPor: string | null;
  capturadaPorNombre: string | null;
  fechaCaptura: string | null;
  confirmadaPor: string | null;
  confirmadaPorNombre: string | null;
  fechaConfirmacion: string | null;
  primerConteo?: LadoDiscrepanciaApi | null;
  segundoConteo?: LadoDiscrepanciaApi | null;
}

/** Quién contó (por tipo de sesión, nunca por nombre) y lo que tecleó. */
export interface LadoDiscrepanciaApi {
  tipoSesion: string | null;
  paquetes: number | null;
  sueltas: number | null;
}

export interface RespuestaDesbloquear {
  sigueBloqueado: boolean | null;
  mensaje?: string | null;
}

export interface RespuestaConfirmarDiscrepancia {
  enEsperaAutorizacion: boolean | null;
}

const rutaEvento = (eventoId: string) => `/eventos-carga/${encodeURIComponent(eventoId)}`;

export async function listarPendientesVerificacion(): Promise<CargaPendienteApi[]> {
  const filas = await peticion<CargaPendienteApi[] | null>('/eventos-carga/pendientes-verificacion');
  return Array.isArray(filas) ? filas : [];
}

export async function listarConflictosPendientes(): Promise<CargaConConflictosApi[]> {
  const filas = await peticion<CargaConConflictosApi[] | null>('/eventos-carga/conflictos-pendientes');
  return Array.isArray(filas) ? filas : [];
}

export function desbloquearCarga(eventoId: string): Promise<RespuestaDesbloquear | null> {
  return peticion<RespuestaDesbloquear | null>(`${rutaEvento(eventoId)}/desbloquear`, { method: 'POST', cuerpo: {} });
}

export async function obtenerDiscrepancias(eventoId: string): Promise<DiscrepanciaApi[]> {
  const filas = await peticion<DiscrepanciaApi[] | null>(`${rutaEvento(eventoId)}/discrepancias`);
  return Array.isArray(filas) ? filas : [];
}

const rutaDiscrepancia = (eventoId: string, productoCode: string) =>
  `${rutaEvento(eventoId)}/discrepancias/${encodeURIComponent(productoCode)}`;

/** La cantidad final va en piezas: la app ya la convirtió con el mismo factor que el conteo. */
export function capturarDiscrepancia(eventoId: string, productoCode: string, cantidadFinal: number): Promise<unknown> {
  return peticion<unknown>(`${rutaDiscrepancia(eventoId, productoCode)}/capturar`, {
    method: 'POST',
    cuerpo: { cantidadFinal },
  });
}

/**
 * `cantidadFinal` es la que la persona tiene a la vista: si alguien la recapturó
 * mientras tecleaba su PIN, el servidor rechaza (409 `CANTIDAD_CAMBIO`).
 */
export function confirmarDiscrepancia(
  eventoId: string,
  productoCode: string,
  cantidadFinal: number,
  pin: string,
): Promise<RespuestaConfirmarDiscrepancia | null> {
  return peticion<RespuestaConfirmarDiscrepancia | null>(`${rutaDiscrepancia(eventoId, productoCode)}/confirmar`, {
    method: 'POST',
    cuerpo: { cantidadFinal, pin },
  });
}
