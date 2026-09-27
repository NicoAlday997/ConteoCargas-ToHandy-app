import { MAXIMO_DIAS_BUSQUEDA } from '../domain/calendario-laboral';
import { normalizarFechaOperativa } from '../domain/fecha-operativa';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Los dias no laborables que el calendario puede necesitar para decidir desde
 * `ahora`: de hoy hasta un poco mas alla del tope de busqueda de
 * `siguienteDiaHabil`, y hasta `fecha` si cae mas lejos (el supervisor puede
 * elegir cualquier dia habil futuro).
 */
export async function diasNoLaborablesDesde(
  repositorio: DiaNoLaborableRepository,
  ahora: Date,
  fecha?: Date,
): Promise<Date[]> {
  const desde = normalizarFechaOperativa(ahora);
  // +2 dias de holgura: cubre el tope completo aun con dias de 23 horas.
  const tope = new Date(desde.getTime() + (MAXIMO_DIAS_BUSQUEDA + 2) * MS_POR_DIA);
  const hasta = fecha !== undefined && fecha > tope ? fecha : tope;
  const dias = await repositorio.listarEntre(desde, hasta);
  return dias.map((d) => d.fecha);
}
