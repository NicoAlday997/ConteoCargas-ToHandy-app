import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RespuestaProductos } from '../api/cargas';

/**
 * Respaldo local del conteo en curso, para contar sin señal en bodega.
 *
 * Cada captura se guarda aquí ANTES de intentar enviarla, con la hora del
 * dispositivo (`capturadoEn`). El servidor sella aparte cuándo llegó: la
 * diferencia entre ambas es la ventana en que el dato vivió solo en el
 * teléfono, y queda a la vista en la auditoría.
 *
 * AsyncStorage y no SecureStore: son cantidades de producto, no credenciales,
 * y 73 productos rebasan el tamaño que SecureStore garantiza en Android.
 *
 * La clave lleva evento Y sesión: vendedor y contador cuentan el mismo evento
 * en sesiones distintas, y si compartieran teléfono sus conteos independientes
 * jamás deben mezclarse.
 */

export interface ItemLocal {
  productoCode: string;
  /**
   * `null` en los dos campos es un BORRADO: el producto se capturó y luego se
   * vació. Se conserva para que, al reconciliar, no reaparezca lo del servidor
   * como si nadie lo hubiera quitado.
   */
  paquetes: number | null;
  sueltas: number | null;
  /** ISO 8601, reloj del dispositivo. */
  capturadoEn: string;
  sincronizado: boolean;
  /** El servidor rechazó este valor por una regla de negocio: no se reintenta. */
  error: string | null;
}

export interface ConteoLocal {
  eventoId: string;
  sesionId: string;
  items: Readonly<Record<string, ItemLocal>>;
  /** Productos de la plantilla, para decir "llevas X de Y" sin red. */
  totalProductos: number | null;
  /** ISO 8601 del último envío aceptado. */
  ultimaSincronizacion: string | null;
}

export type ItemEnviado = Pick<ItemLocal, 'productoCode' | 'capturadoEn'>;

const PREFIJO = 'conteo_cargas';
const claveConteo = (eventoId: string, sesionId: string) => `${PREFIJO}:conteo_local:${eventoId}:${sesionId}`;
const claveProductos = (eventoId: string) => `${PREFIJO}:productos:${eventoId}`;

export function esBorrado(item: Pick<ItemLocal, 'paquetes' | 'sueltas'>): boolean {
  return item.paquetes === null && item.sueltas === null;
}

// ---------------------------------------------------------------------------
// Escrituras en serie por clave: un leer-modificar-escribir nunca pisa a otro.
// ---------------------------------------------------------------------------

const colasEscritura = new Map<string, Promise<unknown>>();

function enSerie<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
  const anterior = colasEscritura.get(clave) ?? Promise.resolve();
  const siguiente = anterior.catch(() => undefined).then(tarea);
  colasEscritura.set(clave, siguiente);
  return siguiente;
}

async function leerJson(clave: string): Promise<unknown> {
  try {
    const texto = await AsyncStorage.getItem(clave);
    return texto ? (JSON.parse(texto) as unknown) : null;
  } catch {
    return null;
  }
}

const esCantidad = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0);

