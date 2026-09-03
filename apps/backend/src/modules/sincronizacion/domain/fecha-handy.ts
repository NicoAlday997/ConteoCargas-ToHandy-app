/**
 * Conversion de fechas para hablar con la API de Handy. Funciones puras: no
 * conocen HTTP, Prisma ni el reloj del sistema (siempre reciben la `Date` a
 * convertir). Ver docs/02-documento-tecnico-y-diseno.md seccion 4.
 *
 * Dos hechos verificados de Handy que obligan a este modulo:
 *
 *  1. Handy RESPONDE fechas en ISO 8601 con `Z` (UTC), pero EXIGE el formato
 *     `dd/MM/aaaa HH:mm:ss` en los parametros de peticion (p. ej. el filtro
 *     incremental `filterWithDate=lastUpdated&start=...&end=...`).
 *
 *  2. La operacion vive en zona `America/Mexico_City`. Una carga contada a las
 *     20:00 en Garcia son las 02:00 del dia siguiente en UTC; preguntar "las
 *     cargas de hoy" calculando el dia en UTC devolveria la fecha equivocada.
 *     Por eso el inicio/fin del dia de negocio se calcula SIEMPRE en la zona
 *     local, no en UTC.
 *
 * `America/Mexico_City` no observa horario de verano desde 2022 (offset fijo
 * -06:00), pero la conversion aqui no lo asume: se apoya en los datos de zona
 * horaria de la plataforma, asi que fechas historicas con DST tambien salen
 * bien.
 */

/** Zona horaria de la operacion. Toda conversion "de negocio" pasa por aqui. */
export const ZONA_NEGOCIO = 'America/Mexico_City';

interface ParedEnZona {
  anio: number;
  mes: number; // 1-12
  dia: number; // 1-31
  hora: number; // 0-23
  minuto: number; // 0-59
  segundo: number; // 0-59
}

const formateadorZona = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function validarFecha(fecha: Date, fn: string): void {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    throw new TypeError(`${fn}: se esperaba una Date valida`);
  }
}

/** Descompone un instante en su hora de pared (wall clock) en la zona de negocio. */
function paredEnZona(fecha: Date): ParedEnZona {
  const partes: Record<string, number> = {};
  for (const parte of formateadorZona.formatToParts(fecha)) {
    if (parte.type !== 'literal') {
      partes[parte.type] = Number(parte.value);
    }
  }
  return {
    anio: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: partes.hour,
    minuto: partes.minute,
    segundo: partes.second,
  };
}

/**
 * Desplazamiento (ms) de la zona de negocio respecto a UTC en ese instante:
 * hora de pared local - hora de pared UTC. Para Mexico ~ -6h.
 */
function offsetZonaMs(fecha: Date): number {
  const p = paredEnZona(fecha);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const sinMilisegundos = fecha.getTime() - fecha.getMilliseconds();
  return comoUtc - sinMilisegundos;
}

/**
 * Convierte una hora de pared de la zona de negocio al instante absoluto (Date)
 * que le corresponde. Doble pasada para acertar cerca de un cambio de horario
 * (el offset del instante aproximado puede diferir del real).
 */
function instanteDesdePared(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  segundo: number,
  milisegundo: number,
): Date {
  const aproxUtc = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo, milisegundo);
  const offset1 = offsetZonaMs(new Date(aproxUtc));
  let instante = aproxUtc - offset1;
  const offset2 = offsetZonaMs(new Date(instante));
  if (offset2 !== offset1) {
    instante = aproxUtc - offset2;
  }
  return new Date(instante);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formatea un instante como `dd/MM/aaaa HH:mm:ss` en hora de `America/Mexico_City`,
 * que es lo que exige Handy en los parametros de peticion.
 *
 * @example aFormatoHandy(new Date('2026-09-03T02:00:00Z')) === '02/09/2026 20:00:00'
 */
export function aFormatoHandy(fecha: Date): string {
  validarFecha(fecha, 'aFormatoHandy');
  const p = paredEnZona(fecha);
  const aaaa = String(p.anio).padStart(4, '0');
  return `${pad2(p.dia)}/${pad2(p.mes)}/${aaaa} ${pad2(p.hora)}:${pad2(p.minuto)}:${pad2(p.segundo)}`;
}

/**
 * Interpreta una fecha ISO 8601 tal como la devuelve Handy (con `Z`, UTC) y la
 * regresa como `Date`. Lanza si el string no es una fecha valida.
 */
export function desdeIsoHandy(iso: string): Date {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    throw new TypeError(`desdeIsoHandy: fecha ISO invalida recibida de Handy: ${JSON.stringify(iso)}`);
  }
  return fecha;
}

/**
 * Instante en que empieza (00:00:00.000) el dia de negocio que contiene a
 * `fecha`, calculado en `America/Mexico_City`. Usar como `start` al consultar
 * "las cargas de hoy".
 */
export function inicioDelDiaNegocio(fecha: Date): Date {
  validarFecha(fecha, 'inicioDelDiaNegocio');
  const p = paredEnZona(fecha);
  return instanteDesdePared(p.anio, p.mes, p.dia, 0, 0, 0, 0);
}

/**
 * Instante en que termina (23:59:59.999) el dia de negocio que contiene a
 * `fecha`, calculado en `America/Mexico_City`. Usar como `end` al consultar
 * "las cargas de hoy".
 */
export function finDelDiaNegocio(fecha: Date): Date {
  validarFecha(fecha, 'finDelDiaNegocio');
  const p = paredEnZona(fecha);
  return instanteDesdePared(p.anio, p.mes, p.dia, 23, 59, 59, 999);
}
