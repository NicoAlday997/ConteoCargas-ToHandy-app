/**
 * Calendario laboral: que dias sale un camion. Funciones puras: reciben `ahora`
 * y la lista de dias no laborables en lugar de leer el reloj o la base.
 *
 * El negocio trabaja de LUNES A SABADO (`DIAS_HABILES_SEMANA`). Ademas hay
 * dias sueltos que no se trabajan (festivos, paros, clima) y periodos
 * completos (Navidad, Año Nuevo): esos los marca un supervisor y llegan aqui
 * como `diasNoLaborables`. El domingo NO se marca: sale de la semana.
 *
 * Todo "dia" se calcula en la zona del negocio (America/Mexico_City) y se
 * representa con el instante en que empieza (`inicioDelDiaNegocio`), igual
 * que la fecha operativa (`domain/fecha-operativa`).
 */

import {
  inicioDelDiaNegocio,
  ZONA_NEGOCIO,
} from '../../sincronizacion/domain/fecha-handy';
import { fechaOperativaDesdeDia } from './fecha-operativa';

/** Domingo (0) no se trabaja. Si algún día se trabajara, se cambia aquí. */
export const DIAS_HABILES_SEMANA = [1, 2, 3, 4, 5, 6];

/**
 * Tope de búsqueda: un cierre largo (Navidad + Año Nuevo) cabe de sobra.
 * Sin tope, una configuración equivocada cuelga el servidor.
 */
export const MAXIMO_DIAS_BUSQUEDA = 30;

/**
 * No hay ningun dia habil en `MAXIMO_DIAS_BUSQUEDA` dias: los dias no
 * laborables estan mal configurados. Se lanza en vez de inventar una fecha.
 */
