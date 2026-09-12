import { puedeTransicionar, requiereAutorizacion } from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: el supervisor autoriza el envio de una carga ya conciliada por
 * el doble conteo (CLAUDE.md: "ninguna carga va a Handy sin autorizacion de un
 * supervisor"; docs/02 seccion 3.1). Es el tercer par de ojos que cierra el
 * punto ciego del doble conteo — que ambos conteos se equivoquen igual, o se
 * pongan de acuerdo — lo haya revisado fisicamente o no.
 *
 * Solo aplica sobre eventos en `EN_ESPERA_AUTORIZACION` (`requiereAutorizacion`
 * del dominio). La transicion a `LISTA_PARA_ENVIAR` se valida SIEMPRE contra
 * `puedeTransicionar` antes de persistir, mismo criterio que el resto del
 * modulo.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaAutorizarCarga {
  eventoId: string;
  /** Id del supervisor que autoriza (viaja en el JWT). */
  usuarioAppId: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * Motivos de rechazo:
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `EN_ESPERA_AUTORIZACION`.
 * - `TRANSICION_INVALIDA`: guardarrail defensivo; inalcanzable mientras
 *   `EN_ESPERA_AUTORIZACION -> LISTA_PARA_ENVIAR` siga declarada en la maquina
 *   de estados del dominio.
 */
export type ResultadoAutorizarCarga =
  | { exito: true; evento: EventoCarga }
  | { exito: false; motivo: 'ESTADO_INVALIDO' | 'TRANSICION_INVALIDA' };

export class AutorizarCargaUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    entrada: EntradaAutorizarCarga,
    ahora: Date,
  ): Promise<ResultadoAutorizarCarga> {
    // 1. El evento debe existir y estar en EN_ESPERA_AUTORIZACION. Un evento
    //    inexistente cae aca tambien: no hay nada que autorizar.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || !requiereAutorizacion(evento.estado)) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. La transicion siempre se valida contra la maquina de estados del
    //    dominio antes de persistir.
    if (!puedeTransicionar(evento.estado, 'LISTA_PARA_ENVIAR')) {
      return { exito: false, motivo: 'TRANSICION_INVALIDA' };
    }

    // 3. Persistir autorizadaPorId + fechaAutorizacion + el nuevo estado en
    //    una sola operacion (ver `autorizarEvento` del puerto).
    const autorizado = await this.cargas.autorizarEvento(
      entrada.eventoId,
      entrada.usuarioAppId,
      ahora,
    );

    return { exito: true, evento: autorizado };
  }
}
