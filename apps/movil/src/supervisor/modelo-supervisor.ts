import type { CargaHistorialApi } from '../api/historial.ts';
import type { EventoConTiemposApi, ProductoRechazado } from '../api/supervisor.ts';
import { normalizarFila, type CargaDetalle, type FilaHistorial } from '../historial/modelo-historial.ts';

/**
 * Lo que el panel del supervisor necesita, ya validado. Una carga esperando
 * autorización frena al camión: la cola se ordena por quién lleva más tiempo
 * detenido, no por fecha operativa.
 */

// ---------------------------------------------------------------------------
// Cola de autorización
// ---------------------------------------------------------------------------

export interface CargaEnEspera extends FilaHistorial {
  /**
   * Desde cuándo espera (ms epoch): lo último que la dejó lista, el cierre de
   * un conteo o la confirmación de una diferencia. `null` si no se pudo saber.
   */
  esperaDesde: number | null;
}

/**
 * Desde cuándo espera la carga su autorización. NO es `fechaConteo` (cuándo se
 * empezó a contar): con esa casi toda carga aparecería detenida por horas. Es
 * el instante más reciente entre el cierre de las sesiones y la confirmación
 * de las diferencias, que es cuando dejó de depender de vendedor y contador.
 */
export function inicioEspera(tiempos: EventoConTiemposApi | null): number | null {
  let ultimo: number | null = null;
  const considerar = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isFinite(t) && (ultimo === null || t > ultimo)) ultimo = t;
  };
  for (const s of tiempos?.sesiones ?? []) considerar(s?.finalizadaEn);
  for (const d of tiempos?.discrepancias ?? []) considerar(d?.fechaConfirmacion);
  return ultimo;
}

/**
 * Las filas del historial, cada una con su espera, de la que más lleva
 * esperando a la más reciente. Sin espera conocida, al final: no se puede
 * afirmar que esté detenida.
 */
export function armarCola(
  filas: readonly CargaHistorialApi[],
  tiempos: ReadonlyMap<string, EventoConTiemposApi | null>,
): CargaEnEspera[] {
  const vistas = new Set<string>();
  const cola: CargaEnEspera[] = [];
  for (const api of filas) {
    const fila = normalizarFila(api);
    if (!fila || vistas.has(fila.id)) continue;
    vistas.add(fila.id);
    cola.push({ ...fila, esperaDesde: inicioEspera(tiempos.get(fila.id) ?? null) });
  }
  return cola.sort((a, b) => {
    if (a.esperaDesde === b.esperaDesde) return 0;
    if (a.esperaDesde === null) return 1;
    if (b.esperaDesde === null) return -1;
    return a.esperaDesde - b.esperaDesde;
  });
}

/** Cargas autorizadas que aún no llegan a Handy, del día más reciente al más viejo. */
export function armarPorEnviar(filas: readonly CargaHistorialApi[]): FilaHistorial[] {
  const vistas = new Set<string>();
  const resultado: FilaHistorial[] = [];
  for (const api of filas) {
    const fila = normalizarFila(api);
    if (!fila || vistas.has(fila.id)) continue;
    vistas.add(fila.id);
    resultado.push(fila);
  }
  // aaaa-mm-dd se ordena bien como texto. Sin fecha, al final.
  return resultado.sort((a, b) => (a.dia === b.dia ? 0 : a.dia === null ? 1 : b.dia === null ? -1 : a.dia < b.dia ? 1 : -1));
}

/** A partir de aquí la espera ya se nota en la bodega. */
export const MINUTOS_ATENCION = 20;
/** A partir de aquí el camión está detenido esperando: se destaca en rojo. */
export const MINUTOS_DETENIDA = 45;

/**
 * - reciente: acaba de llegar, sigue su curso.
 * - atencion: ya pesa.
 * - detenida: frena al camión.
 * - desconocida: no se pudo leer desde cuándo espera.
 */
export type NivelEspera = 'reciente' | 'atencion' | 'detenida' | 'desconocida';

/** Minutos enteros entre `desde` y `ahora`. Un reloj adelantado nunca da negativo. */
export function minutosEspera(desde: number | null, ahora: number): number | null {
  if (desde === null) return null;
  return Math.max(0, Math.floor((ahora - desde) / 60_000));
}

export function nivelEspera(minutos: number | null): NivelEspera {
  if (minutos === null) return 'desconocida';
  if (minutos >= MINUTOS_DETENIDA) return 'detenida';
  if (minutos >= MINUTOS_ATENCION) return 'atencion';
  return 'reciente';
}

/** "Menos de 1 min", "12 min", "1 h 5 min", "3 h", "2 días". */
export function textoEspera(minutos: number): string {
  if (minutos < 1) return 'Menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  }
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 día' : `${dias} días`;
}

// ---------------------------------------------------------------------------
// Rechazo de productos
// ---------------------------------------------------------------------------

/** El mismo mínimo que valida el servidor. */
export const MOTIVO_MINIMO = 3;

export function motivoValido(motivo: string): boolean {
  return motivo.trim().length >= MOTIVO_MINIMO;
}

/**
 * Lo marcado para rechazar, listo para enviarse: solo si hay al menos uno y
 * todos tienen motivo. Nunca la carga completa: solo lo que se marcó.
 */
export function rechazosParaEnviar(seleccion: Readonly<Record<string, string>>): ProductoRechazado[] | null {
  const productos = Object.entries(seleccion).map(([productoCode, motivo]) => ({ productoCode, motivo: motivo.trim() }));
  if (productos.length === 0 || productos.some((p) => !motivoValido(p.motivo))) return null;
  return productos;
}

// ---------------------------------------------------------------------------
// Envío a Handy
// ---------------------------------------------------------------------------

/**
 * Códigos que Handy rechazó cuando no aceptó ninguno: el 409 los trae en el
 * texto `detalle` ("Productos rechazados: A, B").
 */
export function codigosDeDetalle(detalle: string | null | undefined): string[] {
  const lista = detalle?.split(':').slice(1).join(':') ?? '';
  return lista
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Código → nombre del producto en la carga, para no mostrar códigos sueltos. Sin coincidencia, el código. */
export function nombresDeProductos(codes: readonly string[], carga: CargaDetalle | null): string[] {
  const nombres = new Map<string, string>();
  for (const familia of carga?.familias ?? []) {
    for (const p of familia.productos) nombres.set(p.code, p.nombre);
  }
  return codes.map((c) => nombres.get(c) ?? c);
}
