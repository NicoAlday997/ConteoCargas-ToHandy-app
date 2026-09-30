import type { TipoCarga } from '../api/cargas';
import type { EstadoCargaApi } from '../api/historial';
import { esDia, formatearDiaEnFrase } from '../conteo/fecha-operativa.ts';

/**
 * Recorrer las cargas de un día que no se trabajó (docs/01 §6 regla 10), sin
 * React: leer la previsualización del servidor y armar los textos.
 */

/** Una carga del día, como la manda `GET /admin/dias-no-laborables/:fecha/cargas`. */
export interface CargaDelDia {
  id: string;
  rutaNombre: string;
  vendedorNombre: string | null;
  tipo: TipoCarga | null;
  estado: EstadoCargaApi | null;
  totalProductos: number;
}

export interface PrevisualizacionRecorrido {
  /** `aaaa-mm-dd`. */
  fecha: string;
  /** Las que se mueven, ENVIADAS incluidas. */
  cargas: CargaDelDia[];
  /** Las que se quedan: canceladas o con el envío sin confirmar. */
  excluidas: CargaDelDia[];
  /** El siguiente día hábil; `null` si el servidor no encontró ninguno. */
  destinoSugerido: string | null;
}

/** Una ruta que ya tiene carga inicial en el día destino. */
export interface RutaEnConflicto {
  rutaNombre: string;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const entero = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

function normalizarCarga(fila: unknown): CargaDelDia | null {
  if (typeof fila !== 'object' || fila === null) return null;
  const f = fila as Record<string, unknown>;
  const id = texto(f.id);
  if (!id) return null;
  return {
    id,
    rutaNombre: texto(f.rutaNombre) ?? 'Ruta sin nombre',
    vendedorNombre: texto(f.vendedorNombre),
    tipo: f.tipo === 'INICIAL' || f.tipo === 'RECARGA' ? f.tipo : null,
    estado: (texto(f.estado) as EstadoCargaApi | null) ?? null,
    totalProductos: entero(f.totalProductos),
  };
}

function lista(valor: unknown): CargaDelDia[] {
  return Array.isArray(valor) ? valor.flatMap((f) => normalizarCarga(f) ?? []) : [];
}

/** Lee la respuesta a la defensiva: un renglón raro no rompe la hoja. */
export function normalizarPrevisualizacion(respuesta: unknown, fecha: string): PrevisualizacionRecorrido {
  const r = (typeof respuesta === 'object' && respuesta !== null ? respuesta : {}) as Record<string, unknown>;
  return {
    fecha,
    cargas: lista(r.cargas),
    excluidas: lista(r.excluidas),
    destinoSugerido: esDia(r.destinoSugerido) ? r.destinoSugerido : null,
  };
}

/** Las rutas de un 409 `CONFLICTO_EN_DESTINO`. */
export function rutasEnConflicto(cuerpo: unknown): RutaEnConflicto[] {
  const rutas = (cuerpo as { rutas?: unknown } | null)?.rutas;
  if (!Array.isArray(rutas)) return [];
  return rutas.flatMap((r) => {
    const nombre = texto((r as { rutaNombre?: unknown } | null)?.rutaNombre);
    return nombre ? [{ rutaNombre: nombre }] : [];
  });
}

const cargasEnPalabras = (n: number) => (n === 1 ? '1 carga' : `${n} cargas`);

/** "Este día tiene 6 cargas. ¿Las recorres al lunes 5?" */
export function preguntaRecorrer(cuantas: number, destino: string | null): string {
  const tiene = `Este día tiene ${cargasEnPalabras(cuantas)}.`;
  if (destino === null) return `${tiene} ¿A qué día las recorres?`;
  return `${tiene} ¿${cuantas === 1 ? 'La recorres' : 'Las recorres'} al ${formatearDiaEnFrase(destino)}?`;
}

/**
 * "La Ruta 3 ya tiene una carga inicial para el lunes 5. Resuélvela antes de
 * recorrer las demás." Con varias, las nombra todas.
 */
export function textoConflicto(rutas: readonly RutaEnConflicto[], destino: string): string {
  const dia = formatearDiaEnFrase(destino);
  if (rutas.length === 0) {
    return `Una ruta ya tiene una carga inicial para el ${dia}. Resuélvela antes de recorrer las demás.`;
  }
  if (rutas.length === 1) {
    return `La ${rutas[0].rutaNombre} ya tiene una carga inicial para el ${dia}. Resuélvela antes de recorrer las demás.`;
  }
  const nombres = rutas.map((r) => r.rutaNombre);
  const enLista = `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `${enLista} ya tienen una carga inicial para el ${dia}. Resuélvelas antes de recorrer las demás.`;
}

/** "Se recorrieron 6 cargas al lunes 5." */
export function textoRecorridas(movidas: number, destino: string): string {
  const dia = formatearDiaEnFrase(destino);
  return movidas === 1 ? `Se recorrió 1 carga al ${dia}.` : `Se recorrieron ${movidas} cargas al ${dia}.`;
}
