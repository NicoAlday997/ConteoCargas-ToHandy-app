import type { MovimientoAccesoApi } from '../api/personas';
import { diaNegocio, formatearDia, horaNegocio } from '../conteo/fecha-operativa.ts';

/**
 * Historial de acceso de una persona: restablecimientos de PIN y bloqueos
 * quitados. Solo lectura, siempre: aquí no hay nada que edite ni borre un
 * renglón. Puro (sin React) para poder probarlo.
 */

/**
 * - `pin`: un supervisor restableció el PIN desde la app.
 * - `pin-emergencia`: se restableció por línea de comandos. No hay sesión, así
 *   que no se sabe quién: solo el motivo que dejó. Es la intervención de
 *   emergencia y debe verse distinta.
 * - `desbloqueo`: un supervisor quitó el bloqueo por intentos fallidos.
 */
export type MovimientoAcceso =
  | { id: string; tipo: 'pin'; fecha: Date; autor: string }
  | { id: string; tipo: 'pin-emergencia'; fecha: Date; motivo: string }
  | { id: string; tipo: 'desbloqueo'; fecha: Date; autor: string; bloqueadoHasta: Date | null };

/** El servidor siempre manda quién; si el nombre faltara, el renglón no se esconde. */
const AUTOR_DESCONOCIDO = 'un supervisor';

function leerFecha(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Descarta solo lo que no se puede mostrar (sin id, tipo o fecha). */
export function normalizarAccesos(items: readonly MovimientoAccesoApi[] | null | undefined): MovimientoAcceso[] {
  return (items ?? []).flatMap((m): MovimientoAcceso[] => {
    const fecha = leerFecha(m.fecha);
    if (!m.id || !fecha) return [];
    const autor = m.autor?.nombreCompleto?.trim() || AUTOR_DESCONOCIDO;
    if (m.tipo === 'PIN_RESTABLECIDO') {
      return m.origen === 'LINEA_COMANDOS'
        ? [{ id: m.id, tipo: 'pin-emergencia', fecha, motivo: m.motivo?.trim() ?? '' }]
        : [{ id: m.id, tipo: 'pin', fecha, autor }];
    }
    if (m.tipo === 'BLOQUEO_QUITADO') {
      return [{ id: m.id, tipo: 'desbloqueo', fecha, autor, bloqueadoHasta: leerFecha(m.bloqueadoHasta) }];
    }
    return [];
  });
}

/** «PIN restablecido por Cristian Alday», «PIN restablecido por línea de comandos», «Bloqueo quitado por Cristian Alday». */
export function tituloMovimiento(m: MovimientoAcceso): string {
  switch (m.tipo) {
    case 'pin':
      return `PIN restablecido por ${m.autor}`;
    case 'pin-emergencia':
      return 'PIN restablecido por línea de comandos';
    case 'desbloqueo':
      return `Bloqueo quitado por ${m.autor}`;
  }
}

/**
 * «Hoy, 05:57», «Jueves 24 de septiembre, 23:58» o, de otro año,
 * «Jueves 24 de septiembre de 2025, 23:58». En la hora del negocio.
 */
export function textoMomento(instante: Date, ahora: number): string {
  const dia = diaNegocio(instante);
  const hoy = diaNegocio(new Date(ahora));
  const fecha = dia === hoy ? 'Hoy' : dia.slice(0, 4) === hoy.slice(0, 4) ? formatearDia(dia) : `${formatearDia(dia)} de ${dia.slice(0, 4)}`;
  return `${fecha}, ${horaNegocio(instante)}`;
}

/** Bajo el título del desbloqueo: «El bloqueo iba hasta las 06:12». */
export function textoBloqueoQuitado(m: Extract<MovimientoAcceso, { tipo: 'desbloqueo' }>): string | null {
  if (!m.bloqueadoHasta) return null;
  const mismoDia = diaNegocio(m.bloqueadoHasta) === diaNegocio(m.fecha);
  return mismoDia
    ? `El bloqueo iba hasta las ${horaNegocio(m.bloqueadoHasta)}`
    : `El bloqueo iba hasta el ${formatearDia(diaNegocio(m.bloqueadoHasta)).toLowerCase()}, ${horaNegocio(m.bloqueadoHasta)}`;
}

/** Lo que dice el renglón de emergencia cuando el motivo vino vacío. */
export const SIN_MOTIVO = 'Sin motivo registrado';

/** Debajo de la lista corta: «Ver todo (12)». */
export function textoVerTodo(total: number): string {
  return `Ver todo (${total})`;
}
