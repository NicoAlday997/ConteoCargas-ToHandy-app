import {
  HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import {
  permiteVerificacionDelContador,
  puedeTransicionar,
} from '../domain/estados-carga';
import {
  diasEntreFechasOperativas,
  TOLERANCIA_DIAS_LIQUIDACION,
} from '../domain/fecha-operativa';
import type { CargaRepository, EventoCarga } from './carga.repository';
import type { ConsultasCargaRepository } from './consultas-carga.repository';

/**
 * Caso de uso: detecta si el vendedor de la carga tiene una ruta abierta en
 * Handy que impide la salida nueva (corte de venta sin cerrar) y, de ser asi,
 * bloquea la verificacion del contador (RF-13, docs/01 seccion 6 regla 2;
 * docs/02 seccion 4.5).
 *
 * La regla es "que no salga un camion nuevo con el anterior sin cerrar", NO
 * "que no haya ninguna ruta abierta": la carga de mañana se cuenta HOY en la
 * tarde, con el camion de hoy todavia en la calle sin liquidar. Por eso importa
 * de que DIA es la ruta abierta (Dr) frente a la fecha operativa de la carga
 * que se verifica (Dn):
 *
 * - Dr < Dn y Dn - Dr <= `TOLERANCIA_DIAS_LIQUIDACION`: ciclo normal (salio
 *   antes, aun no liquida). NO bloquea; se informa con `liquidacionRezagada`
 *   para una alerta de urgencia baja al supervisor.
 * - Dr >= Dn: la ruta abierta es del mismo dia (o posterior) que la carga
 *   nueva; seria una segunda salida con la primera sin cerrar. Bloquea.
 * - Dn - Dr > tolerancia: ya no es tiempo de ciclo, el vendedor no esta
 *   liquidando. Bloquea.
 * - La ruta abierta no salio de esta app (no hay INICIAL ENVIADA con ese
 *   `idHandy`): no se puede saber de que dia es, y suponer que esta bien es
 *   justo lo que la regla previene. Bloquea.
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
 * (`CargaRepository`, `ConsultasCargaRepository`, `HandyGateway`), nunca de
 * infraestructura.
 */

/** Datos que el disparador (controller o job) provee. */
export interface EntradaVerificarCortePendiente {
  eventoId: string;
}

/**
 * Ruta del ciclo anterior que sigue abierta dentro de la tolerancia: no frena
 * la verificacion, pero el disparador levanta una alerta de urgencia BAJA
 * dirigida al supervisor (informar, no frenar).
 */
export interface LiquidacionRezagada {
  rutaHandyId: string;
  /** Dn - Dr en dias de negocio; siempre entre 1 y la tolerancia. */
  diasDeRetraso: number;
}

/**
 * Por que se bloqueo:
 * - `RUTA_NO_RECONOCIDA`: la ruta abierta no salio de esta app.
 * - `MISMA_SALIDA`: la ruta abierta es del mismo dia (o posterior) que la carga.
 * - `LIQUIDACION_VENCIDA`: la ruta abierta pasa la tolerancia de liquidacion.
 */
export type CausaCortePendiente =
  | 'RUTA_NO_RECONOCIDA'
  | 'MISMA_SALIDA'
  | 'LIQUIDACION_VENCIDA';

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `bloqueado: false`: no hay ruta abierta que impida la salida; no se toco
 *   nada. Si la hay pero es del ciclo anterior, viaja `liquidacionRezagada`.
 * - `bloqueado: true`: la ruta abierta impide la salida y el evento paso a
 *   `BLOQUEADA_CORTE_PENDIENTE`. `generarAlertaMedia` siempre viaja en `true`
 *   (docs/02 seccion 4.5: nace en urgencia media, escala a alta si persiste).
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `EN_ESPERA_CONTADOR`
 *   (`permiteVerificacionDelContador` del dominio).
 */
export type ResultadoVerificarCortePendiente =
  | {
      exito: true;
      bloqueado: false;
      liquidacionRezagada?: LiquidacionRezagada;
    }
  | {
      exito: true;
      bloqueado: true;
      evento: EventoCarga;
      rutaHandyId: string;
      causa: CausaCortePendiente;
      generarAlertaMedia: true;
    }
  | { exito: false; motivo: 'ESTADO_INVALIDO' };

export class VerificarCortePendienteUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly consultas: ConsultasCargaRepository,
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

    // 3. De que dia es la ruta abierta: el de NUESTRA inicial enviada con ese
    //    id en Handy. Si no salio de esta app no se puede saber: bloquea.
    const inicialAbierta = await this.consultas.buscarInicialEnviadaPorIdHandy(
      evento.rutaId,
      rutaAbierta.id,
    );
    let causa: CausaCortePendiente;
    if (inicialAbierta === null) {
      causa = 'RUTA_NO_RECONOCIDA';
    } else {
      const diasDeRetraso = diasEntreFechasOperativas(
        inicialAbierta.fechaOperativa,
        evento.fechaOperativa,
      );
      if (diasDeRetraso <= 0) {
        causa = 'MISMA_SALIDA';
      } else if (diasDeRetraso > TOLERANCIA_DIAS_LIQUIDACION) {
        causa = 'LIQUIDACION_VENCIDA';
      } else {
        // Ciclo normal: salio antes y todavia no liquida. Informar, no frenar.
        return {
          exito: true,
          bloqueado: false,
          liquidacionRezagada: { rutaHandyId: rutaAbierta.id, diasDeRetraso },
        };
      }
    }

    // 4. Hay corte pendiente: bloquear la verificacion. La transicion siempre
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
      causa,
      generarAlertaMedia: true,
    };
  }
}
