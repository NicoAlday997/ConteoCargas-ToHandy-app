import { normalizarFechaOperativa } from '../domain/fecha-operativa';
import type { AsignacionRepository } from './asignacion.repository';
import type {
  ConsultasCargaRepository,
  DiaRecargable,
} from './consultas-carga.repository';

/**
 * Caso de uso: en que dias puede el vendedor iniciar una recarga (docs/04
 * `GET /eventos-carga/dias-recargables`).
 *
 * Una recarga solo tiene sentido sobre una salida que ya esta en Handy: los
 * dias validos son los de las cargas INICIALES ENVIADAS de la ruta asignada al
 * vendedor (misma regla que `IniciarCargaUseCase`, que la vuelve a revisar al
 * crear). La app ofrece solo estos dias, nunca un calendario libre.
 *
 * Un dia ya pasado no se recarga: solo de HOY (dia de negocio en
 * America/Mexico_City) en adelante.
 *
 * Sin asignacion vigente no hay ruta, y por lo tanto no hay dias: se responde
 * la lista vacia en vez de un error, igual que una ruta sin salidas.
 *
 * Capa de aplicacion: solo depende de los puertos, nunca de infraestructura.
 */
export class ListarDiasRecargablesUseCase {
  constructor(
    private readonly asignaciones: AsignacionRepository,
    private readonly consultas: ConsultasCargaRepository,
  ) {}

  async ejecutar(
    entrada: { usuarioAppId: string },
    ahora: Date,
  ): Promise<DiaRecargable[]> {
    const asignacion = await this.asignaciones.buscarAsignacionVigente(
      entrada.usuarioAppId,
    );
    if (asignacion === null) return [];

    return this.consultas.listarInicialesEnviadasDesde(
      asignacion.rutaId,
      normalizarFechaOperativa(ahora),
    );
  }
}
