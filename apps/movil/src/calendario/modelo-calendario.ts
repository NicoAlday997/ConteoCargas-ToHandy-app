/**
 * Cuadrícula de un mes para que el supervisor elija qué día marcar como no
 * laborable. Solo aritmética de calendario sobre `aaaa-mm-dd`: qué días se
 * trabajan lo decide el servidor, que rechaza lo que no aplique.
 */

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Encabezado de columnas: la semana empieza en lunes, el domingo al final. */
export const DIAS_CABECERA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export interface Mes {
  anio: number;
  /** 1-12. */
  mes: number;
}

export interface CeldaDia {
  dia: string;
  numero: number;
  esDomingo: boolean;
}

const dos = (n: number) => String(n).padStart(2, '0');

export function mesDe(dia: string): Mes {
  const [anio, mes] = dia.split('-').map(Number);
  return { anio, mes };
}

export function moverMes({ anio, mes }: Mes, delta: number): Mes {
  const indice = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** "Diciembre 2026". */
export function tituloMes({ anio, mes }: Mes): string {
  return `${MESES[mes - 1]} ${anio}`;
}

/**
 * Semanas del mes, de lunes a domingo; `null` en los huecos antes del día 1 y
 * después del último.
 */
export function semanasDelMes({ anio, mes }: Mes): (CeldaDia | null)[][] {
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  // getUTCDay: 0 = domingo. Con lunes primero, el domingo va en la columna 6.
  const columnaDelUno =
    (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
  const celdas: (CeldaDia | null)[] = Array.from(
    { length: columnaDelUno },
    () => null,
  );
  for (let numero = 1; numero <= diasDelMes; numero += 1) {
    celdas.push({
      dia: `${anio}-${dos(mes)}-${dos(numero)}`,
      numero,
      esDomingo: (columnaDelUno + numero - 1) % 7 === 6,
    });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas: (CeldaDia | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7)
    semanas.push(celdas.slice(i, i + 7));
  return semanas;
}
