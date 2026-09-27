import { esDiaHabil } from '../domain/calendario-laboral';
import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import {
  type DiaNoLaborable,
  DiaNoLaborableDuplicadoError,
  type DiaNoLaborableRepository,
} from './dia-no-laborable.repository';

/** Minimo de caracteres del motivo al marcar un dia no laborable. */
export const MOTIVO_MINIMO_DIA_NO_LABORABLE = 3;

/**
 * Caso de uso: el supervisor marca un dia que no se trabaja (festivo, paro,
 * clima, cierre) (docs/04 `POST /admin/dias-no-laborables`).
 *
 * - Nunca un dia pasado: no cambia nada y ensuciaria el calendario.
 * - Nunca un dia que ya no es habil por la semana (el domingo): esa regla
 *   vive en `DIAS_HABILES_SEMANA`, no en la tabla.
 * - Un dia se marca una sola vez; la fecha es la llave.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */
export type ResultadoMarcarDiaNoLaborable =
  | { exito: true; dia: DiaNoLaborable }
  | {
      exito: false;
      motivo: 'FECHA_PASADA' | 'NO_SE_TRABAJA_POR_SEMANA' | 'MOTIVO_REQUERIDO' | 'YA_MARCADO';
    };

export class MarcarDiaNoLaborableUseCase {
  constructor(private readonly diasNoLaborables: DiaNoLaborableRepository) {}

  async ejecutar(
    entrada: { fecha: Date; motivo: string; usuarioAppId: string },
    ahora: Date,
  ): Promise<ResultadoMarcarDiaNoLaborable> {
    if (!esFechaOperativaValida(entrada.fecha, ahora)) {
      return { exito: false, motivo: 'FECHA_PASADA' };
    }
    const fecha = normalizarFechaOperativa(entrada.fecha);
    // Sin dias marcados, un dia no habil solo puede serlo por la semana.
    if (!esDiaHabil(fecha, [])) {
      return { exito: false, motivo: 'NO_SE_TRABAJA_POR_SEMANA' };
    }
    const motivo = entrada.motivo.trim();
    if (motivo.length < MOTIVO_MINIMO_DIA_NO_LABORABLE) {
      return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
    }
    try {
      const dia = await this.diasNoLaborables.marcar(
        fecha,
        motivo,
        entrada.usuarioAppId,
      );
      return { exito: true, dia };
    } catch (error) {
      if (error instanceof DiaNoLaborableDuplicadoError) {
        return { exito: false, motivo: 'YA_MARCADO' };
      }
      throw error;
    }
  }
}
