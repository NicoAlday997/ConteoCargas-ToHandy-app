import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { guardarItems, obtenerItemsSesion, type ItemEnvio, type ItemGuardadoApi } from '../api/cargas';
import { ErrorApi, ErrorRed } from '../api/cliente';
import {
  aplicarSincronizados,
  esBorrado,
  guardarConteoLocal,
  marcarSincronizados,
  obtenerConteoLocal,
  type ItemEnviado,
  type ItemLocal,
} from './almacen-local';
import type { CapturaProducto, EstadoConteo } from './estado-conteo';

/**
 * Cola de envío del conteo al servidor, pensada para una bodega con señal
 * irregular.
 *
 * - Primero local, luego red: cada captura se escribe en el dispositivo y solo
 *   después se intenta enviar.
 * - `PATCH .../items` reemplaza la sesión completa, así que la "cola" no manda
 *   deltas: cada envío lleva el conteo entero y marca como sincronizados los
 *   items que no cambiaron mientras iba en camino.
 * - Antes del primer envío se reconcilia con lo que el servidor ya tiene: una
 *   copia local incompleta (otro teléfono, datos borrados) borraría en el
 *   servidor lo ya contado.
 * - Fallas transitorias (red, 5xx) se reintentan con espera creciente; un
 *   rechazo por regla de negocio marca esos productos como fallidos y NO se
 *   reintenta hasta que el usuario los recapture.
 */

/** 2s, 5s, 15s, 30s y después cada minuto. */
const ESPERAS_MS = [2_000, 5_000, 15_000, 30_000] as const;
const ESPERA_MAXIMA_MS = 60_000;
/** Sin límite, un `fetch` con señal agonizante puede colgarse minutos. */
const TIEMPO_LIMITE_PETICION_MS = 20_000;

export type ErrorCola =
  /** Transitorio: se reintenta solo. */
  | { tipo: 'red'; mensaje: string }
  /** El token venció: no tiene caso reintentar hasta volver a entrar. */
  | { tipo: 'sesion-expirada'; mensaje: string }
  /** El servidor rechazó la sesión o el cuerpo entero: reintentar lo mismo no sirve. */
  | { tipo: 'rechazo'; mensaje: string };

export interface EstadoCola {
  /** `false` mientras se lee la copia local: nada se captura antes de tenerla. */
  cargado: boolean;
  items: Readonly<Record<string, ItemLocal>>;
  /** Cambios guardados solo en el dispositivo, todavía por llegar al servidor. */
  pendientes: number;
  /** Productos que el servidor rechazó por una regla de negocio. */
  fallidos: number;
  sincronizando: boolean;
  ultimoError: ErrorCola | null;
  /** ISO 8601 del último envío aceptado. */
  ultimaSincronizacion: string | null;
}

function contar(items: Readonly<Record<string, ItemLocal>>) {
  let pendientes = 0;
  let fallidos = 0;
  for (const item of Object.values(items)) {
    if (item.error) fallidos += 1;
    else if (!item.sincronizado) pendientes += 1;
  }
  return { pendientes, fallidos };
}

function esTransitorio(error: unknown): boolean {
  if (error instanceof ErrorRed) return true;
  return error instanceof ErrorApi && (error.estado >= 500 || error.estado === 408 || error.estado === 429);
}

/** Códigos que el servidor señaló en un rechazo por regla de negocio (409/404 del PATCH). */
function productosRechazados(error: unknown): string[] {
  if (!(error instanceof ErrorApi) || (error.estado !== 409 && error.estado !== 404)) return [];
  const productos = error.cuerpo?.productos;
  return Array.isArray(productos) ? productos.filter((p): p is string => typeof p === 'string') : [];
}

export function estaConectado(estado: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  // `null` es "aún no se sabe": no se alarma al usuario por eso.
  return estado.isConnected !== false && estado.isInternetReachable !== false;
}

