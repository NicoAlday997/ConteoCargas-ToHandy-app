import type { ConfirmacionFactor, FactorCatalogoApi, FactorPendienteApi, ModalidadVentaApi } from '../api/factores';

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

/** Empaque ya confirmado por un supervisor: lo que rige hoy los conteos. */
export interface EmpaqueConfirmado {
  modalidad: ModalidadVentaApi;
  /** `null` si se vende completo. */
  piezas: number | null;
}

/** Un producto del catálogo completo, confirmado o no. */
export interface ProductoCatalogo {
  code: string;
  nombre: string;
  familia: string | null;
  /** `null` = sin confirmar: lo guardado no es confiable y no se muestra como si lo fuera. */
  confirmado: EmpaqueConfirmado | null;
  /** Solo sin confirmar: lo que la sincronización leyó del nombre. */
  sugerido: number | null;
  confirmadoPor: string | null;
  fechaConfirmacion: Date | null;
}

/** Lo que el flujo de dos pasos necesita: un pendiente o uno ya confirmado que se corrige. */
export interface ProductoAConfirmar extends ProductoPendiente {
  /** El empaque vigente si ya estaba confirmado: cambiarlo afecta los conteos futuros. */
  actual: EmpaqueConfirmado | null;
}

export interface Familia<T> {
  /** `null` = productos sin familia en Handy: van al final y sin acción de familia. */
  familia: string | null;
  titulo: string;
  data: T[];
}

export type FamiliaPendiente = Familia<ProductoPendiente>;
export type FamiliaCatalogo = Familia<ProductoCatalogo>;

function sugeridoValido(valor: unknown): number | null {
  return typeof valor === 'number' && piezasValidas(valor) ? valor : null;
}

