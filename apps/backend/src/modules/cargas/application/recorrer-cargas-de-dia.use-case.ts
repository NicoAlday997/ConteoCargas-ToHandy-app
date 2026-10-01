import {
  esFechaPermitidaPorCalendario,
  SinDiasHabilesError,
  siguienteDiaHabil,
} from '../domain/calendario-laboral';
import { permiteCambioFechaDelSupervisor } from '../domain/estados-carga';
import {
  esFechaOperativaValida,
  normalizarFechaOperativa,
} from '../domain/fecha-operativa';
import {
  MOTIVO_MINIMO_RECORRER,
  normalizarMotivo,
} from './cancelar-carga.use-case';
import { diasNoLaborablesDesde } from './calendario';
import {
  CargaInicialDuplicadaError,
  type CargaRepository,
} from './carga.repository';
import type {
  CargaDelDia,
  ConsultasCargaRepository,
} from './consultas-carga.repository';
import type { DiaNoLaborableRepository } from './dia-no-laborable.repository';

/**
 * Caso de uso: recorrer TODAS las cargas de un dia que al final no se trabajo
 * (frio, paro, clima) a otro dia habil (docs/04 `POST /admin/cargas/recorrer`,
 * docs/01 §6). Solo SUPERVISOR; lo exige el controlador con `@Roles`.
 *
 * Contexto: los camiones amanecen cargados y el dia no ocurre. En Handy no hay
 * nada que mover (la ruta sigue abierta y mañana el vendedor sale con la misma
 * carga fisica); lo que esta mal es NUESTRA `fechaOperativa`. Sin corregirla
 * el historial miente y la regla del corte pendiente cuenta dias de retraso
 * que no son reales.
 *
 * ALCANCE, la decision menos obvia: se mueven todas las cargas de esa fecha
 * que NO esten CANCELADA ni ENVIO_INCIERTO, y las ENVIADA TAMBIEN se mueven.
 * Una carga enviada es justo el caso tipico (se conto y se envio para un dia
 * que no se trabajo), y cambiar su fecha solo corrige nuestro registro: la
 * ruta en Handy no se toca (mismo criterio que
 * `permiteCambioFechaDelSupervisor`). CANCELADA no tiene salida que mover y
 * ENVIO_INCIERTO primero se resuelve; esas se quedan donde estan.
 *
 * Reglas:
 * - `fechaDestino` posterior a `fechaOrigen`, nunca un dia pasado, y dia
 *   HABIL (`esFechaPermitidaPorCalendario` con 'SUPERVISOR').
 * - Motivo obligatorio (minimo `MOTIVO_MINIMO_RECORRER`), el mismo para
 *   todas; queda en la bitacora de cada carga.
 * - Una INICIAL por ruta y fecha: si alguna INICIAL que se mueve choca con
 *   otra que ya esta en el destino, NO se mueve NINGUNA y se responde
 *   `CONFLICTO_EN_DESTINO` con las rutas que chocan.
 * - Las RECARGAS no pasan por la regla de "el dia nuevo tiene una INICIAL
 *   enviada": se mueven junto con la INICIAL de su ruta, que viaja en el
 *   mismo recorrido.
 * - TODO en una transaccion (`recorrerFechaOperativa`): un recorrido a medias
 *   parte el dia en dos y nadie sabria cuales faltan. Sesiones e items no se
 *   tocan.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */

export interface EntradaRecorrerCargasDeDia {
  fechaOrigen: Date;
  fechaDestino: Date;
  motivo: string;
  usuarioAppId: string;
}

/** Una ruta cuya INICIAL choca con la que ya existe en el destino. */
export interface RutaEnConflicto {
  rutaId: string;
  rutaNombre: string;
  /** La INICIAL que ya esta en el destino. */
  eventoIdEnDestino: string;
}

/**
 * - `MOTIVO_REQUERIDO`: sin motivo o mas corto que el minimo.
 * - `FECHA_DESTINO_INVALIDA`: el destino no es posterior al origen o ya paso.
 * - `FECHA_NO_DISPONIBLE`: el destino no es dia habil.
 * - `CONFLICTO_EN_DESTINO`: alguna ruta ya tiene INICIAL en el destino.
 */
export type ResultadoRecorrerCargasDeDia =
  | { exito: true; movidas: number; eventos: CargaDelDia[] }
  | {
      exito: false;
      motivo:
        'MOTIVO_REQUERIDO' | 'FECHA_DESTINO_INVALIDA' | 'FECHA_NO_DISPONIBLE';
    }
  | { exito: false; motivo: 'CONFLICTO_EN_DESTINO'; rutas: RutaEnConflicto[] };

