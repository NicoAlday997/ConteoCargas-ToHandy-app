/**
 * Fecha operativa: el DÍA para el que sale el camión, no cuándo se contó. Lo
 * normal es contar por la tarde para salir mañana; si el camión se descompuso,
 * se cuenta en la mañana para salir hoy. Lo decide quien cuenta: la app solo
 * propone, con la misma regla que el backend (`domain/fecha-operativa`).
 *
 * Los días viajan como texto `aaaa-mm-dd` (así los pide `POST /eventos-carga`)
 * y se calculan en la hora del negocio, no en la del teléfono. Sin Intl: Hermes
 * no siempre trae zonas horarias. America/Mexico_City es UTC-6 fijo desde que
 * se quitó el horario de verano (2022).
 */

const DESFASE_NEGOCIO_MS = -6 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
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

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Reloj de pared del negocio, leído con los getters UTC. */
function pared(instante: Date): Date {
  return new Date(instante.getTime() + DESFASE_NEGOCIO_MS);
}

function aTexto(utc: Date): string {
  return `${utc.getUTCFullYear()}-${dosDigitos(utc.getUTCMonth() + 1)}-${dosDigitos(utc.getUTCDate())}`;
}

/** Mediodía UTC del día: lejos de los bordes, para aritmética de días. */
function desdeTexto(dia: string): Date | null {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!coincide) return null;
  const [anio, mes, diaMes] = coincide.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, diaMes, 12));
  // Rechaza días inexistentes (2026-02-30), que Date.UTC acomodaría en marzo.
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== diaMes) return null;
  return fecha;
}

export function esDia(valor: unknown): valor is string {
  return typeof valor === 'string' && desdeTexto(valor) !== null;
}

/** Día del negocio (`aaaa-mm-dd`) que contiene a `instante`. */
export function diaNegocio(instante: Date): string {
  return aTexto(pared(instante));
}

export function sumarDias(dia: string, dias: number): string {
  const fecha = desdeTexto(dia);
  if (!fecha) throw new TypeError(`sumarDias: se esperaba aaaa-mm-dd: ${dia}`);
  return aTexto(new Date(fecha.getTime() + dias * MS_POR_DIA));
}

export interface OpcionesFechaOperativa {
  hoy: string;
  manana: string;
  /** Siempre mañana: contar para hoy es la excepción (camión descompuesto) y se elige a mano. */
  propuesta: 'hoy' | 'manana';
}

/** Las únicas dos fechas que se ofrecen. Nunca un día pasado. */
export function opcionesFechaOperativa(ahora: Date): OpcionesFechaOperativa {
  const hoy = diaNegocio(ahora);
  return {
    hoy,
    manana: sumarDias(hoy, 1),
    propuesta: 'manana',
  };
}

/**
 * La fecha operativa como la devuelve el backend: el instante en que empieza
 * ese día en México (`2026-09-24T06:00:00.000Z`). También acepta `aaaa-mm-dd`.
 */
export function diaDesdeApi(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (esDia(valor)) return valor;
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? null : diaNegocio(instante);
}

/** "17:05": hora del negocio, en 24 h, sin depender de la zona del teléfono. */
export function horaNegocio(instante: Date): string {
  const utc = pared(instante);
  return `${dosDigitos(utc.getUTCHours())}:${dosDigitos(utc.getUTCMinutes())}`;
}

/** "Jueves 24 de septiembre". */
export function formatearDia(dia: string): string {
  const fecha = desdeTexto(dia);
  if (!fecha) return dia;
  return `${DIAS_SEMANA[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

/** "24 sep": para listas y tarjetas, donde la fecha larga se corta. */
export function formatearFechaCorta(dia: string): string {
  const fecha = desdeTexto(dia);
  if (!fecha) return dia;
  return `${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()].slice(0, 3)}`;
}

/** "Sale mañana, sáb 26 de septiembre": el subtítulo del encabezado de conteo, en un renglón. */
export function textoSalidaCorta(dia: string, hoy: string): string {
  const fecha = desdeTexto(dia);
  if (!fecha) return dia;
  const legible = `${DIAS_CORTOS[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
  if (dia === hoy) return `Sale hoy, ${legible}`;
  if (dia === sumarDias(hoy, 1)) return `Sale mañana, ${legible}`;
  return `Sale el ${legible}`;
}

/** "Hoy", "Mañana" o "Ayer" respecto a `hoy`; `null` para cualquier otro día. */
export function diaRelativo(dia: string, hoy: string): 'Hoy' | 'Mañana' | 'Ayer' | null {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  return null;
}

/** "Sale mañana, jueves 24 de septiembre" o, lejos de hoy, "Sale el jueves 24 de septiembre". */
export function textoSalida(dia: string, hoy: string): string {
  const legible = formatearDia(dia);
  const enFrase = legible.charAt(0).toLowerCase() + legible.slice(1);
  if (dia === hoy) return `Sale hoy, ${enFrase}`;
  if (dia === sumarDias(hoy, 1)) return `Sale mañana, ${enFrase}`;
  return `Sale el ${enFrase}`;
}

/** "de hoy", "de mañana" o "del jueves 24 de septiembre": completa "la salida …". */
export function deLaSalida(dia: string, hoy: string): string {
  // Mismas palabras que `textoSalida`: "Sale hoy, …" → "de hoy".
  const texto = textoSalida(dia, hoy);
  if (texto.startsWith('Sale hoy')) return 'de hoy';
  if (texto.startsWith('Sale mañana')) return 'de mañana';
  return `del ${texto.slice('Sale el '.length)}`;
}
