import type { PermisoCargaApi, RutaPermisoApi } from '../api/permisos.ts';
import { diaNegocio, diaRelativo, formatearDia, horaNegocio } from '../conteo/fecha-operativa.ts';

/**
 * Lo que la pantalla de permisos muestra, ya validado. La respuesta se lee a
 * la defensiva: una fila sin id o sin vencimiento no se puede mostrar honesta.
 */

const texto = (valor: string | null | undefined): string | null => valor?.trim() || null;

function instante(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export interface Permiso {
  id: string;
  rutaId: string | null;
  rutaNombre: string;
  otorgadoPorNombre: string | null;
  motivo: string | null;
  otorgado: Date | null;
  expira: Date;
  usado: boolean;
  /** Carga que lo gastó. */
  eventoCargaId: string | null;
}

export interface RutaPermiso {
  id: string;
  nombre: string;
  vendedorNombre: string | null;
}

/** Sin usar primero (son los que todavía cuentan), y dentro de cada grupo el que vence antes. */
export function normalizarPermisos(filas: readonly PermisoCargaApi[]): Permiso[] {
  const resultado: Permiso[] = [];
  for (const f of filas) {
    const id = texto(f.id);
    const expira = instante(f.fechaExpiracion);
    if (!id || !expira) continue;
    resultado.push({
      id,
      rutaId: texto(f.rutaId),
      rutaNombre: texto(f.rutaNombre) ?? 'Ruta sin nombre',
      otorgadoPorNombre: texto(f.otorgadoPorNombre),
      motivo: texto(f.motivo),
      otorgado: instante(f.fechaOtorgado),
      expira,
      usado: f.usado === true,
      eventoCargaId: texto(f.eventoCargaId),
    });
  }
  return resultado.sort((a, b) =>
    a.usado === b.usado ? a.expira.getTime() - b.expira.getTime() : a.usado ? 1 : -1,
  );
}

export function normalizarRutas(filas: readonly RutaPermisoApi[]): RutaPermiso[] {
  const resultado: RutaPermiso[] = [];
  for (const f of filas) {
    const id = texto(f.id);
    if (!id) continue;
    resultado.push({
      id,
      nombre: texto(f.nombre) ?? texto(f.codigo) ?? 'Ruta sin nombre',
      vendedorNombre: texto(f.vendedorNombre),
    });
  }
  return resultado;
}

/** Rutas que ya tienen un permiso sin usar: el servidor no acepta otro hasta que se use o venza. */
export function rutasConPermisoPendiente(permisos: readonly Permiso[], ahora: Date): Set<string> {
  return new Set(
    permisos
      .filter((p) => !p.usado && p.expira.getTime() > ahora.getTime() && p.rutaId !== null)
      .map((p) => p.rutaId as string),
  );
}

const MS_POR_MINUTO = 60 * 1000;

/** "Quedan 5 h 20 min", "Quedan 35 min", "Vence en menos de un minuto" o "Vencido". */
export function tiempoRestante(expira: Date, ahora: Date): string {
  const restante = expira.getTime() - ahora.getTime();
  if (restante <= 0) return 'Vencido';
  const minutos = Math.floor(restante / MS_POR_MINUTO);
  if (minutos < 1) return 'Vence en menos de un minuto';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `Quedan ${minutos} min`;
  return resto === 0 ? `Quedan ${horas} h` : `Quedan ${horas} h ${resto} min`;
}

/** "hoy a las 17:42", "mañana a las 17:42" o, lejos, "el jueves 24 de septiembre a las 17:42". */
export function momentoLegible(fecha: Date, ahora: Date): string {
  const dia = diaNegocio(fecha);
  const relativo = diaRelativo(dia, diaNegocio(ahora));
  const hora = horaNegocio(fecha);
  if (relativo) return `${relativo.toLowerCase()} a las ${hora}`;
  const legible = formatearDia(dia);
  return `el ${legible.charAt(0).toLowerCase()}${legible.slice(1)} a las ${hora}`;
}

/** Motivo válido para el servidor: al menos el mínimo de caracteres sin contar espacios de las orillas. */
export function motivoValido(motivo: string, minimo: number): boolean {
  return motivo.trim().length >= minimo;
}