/** Valida lo leído del almacenamiento: nunca confiar en un JSON guardado. */
function conteoDesdeJson(eventoId: string, sesionId: string, valor: unknown): ConteoLocal | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const crudo = valor as Record<string, unknown>;

  const items: Record<string, ItemLocal> = {};
  if (typeof crudo.items === 'object' && crudo.items !== null) {
    for (const [code, item] of Object.entries(crudo.items)) {
      if (typeof item !== 'object' || item === null) continue;
      const { paquetes, sueltas, capturadoEn, sincronizado, error } = item as Record<string, unknown>;
      if (!esCantidad(paquetes) || !esCantidad(sueltas)) continue;
      if (typeof capturadoEn !== 'string' || Number.isNaN(Date.parse(capturadoEn))) continue;
      items[code] = {
        productoCode: code,
        paquetes,
        sueltas,
        capturadoEn,
        sincronizado: sincronizado === true,
        error: typeof error === 'string' && error ? error : null,
      };
    }
  }

  return {
    eventoId,
    sesionId,
    items,
    totalProductos:
      typeof crudo.totalProductos === 'number' && Number.isInteger(crudo.totalProductos) ? crudo.totalProductos : null,
    ultimaSincronizacion: typeof crudo.ultimaSincronizacion === 'string' ? crudo.ultimaSincronizacion : null,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Reemplaza la copia local del evento. `items` es el estado completo (no un
 * delta), igual que el `PATCH` del servidor.
 */
export function guardarConteoLocal(
  eventoId: string,
  sesionId: string,
  items: Readonly<Record<string, ItemLocal>>,
  extra: Partial<Pick<ConteoLocal, 'totalProductos' | 'ultimaSincronizacion'>> = {},
): Promise<void> {
  const clave = claveConteo(eventoId, sesionId);
  return enSerie(clave, async () => {
    const previo = conteoDesdeJson(eventoId, sesionId, await leerJson(clave));
    const conteo: ConteoLocal = {
      eventoId,
      sesionId,
      items,
      totalProductos: extra.totalProductos ?? previo?.totalProductos ?? null,
      ultimaSincronizacion: extra.ultimaSincronizacion ?? previo?.ultimaSincronizacion ?? null,
    };
    await AsyncStorage.setItem(clave, JSON.stringify(conteo));
  });
}

export function obtenerConteoLocal(eventoId: string, sesionId: string): Promise<ConteoLocal | null> {
  const clave = claveConteo(eventoId, sesionId);
  // Espera escrituras en curso: leer a medias devolvería un estado viejo.
  return enSerie(clave, async () => conteoDesdeJson(eventoId, sesionId, await leerJson(clave)));
}

/**
 * Pura: marca como sincronizados los items enviados, pero SOLO si no cambiaron
 * mientras la petición iba en camino. Por eso recibe `capturadoEn` y no solo
 * el código: un producto recapturado durante el envío sigue pendiente.
 */
export function aplicarSincronizados(
  items: Readonly<Record<string, ItemLocal>>,
  enviados: readonly ItemEnviado[],
): Record<string, ItemLocal> {
  const resultado = { ...items };
  for (const { productoCode, capturadoEn } of enviados) {
    const actual = resultado[productoCode];
    if (actual && actual.capturadoEn === capturadoEn && !actual.error) {
      resultado[productoCode] = { ...actual, sincronizado: true };
    }
  }
  return resultado;
}

export function marcarSincronizados(
  eventoId: string,
  sesionId: string,
  enviados: readonly ItemEnviado[],
  sincronizadoEn: string,
): Promise<void> {
  const clave = claveConteo(eventoId, sesionId);
  return enSerie(clave, async () => {
    const conteo = conteoDesdeJson(eventoId, sesionId, await leerJson(clave));
    if (!conteo) return;
    const actualizado: ConteoLocal = {
      ...conteo,
      items: aplicarSincronizados(conteo.items, enviados),
      ultimaSincronizacion: sincronizadoEn,
    };
    await AsyncStorage.setItem(clave, JSON.stringify(actualizado));
  });
}

/** Solo tras finalizar la sesión con éxito: antes, esto es lo único que queda. */
export function limpiarConteoLocal(eventoId: string, sesionId: string): Promise<void> {
  const clave = claveConteo(eventoId, sesionId);
  return enSerie(clave, () => AsyncStorage.multiRemove([clave, claveProductos(eventoId)]));
}

// ---------------------------------------------------------------------------
// Lista de productos: sin ella no se puede contar si la app se reabre sin señal.
// ---------------------------------------------------------------------------

export async function guardarProductosLocal(eventoId: string, respuesta: RespuestaProductos): Promise<void> {
  await AsyncStorage.setItem(claveProductos(eventoId), JSON.stringify(respuesta));
}

/** La forma se valida después, en `normalizarProductos`: aquí solo se descarta lo que no es objeto. */
export async function obtenerProductosLocal(eventoId: string): Promise<RespuestaProductos | null> {
  const valor = await leerJson(claveProductos(eventoId));
  return typeof valor === 'object' && valor !== null ? (valor as RespuestaProductos) : null;
}
