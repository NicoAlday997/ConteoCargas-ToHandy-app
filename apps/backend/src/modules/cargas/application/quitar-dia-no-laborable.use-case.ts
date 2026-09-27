import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';

/**
 * Caso de uso: el supervisor quita un dia no laborable (docs/04
 * `DELETE /admin/dias-no-laborables/:fecha`), p. ej. se levanto el paro. Solo
 * de hoy en adelante: los dias pasados se quedan como registro de por que no
 * hubo salida.
 */
export type ResultadoQuitarDiaNoLaborable =
  | { exito: true }
  | { exito: false; motivo: 'FECHA_PASADA' | 'NO_MARCADO' };

export class QuitarDiaNoLaborableUseCase {
  constructor(private readonly diasNoLaborables: DiaNoLaborableRepository) {}

  async ejecutar(
    fecha: Date,
    ahora: Date,
  ): Promise<ResultadoQuitarDiaNoLaborable> {
    if (!esFechaOperativaValida(fecha, ahora)) {
      return { exito: false, motivo: 'FECHA_PASADA' };
    }
    const quitado = await this.diasNoLaborables.quitar(
      normalizarFechaOperativa(fecha),
    );
    return quitado ? { exito: true } : { exito: false, motivo: 'NO_MARCADO' };
  }
}
