import {
  HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import {
  permiteVerificacionDelContador,
  puedeTransicionar,
} from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: detecta si el vendedor de la carga tiene una ruta anterior
 * abierta en Handy (corte de venta sin cerrar) y, de ser asi, bloquea la
 * verificacion del contador (RF-13, docs/01 seccion 6 regla 2; docs/02 seccion
 * 4.5).
 *
 * REGLA CLAVE: el bloqueo aplica UNICAMENTE a la verificacion del contador. El
 * vendedor siempre puede contar sin restriccion, incluso con corte pendiente
 * (`permiteConteoDelVendedor` del dominio ya lo admite en
 * `BLOQUEADA_CORTE_PENDIENTE`). Este caso de uso no toca el conteo del
 * vendedor en absoluto.
 *
 * Solo aplica a cargas INICIALES: una RECARGA nunca se bloquea (ver el
 * comentario en `ejecutar`).
 *
 * Se dispara on-demand al abrir la cola/sesion del contador (docs/02 seccion
 * 4.5: "verificacion hibrida"); el job en background cada 15-30 minutos es
 * responsabilidad de otro disparador que reutiliza este mismo caso de uso.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos
 * (`CargaRepository`, `HandyGateway`), nunca de infraestructura.
 */

/** Datos que el disparador (controller o job) provee. */
export interface EntradaVerificarCortePendiente {
  eventoId: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `bloqueado: false`: no hay ruta abierta anterior; no se toco nada.
 * - `bloqueado: true`: se detecto ruta abierta y el evento paso a
 *   `BLOQUEADA_CORTE_PENDIENTE`. `generarAlertaMedia` siempre viaja en `true`
 *   (docs/02 seccion 4.5: nace en urgencia media, escala a alta si persiste).
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `EN_ESPERA_CONTADOR`
 *   (`permiteVerificacionDelContador` del dominio).
 */
export type ResultadoVerificarCortePendiente =
  | { exito: true; bloqueado: false }
  | {
      exito: true;
      bloqueado: true;
      evento: EventoCarga;
      rutaHandyId: string;
      generarAlertaMedia: true;
    }
  | { exito: false; motivo: 'ESTADO_INVALIDO' };

export class VerificarCortePendienteUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly handy: HandyGateway,
  ) {}

  async ejecutar(
    entrada: EntradaVerificarCortePendiente,
    ahora: Date,
  ): Promise<ResultadoVerificarCortePendiente> {
    // 1. Solo tiene sentido verificar sobre un evento esperando al contador.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || !permiteVerificacionDelContador(evento.estado)) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // Una RECARGA ocurre, por definicion, con la ruta abierta en Handy: es la
    // ruta a la que se le suma producto (el envio usa /route/recharge, no
    // /route). La ruta abierta que detectaria la consulta ES la que se esta
    // recargando, no un corte anterior sin liquidar. La regla de corte
    // pendiente (docs/01 seccion 6 regla 2) existe para que no salga un camion
    // nuevo con el anterior sin cerrar; una recarga no es un camion nuevo.
    if (evento.tipo === 'RECARGA') {
      return { exito: true, bloqueado: false };
    }

    // 2. Consultar Handy: 404 (null) significa que no hay ruta abierta previa.
    const rutaAbierta: RutaHandy | null = await this.handy.consultarRutaAbierta(
      evento.usuarioHandyId,
    );
    if (rutaAbierta === null) {
      return { exito: true, bloqueado: false };
    }

    // 3. Hay corte pendiente: bloquear la verificacion. La transicion siempre
    //    se valida contra la maquina de estados del dominio antes de persistir.
    if (!puedeTransicionar(evento.estado, 'BLOQUEADA_CORTE_PENDIENTE')) {
      // Inalcanzable mientras EN_ESPERA_CONTADOR -> BLOQUEADA_CORTE_PENDIENTE
      // siga declarada en `estados-carga.ts`; guardarrail defensivo.
      throw new Error(
        `VerificarCortePendienteUseCase: transicion invalida ${evento.estado} -> BLOQUEADA_CORTE_PENDIENTE`,
      );
    }

    const bloqueado = await this.cargas.bloquearPorCortePendiente(
      entrada.eventoId,
      ahora,
    );

    return {
      exito: true,
      bloqueado: true,
      evento: bloqueado,
      rutaHandyId: rutaAbierta.id,
      generarAlertaMedia: true,
    };
  }
}
