import type {
  PlantillaDetalleApi,
  PlantillaResumenApi,
  ProductoPlantillaApi,
  RutaApi,
  RutaConPlantillaApi,
} from '../api/plantillas.ts';
import {
  filtrarCatalogo,
  type EmpaqueConfirmado,
  type Familia,
  type FamiliaCatalogo,
  type ProductoCatalogo,
} from '../factores/modelo-factores.ts';

/**
 * Lo que las pantallas de plantillas necesitan, ya validado. Una plantilla
 * decide qué ve el vendedor al contar: un producto que no está en la
 * plantilla de su ruta, no lo cuenta nunca.
 */

/** Los mismos límites que valida el servidor. */
export const NOMBRE_MAXIMO = 80;
export const DESCRIPCION_MAXIMO = 300;

export interface Ruta {
  id: string;
  nombre: string;
}

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  totalProductos: number;
  rutas: Ruta[];
}

export interface ProductoPlantilla {
  code: string;
  nombre: string;
  familia: string | null;
  /** `null` = el empaque no está confirmado: lo guardado no es confiable. */
  empaque: EmpaqueConfirmado | null;
  /** Desactivado en Handy: sigue en la plantilla, pero no aparece al contar. */
  activo: boolean;
}

export type FamiliaPlantilla = Familia<ProductoPlantilla>;

export interface DetallePlantilla extends Plantilla {
  familias: FamiliaPlantilla[];
}

function texto(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function normalizarRutas(rutas: readonly RutaApi[] | null | undefined): Ruta[] {
  const vistas = new Set<string>();
  const resultado: Ruta[] = [];
  for (const r of rutas ?? []) {
    const id = texto(r?.id);
    if (!id || vistas.has(id)) continue;
    vistas.add(id);
    resultado.push({ id, nombre: texto(r.nombre) ?? texto(r.codigo) ?? 'Ruta sin nombre' });
  }
  return resultado;
}

/** `null` si la fila no trae id: sin id no se puede abrir. */
function normalizarPlantilla(p: PlantillaResumenApi | null | undefined): Plantilla | null {
  const id = texto(p?.id);
  if (!p || !id) return null;
  return {
    id,
    nombre: texto(p.nombre) ?? 'Plantilla sin nombre',
    descripcion: texto(p.descripcion),
    activa: p.activa !== false,
    totalProductos: typeof p.totalProductos === 'number' && p.totalProductos >= 0 ? p.totalProductos : 0,
    rutas: normalizarRutas(p.rutas),
  };
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });

export interface ListaPlantillas {
  activas: Plantilla[];
  /** Aparte y al final: solo están para poder reactivarlas. */
  inactivas: Plantilla[];
}

export function normalizarLista(filas: readonly PlantillaResumenApi[] | null | undefined): ListaPlantillas {
  const todas = (filas ?? [])
    .map(normalizarPlantilla)
    .filter((p): p is Plantilla => p !== null)
    .sort((a, b) => comparar(a.nombre, b.nombre));
  return { activas: todas.filter((p) => p.activa), inactivas: todas.filter((p) => !p.activa) };
}

function empaque(p: ProductoPlantillaApi): EmpaqueConfirmado | null {
  if (p.factorConfirmado !== true) return null;
  if (p.modalidadVenta === 'COMPLETO') return { modalidad: 'COMPLETO', piezas: null };
  if (p.modalidadVenta === 'POR_PIEZA') {
    const piezas = typeof p.piezasPorPaquete === 'number' && p.piezasPorPaquete > 0 ? p.piezasPorPaquete : null;
    return { modalidad: 'POR_PIEZA', piezas };
  }
  return null;
}

/** El orden de familias y productos lo da el servidor (el mismo del grid de conteo). */
export function normalizarDetalle(api: PlantillaDetalleApi | null | undefined): DetallePlantilla | null {
  const plantilla = normalizarPlantilla(api);
  if (!plantilla || !api) return null;
  const vistos = new Set<string>();
  const familias: FamiliaPlantilla[] = [];
  for (const f of api.familias ?? []) {
    const familia = texto(f?.familia);
    const data: ProductoPlantilla[] = [];
    for (const p of f?.productos ?? []) {
      const code = texto(p?.code);
      if (!p || !code || vistos.has(code)) continue;
      vistos.add(code);
      data.push({ code, nombre: texto(p.nombre) ?? code, familia, empaque: empaque(p), activo: p.activo !== false });
    }
    if (data.length > 0) familias.push({ familia, titulo: familia ?? 'Sin familia', data });
  }
  // El total sale de lo que se ve: así el encabezado nunca contradice a la lista.
  return { ...plantilla, totalProductos: vistos.size, familias };
}

export function codigosDe(familias: readonly Familia<{ code: string }>[]): Set<string> {
  return new Set(familias.flatMap((f) => f.data.map((p) => p.code)));
}

// ---------------------------------------------------------------------------
// Selección múltiple
// ---------------------------------------------------------------------------