export class SinDiasHabilesError extends Error {
  constructor(desde: Date) {
    super(
      `No hay ningun dia habil en los ${MAXIMO_DIAS_BUSQUEDA} dias posteriores a ${diaTexto(desde)}: revisa los dias no laborables.`,
    );
    this.name = 'SinDiasHabilesError';
  }
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const formateadorDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `aaaa-mm-dd` del dia de negocio que contiene a `fecha`. */
export function diaTexto(fecha: Date): string {
  // en-CA ya da aaaa-mm-dd.
  return formateadorDia.format(fecha);
}

/** Año, mes (1-12), dia y dia de la semana (0 = domingo) en la zona del negocio. */
function partesDelDia(fecha: Date): {
  anio: number;
  mes: number;
  dia: number;
  diaSemana: number;
} {
  const [anio, mes, dia] = diaTexto(fecha).split('-').map(Number);
  // Aritmetica de calendario pura: el dia de la semana no depende de la zona
  // una vez que ya se sabe que dia calendario es.
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return { anio, mes, dia, diaSemana };
}

/** Inicio del dia de negocio `n` dias despues del que contiene a `fecha`. */
function sumarDias(fecha: Date, n: number): Date {
  const { anio, mes, dia } = partesDelDia(fecha);
  const destino = new Date(Date.UTC(anio, mes - 1, dia + n));
  return fechaOperativaDesdeDia(destino.toISOString().slice(0, 10));
}

/**
 * Habil si su dia de la semana esta en `DIAS_HABILES_SEMANA` y no esta en
 * `diasNoLaborables`. Compara dias de negocio: la hora no importa.
 */
export function esDiaHabil(fecha: Date, diasNoLaborables: Date[]): boolean {
  if (!DIAS_HABILES_SEMANA.includes(partesDelDia(fecha).diaSemana)) {
    return false;
  }
  const dia = diaTexto(fecha);
  return !diasNoLaborables.some((noLaborable) => diaTexto(noLaborable) === dia);
}

/**
 * El primer dia habil DESPUES de `desde` (nunca el mismo dia), normalizado al
 * inicio de su dia de negocio. Lanza `SinDiasHabilesError` si no hay ninguno
 * en `MAXIMO_DIAS_BUSQUEDA` dias.
 */
export function siguienteDiaHabil(desde: Date, diasNoLaborables: Date[]): Date {
  for (let n = 1; n <= MAXIMO_DIAS_BUSQUEDA; n += 1) {
    const candidato = sumarDias(desde, n);
    if (esDiaHabil(candidato, diasNoLaborables)) {
      return candidato;
    }
  }
  throw new SinDiasHabilesError(desde);
}

/**
 * Las UNICAS fechas operativas que puede elegir un vendedor, en orden. A lo
 * mucho dos:
 * - hoy, solo si hoy es habil (el camion se descompuso y se carga hoy para
 *   salir hoy);
 * - el siguiente dia habil (lo normal: se cuenta por la tarde para la
 *   siguiente salida, que el sabado es el lunes).
 */
export function opcionesFechaOperativa(
  ahora: Date,
  diasNoLaborables: Date[],
): Date[] {
  const hoy = inicioDelDiaNegocio(ahora);
  const opciones: Date[] = [];
  if (esDiaHabil(hoy, diasNoLaborables)) {
    opciones.push(hoy);
  }
  opciones.push(siguienteDiaHabil(hoy, diasNoLaborables));
  return opciones;
}

/**
 * Dias habiles de hoy en adelante, dentro de `MAXIMO_DIAS_BUSQUEDA` dias: lo
 * que el supervisor puede elegir al mover una carga (para recorrer cargas
 * cuando no se trabajo un dia). Puede venir vacia solo si la configuracion es
 * imposible.
 */
export function diasHabilesDesde(ahora: Date, diasNoLaborables: Date[]): Date[] {
  const hoy = inicioDelDiaNegocio(ahora);
  const dias: Date[] = [];
  for (let n = 0; n <= MAXIMO_DIAS_BUSQUEDA; n += 1) {
    const candidato = sumarDias(hoy, n);
    if (esDiaHabil(candidato, diasNoLaborables)) {
      dias.push(candidato);
    }
  }
  return dias;
}

/**
 * Como se le nombra el dia al usuario. Nunca dice "mañana" si el dia no es
 * mañana: el sabado, la siguiente salida es "El lunes 28 de septiembre".
 *
 * - hoy:     "Hoy, sábado 26 de septiembre"
 * - mañana:  "Mañana, martes 29 de septiembre"
 * - otro:    "El lunes 28 de septiembre"
 */
export function etiquetaFechaOperativa(fecha: Date, ahora: Date): string {
  const { mes, dia, diaSemana } = partesDelDia(fecha);
  const legible = `${DIAS_SEMANA[diaSemana]} ${dia} de ${MESES[mes - 1]}`;
  const texto = diaTexto(fecha);
  if (texto === diaTexto(ahora)) {
    return `Hoy, ${legible}`;
  }
  if (texto === diaTexto(sumarDias(ahora, 1))) {
    return `Mañana, ${legible}`;
  }
  return `El ${legible}`;
}

/**
 * Si quien elige puede usar esa fecha operativa, segun el calendario (que no
 * sea un dia pasado lo revisa aparte `esFechaOperativaValida`):
 * - VENDEDOR: solo una de `opcionesFechaOperativa` (hoy si es habil, o la
 *   siguiente salida). Nada de cargar para dentro de seis dias.
 * - SUPERVISOR: cualquier dia habil; lo necesita para recorrer cargas cuando
 *   no se trabajo un dia.
 */
export function esFechaPermitidaPorCalendario(
  fecha: Date,
  quien: 'VENDEDOR' | 'SUPERVISOR',
  ahora: Date,
  diasNoLaborables: Date[],
): boolean {
  if (quien === 'SUPERVISOR') {
    return esDiaHabil(fecha, diasNoLaborables);
  }
  const dia = diaTexto(fecha);
  return opcionesFechaOperativa(ahora, diasNoLaborables).some(
    (opcion) => diaTexto(opcion) === dia,
  );
}