function tiempo(iso: string | null | undefined): number {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Une la copia local con lo que tiene el servidor. Por producto:
 * - Si coinciden en valor, queda sincronizado.
 * - Si difieren, gana el más reciente por `capturadoEn` (el del servidor sin
 *   esa fecha, anterior a este campo, pierde siempre). Si gana lo local,
 *   queda pendiente de reenviar.
 * - Lo local que el servidor no tiene se reenvía, aunque figurara como
 *   sincronizado (el `PATCH` lo borraría si no).
 */
export function reconciliar(
  locales: Readonly<Record<string, ItemLocal>>,
  servidor: readonly ItemGuardadoApi[],
): Record<string, ItemLocal> {
  const resultado: Record<string, ItemLocal> = {};
  const delServidor = new Map<string, ItemGuardadoApi>();
  for (const item of servidor) {
    if (item.productoCode) delServidor.set(item.productoCode, item);
  }

  for (const [code, local] of Object.entries(locales)) {
    const remoto = delServidor.get(code);
    if (!remoto) {
      resultado[code] = local.error ? local : { ...local, sincronizado: esBorrado(local) };
      continue;
    }
    const mismoValor =
      !esBorrado(local) && (local.paquetes ?? 0) === (remoto.paquetes ?? 0) && (local.sueltas ?? 0) === (remoto.sueltas ?? 0);
    if (mismoValor) {
      resultado[code] = local.error ? local : { ...local, sincronizado: true };
    } else if (tiempo(local.capturadoEn) >= tiempo(remoto.capturadoEn)) {
      resultado[code] = { ...local, sincronizado: false };
    } else {
      resultado[code] = itemDesdeServidor(code, remoto);
    }
  }

  for (const [code, remoto] of delServidor) {
    if (!(code in resultado)) resultado[code] = itemDesdeServidor(code, remoto);
  }
  return resultado;
}

function itemDesdeServidor(code: string, remoto: ItemGuardadoApi): ItemLocal {
  return {
    productoCode: code,
    paquetes: remoto.paquetes ?? 0,
    sueltas: remoto.sueltas ?? 0,
    capturadoEn: remoto.capturadoEn ?? remoto.recibidoEn ?? new Date(0).toISOString(),
    sincronizado: true,
    error: null,
  };
}

/** Cuerpo del `PATCH`: todo lo capturado, sin borrados ni lo que el servidor ya rechazó. */
function itemsParaEnviar(items: Readonly<Record<string, ItemLocal>>): ItemEnvio[] {
  const envio: ItemEnvio[] = [];
  for (const item of Object.values(items)) {
    if (item.error || esBorrado(item)) continue;
    envio.push({
      productoCode: item.productoCode,
      paquetes: item.paquetes ?? 0,
      sueltas: item.sueltas ?? 0,
      capturadoEn: item.capturadoEn,
    });
  }
  return envio;
}

/** Lo que ve la pantalla: las capturas vigentes, sin los borrados. */
export function conteoDesdeItems(items: Readonly<Record<string, ItemLocal>>): EstadoConteo {
  const conteo: Record<string, CapturaProducto> = {};
  for (const item of Object.values(items)) {
    if (!esBorrado(item)) conteo[item.productoCode] = { paquetes: item.paquetes, sueltas: item.sueltas };
  }
  return conteo;
}

type Oyente = () => void;

export class ColaSincronizacion {
  private estado: EstadoCola = {
    cargado: false,
    items: {},
    pendientes: 0,
    fallidos: 0,
    sincronizando: false,
    ultimoError: null,
    ultimaSincronizacion: null,
  };
  private readonly oyentes = new Set<Oyente>();
  private reconciliado = false;
  private detenida = false;
  private corriendo = false;
  private repetir = false;
  private intentos = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private escrituras: Promise<void> = Promise.resolve();
  private readonly carga: Promise<void>;

  constructor(
    readonly eventoId: string,
    readonly sesionId: string,
  ) {
    this.carga = this.cargar();
  }

  // ---- Suscripción (useSyncExternalStore) ---------------------------------

  suscribir = (oyente: Oyente): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  obtenerEstado = (): EstadoCola => this.estado;

  private fijar(cambios: Partial<EstadoCola>): void {
    const siguiente = { ...this.estado, ...cambios };
    if (cambios.items) Object.assign(siguiente, contar(cambios.items));
    this.estado = siguiente;
    for (const oyente of this.oyentes) oyente();
  }

  // ---- Local --------------------------------------------------------------

  private async cargar(): Promise<void> {
    const local = await obtenerConteoLocal(this.eventoId, this.sesionId).catch(() => null);
    if (this.detenida) return;
    this.fijar({
      cargado: true,
      items: local?.items ?? {},
      ultimaSincronizacion: local?.ultimaSincronizacion ?? null,
    });
    this.sincronizar();
  }

  /** Encadena la escritura: el envío espera a que lo último ya esté en disco. */
  private persistir(extra?: { totalProductos?: number }): Promise<void> {
    const items = this.estado.items;
    this.escrituras = this.escrituras
      .then(() => guardarConteoLocal(this.eventoId, this.sesionId, items, extra))
      // Si el disco falla se sigue intentando enviar: perder el dato dos veces sería peor.
      .catch(() => undefined);
    return this.escrituras;
  }

  /**
   * Registra una captura del usuario. `SIN_CAPTURA` (ambos `null`) es borrar.
   * Recapturar un producto rechazado limpia su error: el valor nuevo se envía.
   */
  capturar(productoCode: string, captura: CapturaProducto): void {
    if (this.detenida || !this.estado.cargado) return;
    const item: ItemLocal = {
      productoCode,
      paquetes: captura.paquetes,
      sueltas: captura.sueltas,
      capturadoEn: new Date().toISOString(),
      sincronizado: false,
      error: null,
    };
    this.fijar({ items: { ...this.estado.items, [productoCode]: item } });
    void this.persistir().then(() => this.sincronizar());
  }

  fijarTotalProductos(total: number): void {
    if (this.detenida || !this.estado.cargado) return;
    void this.persistir({ totalProductos: total });
  }

  // ---- Red ----------------------------------------------------------------

  /** Envía ya, sin esperar el reintento programado. */
  sincronizarAhora(): void {
    this.intentos = 0;
    if (this.estado.ultimoError?.tipo === 'rechazo') this.fijar({ ultimoError: null });
    this.sincronizar();
  }

  alReconectar(): void {
    if (this.estado.ultimoError?.tipo === 'sesion-expirada') return;
    this.sincronizarAhora();
  }

  private sincronizar(): void {
    if (this.detenida || !this.estado.cargado) return;
    if (this.corriendo) {
      this.repetir = true;
      return;
    }
    this.cancelarReintento();
    this.corriendo = true;
    void this.ejecutar().finally(() => {
      this.corriendo = false;
      if (this.repetir) {
        this.repetir = false;
        this.sincronizar();
      }
    });
  }

  private async ejecutar(): Promise<void> {
    const bloqueo = this.estado.ultimoError?.tipo;
    if (bloqueo === 'sesion-expirada' || bloqueo === 'rechazo') return;
    if (this.reconciliado && this.estado.pendientes === 0) return;

    await this.carga;
    await this.escrituras;
    if (this.detenida) return;

    this.fijar({ sincronizando: true });
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_PETICION_MS);
    try {
      if (!this.reconciliado) {
        const respuesta = await obtenerItemsSesion(this.eventoId, this.sesionId, controlador.signal);
        if (this.detenida) return;
        this.reconciliado = true;
        this.fijar({ items: reconciliar(this.estado.items, respuesta?.items ?? []) });
        await this.persistir();
        if (this.estado.pendientes === 0) {
          this.exito();
          return;
        }
      }

      const enviados: ItemEnviado[] = Object.values(this.estado.items)
        .filter((i) => !i.sincronizado && !i.error)
        .map(({ productoCode, capturadoEn }) => ({ productoCode, capturadoEn }));
      await guardarItems(this.eventoId, this.sesionId, itemsParaEnviar(this.estado.items), controlador.signal);
      if (this.detenida) return;

      const ahora = new Date().toISOString();
      this.fijar({ items: aplicarSincronizados(this.estado.items, enviados), ultimaSincronizacion: ahora });
      await marcarSincronizados(this.eventoId, this.sesionId, enviados, ahora).catch(() => undefined);
      this.exito();
      // Lo capturado durante el envío sale en la siguiente vuelta.
      if (this.estado.pendientes > 0) this.repetir = true;
    } catch (error) {
      if (!this.detenida) this.fallo(error);
    } finally {
      clearTimeout(limite);
      if (!this.detenida) this.fijar({ sincronizando: false });
    }
  }

  private exito(): void {
    this.intentos = 0;
    this.fijar({ ultimoError: null });
  }

  private fallo(error: unknown): void {
    if (esTransitorio(error)) {
      this.fijar({ ultimoError: { tipo: 'red', mensaje: 'Sin conexión con el servidor' } });
      this.programarReintento();
      return;
    }
    if (error instanceof ErrorApi && error.estado === 401) {
      this.fijar({ ultimoError: { tipo: 'sesion-expirada', mensaje: 'Tu sesión venció' } });
      return;
    }

    const mensaje = error instanceof Error && error.message ? error.message : 'El servidor no aceptó el conteo.';
    const items = { ...this.estado.items };
    let marcados = 0;
    for (const code of productosRechazados(error)) {
      const item = items[code];
      if (item && !item.error) {
        items[code] = { ...item, sincronizado: false, error: mensaje };
        marcados += 1;
      }
    }
    if (marcados > 0) {
      // Solo esos productos quedan fuera; el resto se envía de inmediato sin ellos.
      this.fijar({ items, ultimoError: null });
      void this.persistir();
      this.repetir = true;
      return;
    }
    this.fijar({ ultimoError: { tipo: 'rechazo', mensaje } });
  }

  private programarReintento(): void {
    const espera = ESPERAS_MS[this.intentos] ?? ESPERA_MAXIMA_MS;
    this.intentos += 1;
    this.cancelarReintento();
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.sincronizar();
    }, espera);
  }

  private cancelarReintento(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  /** Deja de enviar. Lo que haya en el dispositivo se queda ahí. */
  detener(): void {
    this.detenida = true;
    this.cancelarReintento();
  }
}