/** Marca o desmarca un producto. Devuelve un conjunto nuevo (estado de React). */
export function alternar(seleccion: ReadonlySet<string>, code: string): Set<string> {
  const nueva = new Set(seleccion);
  if (nueva.has(code)) nueva.delete(code);
  else nueva.add(code);
  return nueva;
}

/** Si ya están todos los de la familia, los desmarca; si falta alguno, marca todos. */
export function alternarVarios(seleccion: ReadonlySet<string>, codes: readonly string[]): Set<string> {
  const nueva = new Set(seleccion);
  const todos = codes.length > 0 && codes.every((c) => nueva.has(c));
  for (const c of codes) {
    if (todos) nueva.delete(c);
    else nueva.add(c);
  }
  return nueva;
}

export function todosMarcados(seleccion: ReadonlySet<string>, codes: readonly string[]): boolean {
  return codes.length > 0 && codes.every((c) => seleccion.has(c));
}

// ---------------------------------------------------------------------------
// Selector de productos para agregar
// ---------------------------------------------------------------------------

export interface ProductoSelector extends ProductoCatalogo {
  /** Ya está en la plantilla: se muestra, pero no se puede volver a agregar. */
  incluido: boolean;
}

export interface FamiliaSelector extends Familia<ProductoSelector> {
  /** Los que todavía se pueden agregar. */
  disponibles: string[];
}

/**
 * El catálogo completo, filtrado por la búsqueda, con lo que ya está en la
 * plantilla marcado. Se muestra todo (no solo lo que falta) para que quien
 * busca "pepsi" vea que ya está, en vez de creer que no existe.
 */
export function familiasSelector(
  catalogo: readonly FamiliaCatalogo[],
  incluidos: ReadonlySet<string>,
  busqueda: string,
): FamiliaSelector[] {
  return filtrarCatalogo(catalogo, busqueda).map((f) => {
    const data = f.data.map((p) => ({ ...p, incluido: incluidos.has(p.code) }));
    return { ...f, data, disponibles: data.filter((p) => !p.incluido).map((p) => p.code) };
  });
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

export interface RutaAsignable extends Ruta {
  vendedores: string[];
  /** Lo que usa hoy, en palabras: "Usa Refrescos", "Sin plantilla: ve todo el catálogo". */
  actual: string;
  /** Ya usa esta plantilla (todos sus vendedores). */
  usaEsta: boolean;
  /** Sin vendedor no hay asignación donde guardar la plantilla. */
  asignable: boolean;
}

/**
 * Todas las rutas activas respecto a una plantilla: primero las que ya la
 * usan, luego las que se le pueden asignar y al final las que no tienen
 * vendedor. Dentro de cada grupo, por nombre.
 */
export function rutasRespectoA(filas: readonly RutaConPlantillaApi[] | null | undefined, plantillaId: string): RutaAsignable[] {
  const rutas: RutaAsignable[] = [];
  for (const r of filas ?? []) {
    const id = texto(r?.id);
    if (!r || !id) continue;
    const vendedores = (r.vendedores ?? []).map((v) => texto(v)).filter((v): v is string => v !== null);
    const plantillas = (r.plantillas ?? []).filter((p) => texto(p?.id));
    const usaEsta = plantillas.length === 1 && texto(plantillas[0]?.id) === plantillaId && r.sinPlantilla !== true;
    const nombres = plantillas.map((p) => texto(p.nombre) ?? 'plantilla sin nombre');
    let actual: string;
    if (vendedores.length === 0) actual = 'Sin vendedor asignado';
    else if (nombres.length === 0) actual = 'Sin plantilla: ve todo el catálogo';
    else actual = `Usa ${nombres.join(' y ')}${r.sinPlantilla === true ? ' (un vendedor sin plantilla)' : ''}`;
    rutas.push({
      id,
      nombre: texto(r.nombre) ?? texto(r.codigo) ?? 'Ruta sin nombre',
      vendedores,
      actual,
      usaEsta,
      asignable: vendedores.length > 0,
    });
  }
  const grupo = (r: RutaAsignable) => (r.usaEsta ? 0 : r.asignable ? 1 : 2);
  return rutas.sort((a, b) => grupo(a) - grupo(b) || comparar(a.nombre, b.nombre));
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** "Ruta 1, Ruta 3" o que no la usa ninguna. */
export function textoRutas(rutas: readonly Ruta[]): string {
  if (rutas.length === 0) return 'Ninguna ruta la usa';
  return rutas.map((r) => r.nombre).join(', ');
}

/** "1 ruta", "5 rutas". */
export function textoCantidadRutas(cantidad: number): string {
  return cantidad === 1 ? '1 ruta' : `${cantidad} rutas`;
}

/** Lo que falta para guardar un nombre, o `null` si sirve. */
export function errorNombre(nombre: string): string | null {
  const limpio = nombre.trim();
  if (!limpio) return 'Escribe un nombre.';
  if (limpio.length > NOMBRE_MAXIMO) return `Máximo ${NOMBRE_MAXIMO} caracteres.`;
  return null;
}
