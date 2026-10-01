/**
 * Una cuenta de vendedor de Handy (cache sincronizado) vista desde la
 * administracion de usuarios: a quien de la app esta vinculada, si a alguien.
 */
export interface CuentaHandy {
  idHandy: number;
  nombre: string;
  /** Foto de perfil de Handy; `null` si no tiene. */
  fotoUrl: string | null;
  /** `false` si Handy ya no la lista como habilitada. */
  activa: boolean;
  /**
   * Usuario ACTIVO de la app vinculado a esta cuenta; `null` si esta libre.
   * Un usuario dado de baja no la ocupa: cuando un vendedor se va, la cuenta
   * (la ruta) pasa al usuario nuevo de quien llega.
   */
  vinculadaA: { id: string; nombreCompleto: string } | null;
}

/** Puerto: lectura de las cuentas de Handy para vincular en el alta (RF-07). */
export abstract class CuentaHandyRepository {
  /** Todas, activas o no, ordenadas por nombre. */
  abstract listar(): Promise<CuentaHandy[]>;
}
