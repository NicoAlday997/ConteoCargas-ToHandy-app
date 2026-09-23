/**
 * Fecha operativa de una carga: el DIA para el que sale el camion, distinto de
 * `fechaConteo` (el instante en que se conto). Funciones puras: reciben `ahora`
 * en lugar de leer el reloj del sistema.
 *
 * Caso normal: el camion llega por la tarde, se le hace la devolucion y se le
 * da la salida el MISMO dia, pero esa salida es para el dia SIGUIENTE (contada
 * el 23 por la tarde = carga del 24). Excepcion: si el camion se descompone se
 * cuenta el 24 en la mañana para salir el 24 mismo.
 *
 * Todo "dia" se calcula en la zona del negocio (America/Mexico_City) y se
 * representa con el instante en que empieza (`inicioDelDiaNegocio`).
 */

import { inicioDelDiaNegocio } from '../../sincronizacion/domain/fecha-handy';

const MS_POR_HORA = 60 * 60 * 1000;

/** Inicio del dia de negocio siguiente al que contiene a `fecha`. */
function inicioDelDiaSiguiente(fecha: Date): Date {
  // +36h desde el inicio del dia cae siempre dentro del dia siguiente, aun en
  // un dia de 23 o 25 horas por cambio de horario.
  const inicio = inicioDelDiaNegocio(fecha);
  return inicioDelDiaNegocio(new Date(inicio.getTime() + 36 * MS_POR_HORA));
}

/**
 * Fecha operativa que la app PROPONE al iniciar una carga: SIEMPRE MAÑANA, sin
 * importar la hora. Lo normal es contar por la tarde para que el camion salga
 * al dia siguiente; contar para hoy es la excepcion (camion descompuesto) y se
 * elige a mano. Es solo una propuesta: el usuario decide la fecha final.
 */
export function fechaOperativaPropuesta(ahora: Date): Date {
  return inicioDelDiaSiguiente(ahora);
}

/**
 * Una fecha operativa es valida si es HOY o cualquier dia futuro, en la zona
 * del negocio. Nunca se acepta un dia pasado: permitiria "arreglar" cargas
 * viejas registrando una nueva con fecha anterior.
 */
export function esFechaOperativaValida(fecha: Date, ahora: Date): boolean {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return false;
  }
  return (
    inicioDelDiaNegocio(fecha).getTime() >= inicioDelDiaNegocio(ahora).getTime()
  );
}

/** Normaliza cualquier instante al inicio de su dia de negocio (lo que se guarda). */
export function normalizarFechaOperativa(fecha: Date): Date {
  return inicioDelDiaNegocio(fecha);
}

/**
 * Convierte un dia calendario `aaaa-mm-dd` (como lo manda la app) al inicio de
 * ese dia en la zona del negocio. Lanza si el texto no es un dia real.
 */
export function fechaOperativaDesdeDia(dia: string): Date {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (coincide === null) {
    throw new TypeError(`fechaOperativaDesdeDia: se esperaba aaaa-mm-dd: ${dia}`);
  }
  const [anio, mes, diaMes] = coincide.slice(1).map(Number);
  // Mediodia UTC cae dentro del mismo dia calendario en Mexico (UTC-6), asi que
  // su inicio de dia de negocio es exactamente ese dia.
  const mediodiaUtc = new Date(Date.UTC(anio, mes - 1, diaMes, 12));
  if (
    mediodiaUtc.getUTCFullYear() !== anio ||
    mediodiaUtc.getUTCMonth() !== mes - 1 ||
    mediodiaUtc.getUTCDate() !== diaMes
  ) {
    throw new TypeError(`fechaOperativaDesdeDia: dia inexistente: ${dia}`);
  }
  return inicioDelDiaNegocio(mediodiaUtc);
}
