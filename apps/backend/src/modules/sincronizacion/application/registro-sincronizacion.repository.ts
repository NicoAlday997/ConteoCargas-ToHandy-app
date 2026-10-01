import type { ResultadoCandado } from '../domain/candado-sincronizacion';

/** Quien pidio la sincronizacion (ver `OrigenSincronizacion` del caso de uso). */
export type OrigenRegistro = 'MANUAL' | 'AUTOMATICA';

export interface NuevoRegistroSincronizacion {
  origen: OrigenRegistro;
  /** `null` en la corrida automatica. */
  usuarioAppId: string | null;
  iniciadaEn: Date;
}

export type ResultadoReserva =
  | { reservado: true; registroId: string }
  | { reservado: false; reintentarEn: Date };

/**
 * Puerto de la bitacora de sincronizaciones (`registros_sincronizacion`):
 * quien sincronizo y cuando. Tambien sostiene el candado de 2 minutos.
 */
export abstract class RegistroSincronizacionRepository {
  /**
   * Lee el inicio de la sincronizacion mas reciente, le pregunta a `evaluar`
   * si el candado esta libre y, si lo esta, deja el registro creado. Todo de
   * forma ATOMICA: dos peticiones simultaneas no pueden pasar las dos (la
   * segunda ve la fila de la primera). La regla vive en el dominio; aqui
   * solo se garantiza que leer y escribir no se intercalen.
   */
  abstract reservar(
    registro: NuevoRegistroSincronizacion,
    evaluar: (ultimaIniciadaEn: Date | null) => ResultadoCandado,
  ): Promise<ResultadoReserva>;

  /** Registra sin candado (la corrida automatica es del servidor). Devuelve el id. */
  abstract registrar(registro: NuevoRegistroSincronizacion): Promise<string>;

  abstract terminar(
    registroId: string,
    datos: { terminadaEn: Date; exito: boolean },
  ): Promise<void>;
}
