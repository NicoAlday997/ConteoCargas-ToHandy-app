/**
 * Puerto para dejar una alerta en el centro de alertas del supervisor (tabla
 * `alertas`, docs/02 seccion 6). La sincronizacion automatica corre sin nadie
 * mirando: lo que deja pendiente o no pudo hacer tiene que llegarle a alguien.
 */

export type UrgenciaAlerta = 'ALTA' | 'MEDIA' | 'BAJA';

/** Tipos de alerta que levanta la sincronizacion con Handy. */
export type TipoAlertaSincronizacion =
  /** Quedaron productos activos sin empaque confirmado: no se pueden contar. */
  | 'EMPAQUES_SIN_CONFIRMAR'
  /** Handy dejo de listar demasiado de golpe y no se desactivo nada. */
  | 'DESACTIVACION_RETENIDA'
  /** La corrida automatica no pudo completarse. */
  | 'SINCRONIZACION_FALLIDA'
  /** Handy rechazo el token de integracion (401). */
  | 'TOKEN_HANDY_INVALIDO';

export interface NuevaAlerta {
  tipo: TipoAlertaSincronizacion;
  urgencia: UrgenciaAlerta;
  mensaje: string;
}

export abstract class AlertaRepository {
  abstract crear(alerta: NuevaAlerta): Promise<void>;
}
