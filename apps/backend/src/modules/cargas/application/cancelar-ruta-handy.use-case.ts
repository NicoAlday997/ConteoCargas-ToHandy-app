import {
  HandyErrorServidorError,
  HandyGateway,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
} from '../../sincronizacion/application/handy.gateway';
import { puedeTransicionar } from '../domain/estados-carga';
import {
  MOTIVO_MINIMO_SUPERVISOR,
  normalizarMotivo,
} from './cancelar-carga.use-case';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: el supervisor cancela en Handy una carga ya ENVIADA
 * (`DELETE /route/{id}`) y, solo si Handy lo confirma, la marca CANCELADA.
 *
 * Handy solo permite cancelar mientras el vendedor no haya aceptado la ruta en
 * su celular (docs/02 seccion 4.2). Si Handy dice que no, NO se toca nada: la
 * carga sigue ENVIADA porque sigue existiendo en Handy. Nunca se da por
 * cancelado lo que Handy no cancelo.
 *
 * Es la UNICA via a la transicion ENVIADA -> CANCELADA (ver cabecera de
 * `domain/estados-carga.ts`).
 *
 * El motivo se valida ANTES de llamar a Handy: si no, podria cancelarse alla
 * y fallar aca, dejando las dos partes desalineadas.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos
 * (`CargaRepository`, `HandyGateway`), nunca de infraestructura.
 */

export interface EntradaCancelarRutaHandy {
  eventoId: string;
  /** Id del supervisor (el controlador ya restringe el endpoint a SUPERVISOR). */
  usuarioAppId: string;
  motivo?: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `NO_ENCONTRADA`: el evento no existe.
 * - `ESTADO_INVALIDO`: no esta ENVIADA o no tiene `idHandy`.
 * - `MOTIVO_REQUERIDO`: sin motivo o demasiado corto.
 * - `HANDY_RECHAZO`: Handy ya no permite cancelar la ruta (tipicamente, el
 *   vendedor ya la acepto). No se cambio nada.
 * - `HANDY_NO_DISPONIBLE`: Handy no respondio o fallo; no se sabe si cancelo.
 *   No se cambio nada; se puede reintentar.
 */
export type ResultadoCancelarRutaHandy =
  | { exito: true; evento: EventoCarga }
  | {
      exito: false;
      motivo:
        | 'NO_ENCONTRADA'
        | 'ESTADO_INVALIDO'
        | 'MOTIVO_REQUERIDO'
        | 'HANDY_RECHAZO'
        | 'HANDY_NO_DISPONIBLE';
    };

export class CancelarRutaHandyUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly handy: HandyGateway,
  ) {}

  async ejecutar(
    entrada: EntradaCancelarRutaHandy,
    ahora: Date,
  ): Promise<ResultadoCancelarRutaHandy> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'NO_ENCONTRADA' };
    }
    if (
      evento.estado !== 'ENVIADA' ||
      evento.idHandy === null ||
      !puedeTransicionar(evento.estado, 'CANCELADA')
    ) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    const motivo = normalizarMotivo(entrada.motivo);
    if (motivo === null || motivo.length < MOTIVO_MINIMO_SUPERVISOR) {
      return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
    }

    let cancelada: boolean;
    try {
      cancelada = await this.handy.cancelarRuta(evento.idHandy);
    } catch (error) {
      if (
        error instanceof HandyTokenInvalidoError ||
        error instanceof HandyErrorServidorError ||
        error instanceof HandySinRespuestaError ||
        error instanceof HandyRespuestaNoOkError
      ) {
        return { exito: false, motivo: 'HANDY_NO_DISPONIBLE' };
      }
      throw error;
    }

    if (!cancelada) {
      return { exito: false, motivo: 'HANDY_RECHAZO' };
    }

    const cancelado = await this.cargas.cancelarEvento(
      entrada.eventoId,
      entrada.usuarioAppId,
      motivo,
      ahora,
    );
    return { exito: true, evento: cancelado };
  }
}