// ---------------------------------------------------------------------------
// Registro: una cola por sesión, viva aunque se salga de la pantalla de conteo.
// ---------------------------------------------------------------------------

const colas = new Map<string, ColaSincronizacion>();
let dejarDeVigilarRed: (() => void) | null = null;
let conectadoAntes: boolean | null = null;

/** Al volver la señal se vacían las colas sin esperar el reintento programado. */
function vigilarRed(): void {
  if (dejarDeVigilarRed) return;
  dejarDeVigilarRed = NetInfo.addEventListener((estado) => {
    const conectado = estaConectado(estado);
    if (conectado && conectadoAntes === false) {
      for (const cola of colas.values()) cola.alReconectar();
    }
    conectadoAntes = conectado;
  });
}

export function obtenerCola(eventoId: string, sesionId: string): ColaSincronizacion {
  const clave = `${eventoId}:${sesionId}`;
  let cola = colas.get(clave);
  // Una cola frenada por token vencido se rehace al volver a entrar.
  if (cola?.obtenerEstado().ultimoError?.tipo === 'sesion-expirada') {
    cola.detener();
    cola = undefined;
  }
  if (!cola) {
    cola = new ColaSincronizacion(eventoId, sesionId);
    colas.set(clave, cola);
  }
  vigilarRed();
  return cola;
}

/** Tras finalizar la sesión: ya no hay nada que enviar. */
export function descartarCola(eventoId: string, sesionId: string): void {
  const clave = `${eventoId}:${sesionId}`;
  colas.get(clave)?.detener();
  colas.delete(clave);
}

/** Al cerrar sesión: sin token no hay envío posible; se retoma al volver a abrir el conteo. */
export function detenerColas(): void {
  for (const cola of colas.values()) cola.detener();
  colas.clear();
  dejarDeVigilarRed?.();
  dejarDeVigilarRed = null;
  conectadoAntes = null;
}
