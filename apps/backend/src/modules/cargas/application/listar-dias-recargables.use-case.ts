import {
  esHandyNoDisponible,
  HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import { normalizarFechaOperativa } from '../domain/fecha-operativa';
import type { AsignacionRepository } from './asignacion.repository';
import type {
  ConsultasCargaRepository,
  DiaRecargable,
} from './consultas-carga.repository';

/**
 * Caso de uso: en que dia puede el vendedor iniciar una recarga (docs/04
 * `GET /eventos-carga/dias-recargables`).
 *
 * Una recarga le suma producto a la ruta que el vendedor tiene ABIERTA en
 * Handy. Eso solo lo sabe Handy: el estado ENVIADA de nuestra carga inicial
 * dice que alguna vez salio, no que siga abierta (cuando el vendedor liquida,
 * Handy cierra la ruta y nadie nos avisa). Por eso se le pregunta a Handy con
 * `consultarRutaAbierta`, la misma consulta que usa el corte pendiente:
 *
 * - Sin ruta abierta (404): no hay dias (`SIN_RUTA_ABIERTA`).
 * - Ruta abierta con id X: el dia es el de NUESTRA inicial ENVIADA con
 *   `idHandy = X` en la ruta del vendedor. Siempre uno solo, y sin filtrar por
 *   fecha: la manda Handy. Si X no salio de esta app, `RUTA_NO_RECONOCIDA`.
 * - Handy no se pudo consultar: no se bloquea al vendedor por la caida de un
 *   tercero. Se cae al criterio local (iniciales ENVIADAS de hoy en adelante)
 *   y se responde `verificadoConHandy: false` para que la app lo advierta.
 *
 * `IniciarCargaUseCase` vuelve a hacer la misma revision al crear: este
 * endpoint solo le dice a la app que ofrecer.
 *
 * Sin asignacion vigente no hay ruta, y por lo tanto no hay dias: se responde
 * la lista vacia en vez de un error, sin molestar a Handy.
 *
 * Capa de aplicacion: solo depende de los puertos, nunca de infraestructura.
 */

export type MotivoSinDiasRecargables =
  | 'SIN_RUTA_ASIGNADA'
  | 'SIN_RUTA_ABIERTA'
  | 'RUTA_NO_RECONOCIDA';

export interface ResultadoDiasRecargables {
  dias: DiaRecargable[];
  /** Solo cuando `dias` viene vacio por una razon conocida. */
  motivo?: MotivoSinDiasRecargables;
  /**
   * `false` si Handy no respondio y los dias salen solo de nuestra base: la
   * ruta podria ya estar cerrada.
   */
  verificadoConHandy: boolean;
}

export class ListarDiasRecargablesUseCase {
  constructor(
    private readonly asignaciones: AsignacionRepository,
    private readonly consultas: ConsultasCargaRepository,
    private readonly handy: HandyGateway,
  ) {}

  async ejecutar(
    entrada: { usuarioAppId: string; usuarioHandyId: number },
    ahora: Date,
  ): Promise<ResultadoDiasRecargables> {
    const asignacion = await this.asignaciones.buscarAsignacionVigente(
      entrada.usuarioAppId,
    );
    if (asignacion === null) {
      return { dias: [], motivo: 'SIN_RUTA_ASIGNADA', verificadoConHandy: false };
    }

    // a) Handy es quien sabe si la ruta sigue abierta.
    let rutaAbierta: RutaHandy | null;
    try {
      rutaAbierta = await this.handy.consultarRutaAbierta(
        entrada.usuarioHandyId,
      );
    } catch (error) {
      if (!esHandyNoDisponible(error)) throw error;
      // d) Sin Handy: criterio local, advertido.
      const dias = await this.consultas.listarInicialesEnviadasDesde(
        asignacion.rutaId,
        normalizarFechaOperativa(ahora),
      );
      return { dias, verificadoConHandy: false };
    }

    // b) 404: el vendedor ya liquido (o nunca salio).
    if (rutaAbierta === null) {
      return { dias: [], motivo: 'SIN_RUTA_ABIERTA', verificadoConHandy: true };
    }

    // c) La ruta abierta debe ser una que salio de esta app.
    const inicial = await this.consultas.buscarInicialEnviadaPorIdHandy(
      asignacion.rutaId,
      rutaAbierta.id,
    );
    if (inicial === null) {
      return {
        dias: [],
        motivo: 'RUTA_NO_RECONOCIDA',
        verificadoConHandy: true,
      };
    }
    return { dias: [inicial], verificadoConHandy: true };
  }
}
