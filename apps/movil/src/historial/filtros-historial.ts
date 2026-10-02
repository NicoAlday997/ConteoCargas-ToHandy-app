import type {
  EstadoCargaApi,
  OpcionRutaApi,
  OpcionVendedorApi,
} from '../api/historial';
import { formatearFechaCorta, sumarDias } from '../conteo/fecha-operativa.ts';
import { ESTADOS_CARGA } from './modelo-historial.ts';

/**
 * Filtros del historial: lo que eligió quien consulta, para estrechar lo que
 * el servidor ya decidió por su rol. Viven en la pantalla, no se guardan: al
 * volver a entrar el historial arranca limpio.
 */

export interface VendedorFiltro {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface RutaFiltro {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface FiltrosHistorial {
  vendedor: VendedorFiltro | null;
  ruta: RutaFiltro | null;
  /** `aaaa-mm-dd`, inclusivo. */
  desde: string | null;
  /** `aaaa-mm-dd`, inclusivo. */
  hasta: string | null;
  estado: EstadoCargaApi | null;
}

export const FILTROS_VACIOS: FiltrosHistorial = {
  vendedor: null,
  ruta: null,
  desde: null,
  hasta: null,
  estado: null,
};

/** Días hacia atrás que el servidor deja ver a vendedor y contador. */
export const DIAS_HISTORIAL_LIMITADO = 14;

export type ClaveFiltro = 'vendedor' | 'ruta' | 'fechas' | 'estado';

export function cuantosFiltros(f: FiltrosHistorial): number {
  return (
    Number(f.vendedor !== null) +
    Number(f.ruta !== null) +
    Number(f.desde !== null || f.hasta !== null) +
    Number(f.estado !== null)
  );
}

export function quitarFiltro(
  f: FiltrosHistorial,
  clave: ClaveFiltro,
): FiltrosHistorial {
  switch (clave) {
    case 'vendedor':
      return { ...f, vendedor: null };
    case 'ruta':
      return { ...f, ruta: null };
    case 'fechas':
      return { ...f, desde: null, hasta: null };
    case 'estado':
      return { ...f, estado: null };
  }
}

/** Query string de `GET /historial`, sin `page`/`pageSize`. Solo lo que está puesto. */
export function parametrosHistorial(f: FiltrosHistorial): string {
  const partes: [string, string][] = [];
  if (f.vendedor) partes.push(['vendedorUsuarioAppId', f.vendedor.id]);
  if (f.ruta) partes.push(['rutaId', f.ruta.id]);
  if (f.desde) partes.push(['fechaInicio', f.desde]);
  if (f.hasta) partes.push(['fechaFin', f.hasta]);
  if (f.estado) partes.push(['estado', f.estado]);
  return partes.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** "Irvin Pérez · inactivo": el inactivo se distingue, no se esconde. */
export function etiquetaVendedor(v: { nombre: string; activo: boolean }) {
  return v.activo ? v.nombre : `${v.nombre} · inactivo`;
}

export function etiquetaRuta(r: { nombre: string; activa: boolean }) {
  return r.activa ? r.nombre : `${r.nombre} · inactiva`;
}

/** "24 sep", "1–15 sep", "28 ago – 3 sep", "Desde 3 sep", "Hasta 20 sep". */
export function textoFechas(
  desde: string | null,
  hasta: string | null,
): string | null {
  if (desde && hasta) {
    if (desde === hasta) return formatearFechaCorta(desde);
    const [, mesDesde] = desde.split('-');
    const [, mesHasta] = hasta.split('-');
    if (desde.slice(0, 4) === hasta.slice(0, 4) && mesDesde === mesHasta)
      return `${Number(desde.slice(8))}–${formatearFechaCorta(hasta)}`;
    return `${formatearFechaCorta(desde)} – ${formatearFechaCorta(hasta)}`;
  }
  if (desde) return `Desde ${formatearFechaCorta(desde)}`;
  if (hasta) return `Hasta ${formatearFechaCorta(hasta)}`;
  return null;
}

export function etiquetaEstado(estado: EstadoCargaApi): string {
  return ESTADOS_CARGA[estado]?.etiqueta ?? estado;
}

export function textoTotal(total: number): string {
  return total === 1 ? '1 carga' : `${total} cargas`;
}

/**
 * Por qué no salió nada, con los filtros dichos en una frase: "No hay cargas
 * de Irvin Pérez en Ruta 3, del 1–15 sep, en estado Cancelada."
 */
export function explicarSinResultados(f: FiltrosHistorial): string {
  const partes: string[] = [];
  if (f.vendedor) partes.push(`de ${f.vendedor.nombre}`);
  if (f.ruta) partes.push(`en ${f.ruta.nombre}`);
  const fechas = textoFechas(f.desde, f.hasta);
  if (fechas)
    partes.push(f.desde && f.hasta ? `del ${fechas}` : fechas.toLowerCase());
  if (f.estado) partes.push(`en estado ${etiquetaEstado(f.estado)}`);
  return `No hay cargas ${partes.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** El día más viejo que el servidor deja ver a este rol; `null` = sin límite. */
export function diaMinimo(rol: string | null, hoy: string): string | null {
  return rol === 'SUPERVISOR' ? null : sumarDias(hoy, -DIAS_HISTORIAL_LIMITADO);
}

export interface Rango {
  desde: string | null;
  hasta: string | null;
}

/**
 * Elegir un rango en el calendario con dos toques: el primero marca el inicio,
 * el segundo el fin (si es anterior, se voltean). Un tercer toque empieza otro
 * rango. Un rango de un solo día se queda con el inicio igual al fin.
 */
export function tocarDia(rango: Rango, dia: string): Rango {
  if (rango.desde === null || rango.hasta !== null)
    return { desde: dia, hasta: null };
  return dia < rango.desde
    ? { desde: dia, hasta: rango.desde }
    : { desde: rango.desde, hasta: dia };
}

/** Un rango a medio elegir (solo inicio) se aplica como ese único día. */
export function cerrarRango(rango: Rango): Rango {
  if (rango.desde !== null && rango.hasta === null)
    return { desde: rango.desde, hasta: rango.desde };
  return rango;
}

export function dentroDeRango(rango: Rango, dia: string): boolean {
  if (rango.desde === null) return false;
  const hasta = rango.hasta ?? rango.desde;
  return dia >= rango.desde && dia <= hasta;
}

export interface Atajo {
  etiqueta: string;
  desde: string;
  hasta: string;
}

/**
 * Atajos de fechas. Vendedor y contador solo ven 2 semanas: no se les ofrece
 * nada más viejo que eso.
 */
export function atajosFechas(rol: string | null, hoy: string): Atajo[] {
  const atajos: Atajo[] = [
    { etiqueta: 'Hoy', desde: hoy, hasta: hoy },
    { etiqueta: 'Ayer', desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) },
    { etiqueta: 'Últimos 7 días', desde: sumarDias(hoy, -6), hasta: hoy },
  ];
  if (rol === 'SUPERVISOR') {
    const inicioMes = `${hoy.slice(0, 8)}01`;
    const finMesPasado = sumarDias(inicioMes, -1);
    atajos.push(
      { etiqueta: 'Este mes', desde: inicioMes, hasta: hoy },
      {
        etiqueta: 'Mes pasado',
        desde: `${finMesPasado.slice(0, 8)}01`,
        hasta: finMesPasado,
      },
    );
  }
  return atajos;
}

// ---------------------------------------------------------------------------
// Opciones del servidor
// ---------------------------------------------------------------------------

const texto = (valor: string | null | undefined): string | null =>
  valor?.trim() || null;

/** Lectura a la defensiva: una opción sin id o sin nombre no se puede elegir. */
export function normalizarVendedores(
  api: readonly OpcionVendedorApi[] | null | undefined,
): VendedorFiltro[] {
  return (api ?? []).flatMap((v) => {
    const id = texto(v.id);
    const nombre = texto(v.nombreCompleto);
    return id && nombre ? [{ id, nombre, activo: v.activo !== false }] : [];
  });
}

export function normalizarRutas(
  api: readonly OpcionRutaApi[] | null | undefined,
): RutaFiltro[] {
  return (api ?? []).flatMap((r) => {
    const id = texto(r.id);
    const nombre = texto(r.nombre);
    return id && nombre ? [{ id, nombre, activa: r.activa !== false }] : [];
  });
}