/** Lo que muestra la app antes de recorrer. */
export interface PrevisualizacionRecorrido {
  /** Las que se moverian. */
  cargas: CargaDelDia[];
  /** Las que se quedan (CANCELADA, ENVIO_INCIERTO), para decirlo. */
  excluidas: CargaDelDia[];
  /** El siguiente dia habil despues de la fecha; `null` si no hay ninguno cerca. */
  destinoSugerido: Date | null;
}

/** Si una carga de ese dia se recorre con el dia. Ver la cabecera. */
export function seRecorreConElDia(carga: Pick<CargaDelDia, 'estado'>): boolean {
  return permiteCambioFechaDelSupervisor(carga.estado);
}

export class RecorrerCargasDeDiaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly consultas: ConsultasCargaRepository,
    private readonly diasNoLaborables: DiaNoLaborableRepository,
  ) {}

  async previsualizar(
    fecha: Date,
    ahora: Date,
  ): Promise<PrevisualizacionRecorrido> {
    const dia = normalizarFechaOperativa(fecha);
    const todas = await this.consultas.listarCargasDeFecha(dia);
    const noLaborables = await diasNoLaborablesDesde(
      this.diasNoLaborables,
      // El dia puede ser pasado (se marca tarde); se busca desde el mas antiguo.
      dia < ahora ? dia : ahora,
    );
    let destinoSugerido: Date | null;
    try {
      destinoSugerido = siguienteDiaHabil(dia, noLaborables);
    } catch (error) {
      if (!(error instanceof SinDiasHabilesError)) throw error;
      destinoSugerido = null;
    }
    return {
      cargas: todas.filter(seRecorreConElDia),
      excluidas: todas.filter((c) => !seRecorreConElDia(c)),
      destinoSugerido,
    };
  }

  async ejecutar(
    entrada: EntradaRecorrerCargasDeDia,
    ahora: Date,
  ): Promise<ResultadoRecorrerCargasDeDia> {
    const motivo = normalizarMotivo(entrada.motivo);
    if (motivo === null || motivo.length < MOTIVO_MINIMO_RECORRER) {
      return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
    }

    const origen = normalizarFechaOperativa(entrada.fechaOrigen);
    const destino = normalizarFechaOperativa(entrada.fechaDestino);
    if (destino <= origen || !esFechaOperativaValida(destino, ahora)) {
      return { exito: false, motivo: 'FECHA_DESTINO_INVALIDA' };
    }

    const noLaborables = await diasNoLaborablesDesde(
      this.diasNoLaborables,
      ahora,
      destino,
    );
    if (
      !esFechaPermitidaPorCalendario(destino, 'SUPERVISOR', ahora, noLaborables)
    ) {
      return { exito: false, motivo: 'FECHA_NO_DISPONIBLE' };
    }

    const aMover = (await this.consultas.listarCargasDeFecha(origen)).filter(
      seRecorreConElDia,
    );
    if (aMover.length === 0) {
      return { exito: true, movidas: 0, eventos: [] };
    }

    // Antes de tocar nada: una sola INICIAL por ruta y fecha.
    const conflictos = await this.conflictosEnDestino(aMover, destino);
    if (conflictos.length > 0) {
      return {
        exito: false,
        motivo: 'CONFLICTO_EN_DESTINO',
        rutas: conflictos,
      };
    }

    try {
      await this.cargas.recorrerFechaOperativa({
        eventos: aMover.map((c) => ({
          eventoId: c.id,
          fechaAnterior: c.fechaOperativa,
        })),
        fechaNueva: destino,
        cambiadaPorId: entrada.usuarioAppId,
        motivo,
      });
    } catch (error) {
      // Carrera: otra INICIAL se creo en el destino entre la revision y el
      // recorrido. La transaccion ya se deshizo: no se movio ninguna.
      if (error instanceof CargaInicialDuplicadaError) {
        const tardios = await this.conflictosEnDestino(aMover, destino);
        if (tardios.length > 0) {
          return {
            exito: false,
            motivo: 'CONFLICTO_EN_DESTINO',
            rutas: tardios,
          };
        }
      }
      throw error;
    }

    return {
      exito: true,
      movidas: aMover.length,
      eventos: aMover.map((c) => ({ ...c, fechaOperativa: destino })),
    };
  }

  private async conflictosEnDestino(
    aMover: CargaDelDia[],
    destino: Date,
  ): Promise<RutaEnConflicto[]> {
    const conflictos: RutaEnConflicto[] = [];
    for (const carga of aMover) {
      if (carga.tipo !== 'INICIAL') continue;
      const existente = await this.cargas.buscarCargaInicialDeFecha(
        carga.rutaId,
        destino,
      );
      if (existente !== null) {
        conflictos.push({
          rutaId: carga.rutaId,
          rutaNombre: carga.rutaNombre,
          eventoIdEnDestino: existente.id,
        });
      }
    }
    return conflictos;
  }
}