export function piezasValidas(piezas: number): boolean {
  return Number.isInteger(piezas) && piezas >= PIEZAS_MINIMO && piezas <= PIEZAS_MAXIMO;
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

/** Por familia (alfabético, "Sin familia" al final) y por nombre dentro de cada una. */
function agruparPorFamilia<T extends { familia: string | null; nombre: string }>(productos: readonly T[]): Familia<T>[] {
  const porFamilia = new Map<string | null, T[]>();
  for (const p of productos) {
    const lista = porFamilia.get(p.familia);
    if (lista) lista.push(p);
    else porFamilia.set(p.familia, [p]);
  }
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

/** Filas con código, sin repetidos: lo que no tiene código no se puede confirmar. */
function conCodigoUnico<F extends { code: string | null }>(filas: readonly F[] | null | undefined): (F & { code: string })[] {
  const vistos = new Set<string>();
  const resultado: (F & { code: string })[] = [];
  for (const f of filas ?? []) {
    const code = f.code?.trim();
    if (!code || vistos.has(code)) continue;
    vistos.add(code);
    resultado.push({ ...f, code });
  }
  return resultado;
}

/**
 * Agrupa por familia (alfabético, "Sin familia" al final) y por nombre dentro
 * de cada una. Descarta lo que no se puede confirmar (sin código).
 */
export function agruparPendientes(filas: readonly FactorPendienteApi[] | null | undefined): FamiliaPendiente[] {
  return agruparPorFamilia(
    conCodigoUnico(filas).map((f) => ({
      code: f.code,
      nombre: f.nombre?.trim() || f.code,
      familia: f.familia?.trim() || null,
      sugerido: sugeridoValido(f.piezasPorPaqueteSugerido),
    })),
  );
}

function empaqueConfirmado(f: FactorCatalogoApi): EmpaqueConfirmado | null {
  if (f.factorConfirmado !== true) return null;
  if (f.modalidadVenta === 'COMPLETO') return { modalidad: 'COMPLETO', piezas: null };
  if (f.modalidadVenta === 'POR_PIEZA') return { modalidad: 'POR_PIEZA', piezas: sugeridoValido(f.piezasPorPaquete) };
  return null;
}

function fechaValida(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** El catálogo completo, agrupado igual que los pendientes. */
export function agruparCatalogo(filas: readonly FactorCatalogoApi[] | null | undefined): FamiliaCatalogo[] {
  return agruparPorFamilia(
    conCodigoUnico(filas).map((f) => {
      const confirmado = empaqueConfirmado(f);
      return {
        code: f.code,
        nombre: f.nombre?.trim() || f.code,
        familia: f.familia?.trim() || null,
        confirmado,
        sugerido: confirmado ? null : sugeridoValido(f.piezasPorPaquete),
        confirmadoPor: confirmado ? f.confirmadoPor?.trim() || null : null,
        fechaConfirmacion: confirmado ? fechaValida(f.fechaConfirmacionFactor) : null,
      };
    }),
  );
}

/** Sin mayúsculas ni acentos: "jalapeño" encuentra "JALAPENO". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Las familias con solo los productos que contienen TODAS las palabras
 * buscadas (en el nombre, la familia o el código), en cualquier orden. Las
 * familias que quedan vacías desaparecen. Sin búsqueda, todo.
 */
export function filtrarCatalogo(familias: readonly FamiliaCatalogo[], busqueda: string): FamiliaCatalogo[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...familias];
  return familias
    .map((f) => ({
      ...f,
      data: f.data.filter((p) => {
        const texto = normalizar(`${p.nombre} ${p.familia ?? ''} ${p.code}`);
        return palabras.every((palabra) => texto.includes(palabra));
      }),
    }))
    .filter((f) => f.data.length > 0);
}

/** El empaque en palabras claras: "Se vende completo", "Por pieza, 12 por paquete". */
export function textoEmpaque(empaque: EmpaqueConfirmado | null): string {
  if (empaque === null) return 'Sin confirmar';
  if (empaque.modalidad === 'COMPLETO') return 'Se vende completo';
  return empaque.piezas !== null ? `Por pieza, ${empaque.piezas} por paquete` : 'Por pieza';
}

/** Lo que el flujo de dos pasos recibe al tocar un producto del catálogo. */
export function productoAConfirmar(p: ProductoCatalogo): ProductoAConfirmar {
  return {
    code: p.code,
    nombre: p.nombre,
    familia: p.familia,
    // Al corregir, lo vigente se precarga igual que una sugerencia: la primera tecla lo reemplaza.
    sugerido: p.confirmado ? p.confirmado.piezas : p.sugerido,
    actual: p.confirmado,
  };
}

/** `true` si lo elegido es exactamente lo que ya estaba confirmado. */
export function esMismoEmpaque(actual: EmpaqueConfirmado | null, modalidad: ModalidadVentaApi, piezas: number | null): boolean {
  if (actual === null || actual.modalidad !== modalidad) return false;
  return modalidad === 'COMPLETO' || actual.piezas === piezas;
}

/** "1 carga", "3 cargas". */
export function textoCargas(cantidad: number): string {
  return cantidad === 1 ? '1 carga' : `${cantidad} cargas`;
}

export function contarPendientes(familias: readonly Familia<unknown>[]): number {
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

/** Un producto de la familia con lo que se va a guardar para él. */
export interface ProductoConConfirmacion extends ProductoPendiente {
  confirmacion: ConfirmacionFactor;
}

export interface PlanFamilia {
  /** Los que se guardan, cada uno con su propio empaque. */
  aConfirmar: ProductoConConfirmacion[];
  /** Por pieza sin número en el nombre: quedan pendientes para confirmarse uno por uno. */
  sinNumero: ProductoPendiente[];
}

/**
 * Qué se guarda al confirmar toda una familia. Completo: todos igual. Por
 * pieza: cada uno con el número de SU nombre (C/6, C/12, C/24 conviven en una
 * familia); el que no trae número no se adivina y se queda pendiente.
 */
export function planFamilia(productos: readonly ProductoPendiente[], modalidad: ModalidadVentaApi): PlanFamilia {
  if (modalidad === 'COMPLETO') {
    return { aConfirmar: productos.map((p) => ({ ...p, confirmacion: { modalidadVenta: 'COMPLETO' } })), sinNumero: [] };
  }
  const aConfirmar: ProductoConConfirmacion[] = [];
  const sinNumero: ProductoPendiente[] = [];
  for (const p of productos) {
    if (p.sugerido === null) sinNumero.push(p);
    else aConfirmar.push({ ...p, confirmacion: { modalidadVenta: 'POR_PIEZA', piezasPorPaquete: p.sugerido } });
  }
  return { aConfirmar, sinNumero };
}

/** El resumen por pieza de un producto concreto: en una familia cada uno multiplica distinto. */
export function resumenPorPiezaDe(nombre: string, piezasPorPaquete: number): string {
  return `Al contar ${PAQUETES_EJEMPLO} paquetes de ${nombre}, se enviarán ${PAQUETES_EJEMPLO * piezasPorPaquete} piezas a Handy.`;
}

/** "1 producto", "12 productos". */
export function textoProductos(cantidad: number): string {
  return cantidad === 1 ? '1 producto' : `${cantidad} productos`;
}
