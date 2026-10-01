import { evaluarCandado } from '../domain/candado-sincronizacion';
import { RegistroSincronizacionRepository } from './registro-sincronizacion.repository';
import {
  SincronizarConHandyUseCase,
  type ResultadoCorridaAutomatica,
  type ResultadoSincronizarConHandy,
} from './sincronizar-con-handy.use-case';

export type ResultadoSincronizarConCandado =
  | { exito: true; resultado: ResultadoSincronizarConHandy }
  | { exito: false; motivo: 'SINCRONIZACION_RECIENTE'; reintentarEn: Date };

/**
 * Puerta de entrada a la sincronizacion con Handy: deja constancia de quien
 * la pidio y cuando, y aplica el candado global de 2 minutos
 * (`domain/candado-sincronizacion.ts`) a las que se piden desde la app.
 *
 * La sincronizacion en si sigue siendo UNA (`SincronizarConHandyUseCase`):
 * esto solo la envuelve. Si el candado esta cerrado no se llama a Handy.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */
export class SincronizarConCandadoUseCase {
  constructor(
    private readonly sincronizar: SincronizarConHandyUseCase,
    private readonly registros: RegistroSincronizacionRepository,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  /** Desde la app, cualquier rol. `usuarioAppId` sale del JWT. */
  async ejecutarManual(
    usuarioAppId: string,
  ): Promise<ResultadoSincronizarConCandado> {
    const ahora = this.reloj();
    const reserva = await this.registros.reservar(
      { origen: 'MANUAL', usuarioAppId, iniciadaEn: ahora },
      (ultima) => evaluarCandado(ultima, ahora),
    );
    if (!reserva.reservado) {
      return {
        exito: false,
        motivo: 'SINCRONIZACION_RECIENTE',
        reintentarEn: reserva.reintentarEn,
      };
    }

    try {
      const resultado = await this.sincronizar.ejecutar('MANUAL');
      await this.terminar(reserva.registroId, true);
      return { exito: true, resultado };
    } catch (error) {
      await this.terminar(reserva.registroId, false);
      throw error;
    }
  }

  /**
   * La corrida de las 5:00. Sin candado (es del servidor y va a hora fija),
   * pero se registra: cuenta para el candado de quien pulse el boton justo
   * despues. Igual que `ejecutarAutomatica`, nunca lanza por un fallo de Handy.
   */
  async ejecutarAutomatica(): Promise<ResultadoCorridaAutomatica> {
    const registroId = await this.registros.registrar({
      origen: 'AUTOMATICA',
      usuarioAppId: null,
      iniciadaEn: this.reloj(),
    });
    const corrida = await this.sincronizar.ejecutarAutomatica();
    await this.terminar(registroId, corrida.exito);
    return corrida;
  }

  /** Cerrar el registro nunca tapa el resultado ni el error de Handy. */
  private async terminar(registroId: string, exito: boolean): Promise<void> {
    try {
      await this.registros.terminar(registroId, {
        terminadaEn: this.reloj(),
        exito,
      });
    } catch {
      // La fila ya existe con su inicio, que es lo que sostiene el candado.
    }
  }
}
