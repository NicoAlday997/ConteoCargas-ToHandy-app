import type { FactorPendienteApi, ModalidadVentaApi } from '../api/factores';

/**
 * Lo que la pantalla de empaques necesita, ya validado. La regla que protege
 * aquí es la del caso CANELS c/70: el número del nombre es solo una sugerencia
 * para lo que se vende por pieza; lo que se vende completo se envía 1 a 1.
 */

/** Los mismos límites que valida el servidor. */
export const PIEZAS_MINIMO = 1;
export const PIEZAS_MAXIMO = 500;
/** 500 cabe en 3 dígitos: un cuarto ya es error de dedo. */
export const MAX_DIGITOS_PIEZAS = 3;

/** Cantidad fija del ejemplo del resumen: la misma en ambas modalidades, para que la diferencia salte. */
export const PAQUETES_EJEMPLO = 5;

export interface ProductoPendiente {
  code: string;
  nombre: string;
  familia: string | null;
  sugerido: number | null;
}

export interface FamiliaPendiente {
  /** `null` = productos sin familia en Handy: van al final y sin acción de familia. */
  familia: string | null;
  titulo: string;
  data: ProductoPendiente[];
}

function sugeridoValido(valor: unknown): number | null {
  return typeof valor === 'number' && piezasValidas(valor) ? valor : null;
}

export function piezasValidas(piezas: number): boolean {
  return Number.isInteger(piezas) && piezas >= PIEZAS_MINIMO && piezas <= PIEZAS_MAXIMO;
}

/**
 * Agrupa por familia (alfabético, "Sin familia" al final) y por nombre dentro
 * de cada una. Descarta lo que no se puede confirmar (sin código).
 */
export function agruparPendientes(filas: readonly FactorPendienteApi[] | null | undefined): FamiliaPendiente[] {
  const porFamilia = new Map<string | null, ProductoPendiente[]>();
  const vistos = new Set<string>();

  for (const f of filas ?? []) {
    const code = f.code?.trim();
    if (!code || vistos.has(code)) continue;
    vistos.add(code);
    const familia = f.familia?.trim() || null;
    const producto: ProductoPendiente = {
      code,
      nombre: f.nombre?.trim() || code,
      familia,
      sugerido: sugeridoValido(f.piezasPorPaqueteSugerido),
    };
    const lista = porFamilia.get(familia);
    if (lista) lista.push(producto);
    else porFamilia.set(familia, [producto]);
  }

  const comparar = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

  return [...porFamilia.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return comparar(a, b);
    })
    .map(([familia, data]) => ({
      familia,
      titulo: familia ?? 'Sin familia',
      data: [...data].sort((a, b) => comparar(a.nombre, b.nombre)),
    }));
}

export function contarPendientes(familias: readonly FamiliaPendiente[]): number {
  return familias.reduce((total, f) => total + f.data.length, 0);
}

/** Lo tecleado, como número válido para enviar; `null` si falta o está fuera de rango. */
export function piezasDesdeTexto(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const piezas = Number(texto);
  return piezasValidas(piezas) ? piezas : null;
}

/**
 * Qué va a pasar al guardar, en palabras del negocio. Es lo último que se lee
 * antes de guardar: aquí se caza el "350 piezas" que eran 5 bolsas.
 */
export function resumenConfirmacion(
  modalidad: ModalidadVentaApi,
  piezasPorPaquete: number | null,
  /** Una familia entera: el ejemplo aplica a cada uno de sus productos. */
  deVarios = false,
): string {
  const contados = `${PAQUETES_EJEMPLO} paquetes${deVarios ? ' de cualquiera de ellos' : ''}`;
  if (modalidad === 'COMPLETO') {
    return `Al contar ${contados}, se enviarán ${PAQUETES_EJEMPLO} a Handy.`;
  }
  const factor = piezasPorPaquete ?? 0;
  return `Al contar ${contados}, se enviarán ${PAQUETES_EJEMPLO * factor} piezas a Handy.`;
}

/** "1 producto", "12 productos". */
export function textoProductos(cantidad: number): string {
  return cantidad === 1 ? '1 producto' : `${cantidad} productos`;
}
