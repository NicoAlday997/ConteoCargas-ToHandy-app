/**
 * Desactivacion por ausencia: cuando un producto o vendedor que esta activo en
 * el cache local ya no viene en la lista de habilitados de Handy, se marca
 * `activo = false` (nunca se borra, docs/02 seccion 3.2).
 *
 * Por que por ausencia y no leyendo `enabled`: verificado contra la API real
 * (2026-09-30), Handy aplica `enabled=true` por omision; sin el parametro
 * devuelve exactamente lo mismo, nunca un registro deshabilitado. Con
 * `enabled=false` los productos traen la paginacion rota (`totalCount: 0`,
 * `totalPages: 0` y aun asi un registro), asi que no es confiable recorrerla.
 *
 * Deducir por ausencia es peligroso: una respuesta incompleta de Handy se
 * leeria como "desactivaron medio catalogo". Por eso esta decision se retiene
 * (no se desactiva nada y se levanta una alerta) si:
 *  - no llego ningun registro;
 *  - llegaron menos registros de los que Handy dijo tener (paginacion
 *    incompleta aunque ninguna pagina haya fallado);
 *  - se desactivaria mas del 30 % de lo activo de golpe.
 * Es mas barato un catalogo viejo que uno vacio a las 6 de la mañana. El
 * primer candado (que ninguna pagina haya fallado) lo da el recorrido: un
 * error de Handy corta la sincronizacion antes de llegar aqui.
 */

/** Fraccion maxima de lo activo que se puede desactivar en una sola corrida. */
export const MAXIMO_DESACTIVACION = 0.3;

export interface DatosDesactivacion {
  /** Registros distintos recibidos de Handy en el recorrido completo. */
  recibidos: number;
  /** Total que Handy reporto en su paginacion (`totalCount`). */
  totalReportado: number;
  /** Activos en el cache local antes de sincronizar. */
  activos: number;
  /** De esos activos, cuantos no vinieron en la lista de Handy. */
  faltantes: number;
}

export type MotivoRetencion =
  | 'SIN_REGISTROS'
  | 'PAGINACION_INCOMPLETA'
  | 'DEMASIADOS_FALTANTES';

export type DecisionDesactivacion =
  | { tipo: 'APLICAR' }
  | { tipo: 'RETENER'; motivo: MotivoRetencion };

export function decidirDesactivacion(
  datos: DatosDesactivacion,
): DecisionDesactivacion {
  if (datos.faltantes === 0) return { tipo: 'APLICAR' };
  if (datos.recibidos === 0) return { tipo: 'RETENER', motivo: 'SIN_REGISTROS' };
  if (datos.recibidos < datos.totalReportado) {
    return { tipo: 'RETENER', motivo: 'PAGINACION_INCOMPLETA' };
  }
  if (datos.faltantes > datos.activos * MAXIMO_DESACTIVACION) {
    return { tipo: 'RETENER', motivo: 'DEMASIADOS_FALTANTES' };
  }
  return { tipo: 'APLICAR' };
}
