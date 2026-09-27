import {
  diasHabilesDesde,
  diaTexto,
  etiquetaFechaOperativa,
  opcionesFechaOperativa,
} from '../domain/calendario-laboral';
import { diasNoLaborablesDesde } from './calendario';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';

/**
 * Caso de uso: que fechas operativas puede elegir quien inicia o mueve una
 * carga (docs/04 `GET /eventos-carga/fechas-operativas-disponibles`). La app
 * ya no genera fechas: muestra estas, con la etiqueta que arma el servidor
 * (depende del calendario: el sabado la siguiente salida es "El lunes...", no
 * "mañana").
 *
 * - VENDEDOR: `opcionesFechaOperativa` (hoy si se trabaja, y la siguiente
 *   salida). Una o dos.
 * - SUPERVISOR: todos los dias habiles de hoy en adelante dentro del tope de
 *   busqueda; es lo que puede elegir al mover una carga.
 *
 * Si los dias no laborables no dejan ningun dia habil, `opcionesFechaOperativa`
 * lanza `SinDiasHabilesError` y aqui se deja pasar: es un error de
 * configuracion, no se inventa una fecha.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */

export interface FechaOperativaDisponible {
  /** Inicio del dia en la zona del negocio. */
  fecha: Date;
  /** `aaaa-mm-dd`, como lo pide `POST /eventos-carga`. */
  dia: string;
  etiqueta: string;
  esHoy: boolean;
}

export class ListarFechasOperativasDisponiblesUseCase {
  constructor(private readonly diasNoLaborables: DiaNoLaborableRepository) {}

  async ejecutar(
    quien: 'VENDEDOR' | 'SUPERVISOR',
    ahora: Date,
  ): Promise<FechaOperativaDisponible[]> {
    const noLaborables = await diasNoLaborablesDesde(this.diasNoLaborables, ahora);
    const fechas =
      quien === 'SUPERVISOR'
        ? diasHabilesDesde(ahora, noLaborables)
        : opcionesFechaOperativa(ahora, noLaborables);
    const hoy = diaTexto(ahora);
    return fechas.map((fecha) => ({
      fecha,
      dia: diaTexto(fecha),
      etiqueta: etiquetaFechaOperativa(fecha, ahora),
      esHoy: diaTexto(fecha) === hoy,
    }));
  }
}
