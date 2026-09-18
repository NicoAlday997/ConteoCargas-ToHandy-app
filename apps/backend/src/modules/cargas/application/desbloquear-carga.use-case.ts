import {
  HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import { puedeTransicionar } from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: intenta liberar una carga bloqueada por corte de venta
 * pendiente (RF-13, docs/01 seccion 6 regla 2; docs/02 seccion 4.5). Vuelve a
 * consultar Handy y, si el vendedor ya cerro la ruta anterior, devuelve el
 * evento a `EN_ESPERA_CONTADOR` para que el contador pueda verificar.
 *
 * Complementa a `VerificarCortePendienteUseCase`: ese detecta el bloqueo y
 * este lo resuelve. Ambos disparadores validos: on-demand (el contador
 * reintenta) o el job en background cada 15-30 minutos (docs/02 seccion 4.5).
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos
 * (`CargaRepository`, `HandyGateway`), nunca de infraestructura.
 */

/** Datos que el disparador (controller o job) provee. */
export interface EntradaDesbloquearCarga {
  eventoId: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `sigueBloqueado: false`: la ruta anterior ya se cerro; el evento volvio a
 *   `EN_ESPERA_CONTADOR` y se devuelve actualizado.
 * - `sigueBloqueado: true`: la ruta anterior sigue abierta; no se toco nada.
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en
 *   `BLOQUEADA_CORTE_PENDIENTE`.
 */
export type ResultadoDesbloquearCarga =
  | { exito: true; sigueBloqueado: false; evento: EventoCarga }
  | { exito: true; sigueBloqueado: true }
  | { exito: false; motivo: 'ESTADO_INVALIDO' };

export class DesbloquearCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly handy: HandyGateway,
  ) {}

  async ejecutar(
    entrada: EntradaDesbloquearCarga,
    ahora: Date,
  ): Promise<ResultadoDesbloquearCarga> {
    // 1. Solo aplica sobre un evento efectivamente bloqueado.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || evento.estado !== 'BLOQUEADA_CORTE_PENDIENTE') {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. Volver a consultar Handy: 404 (null) significa que la ruta ya se
    //    cerro y el corte dejo de estar pendiente.
    const rutaAbierta: RutaHandy | null = await this.handy.consultarRutaAbierta(
      evento.usuarioHandyId,
    );
    if (rutaAbierta !== null) {
      return { exito: true, sigueBloqueado: true };
    }

    // 3. Liberar el bloqueo. La transicion siempre se valida contra la
    //    maquina de estados del dominio antes de persistir.
    if (!puedeTransicionar(evento.estado, 'EN_ESPERA_CONTADOR')) {
      // Inalcanzable mientras BLOQUEADA_CORTE_PENDIENTE -> EN_ESPERA_CONTADOR
      // siga declarada en `estados-carga.ts`; guardarrail defensivo.
      throw new Error(
        `DesbloquearCargaUseCase: transicion invalida ${evento.estado} -> EN_ESPERA_CONTADOR`,
      );
    }

    const desbloqueado = await this.cargas.desbloquearEvento(
      entrada.eventoId,
      ahora,
    );

    return { exito: true, sigueBloqueado: false, evento: desbloqueado };
  }
}
