/**
 * Puerto de los dias no laborables (`DiaNoLaborable` en el esquema): los dias
 * sueltos o periodos que no se trabajan y que marca un supervisor. El domingo
 * no vive aqui: sale de `DIAS_HABILES_SEMANA` (`domain/calendario-laboral`).
 *
 * Toda `fecha` es el inicio del dia de negocio (America/Mexico_City), igual
 * que la fecha operativa de una carga.
 *
 * Capa de aplicacion: describe QUE se necesita de la persistencia, no COMO. El
 * adaptador Prisma vive en `infrastructure/`.
 */

export interface DiaNoLaborable {
  fecha: Date;
  motivo: string;
  creadoPorId: string | null;
  /** Nombre de quien lo marco, para la lista del supervisor. */
  creadoPorNombre: string | null;
  creadoEn: Date;
}

/** Ese dia ya estaba marcado (la fecha es la llave primaria). */
export class DiaNoLaborableDuplicadoError extends Error {
  constructor() {
    super('Ese dia ya esta marcado como no laborable');
    this.name = 'DiaNoLaborableDuplicadoError';
  }
}

export abstract class DiaNoLaborableRepository {
  /** Dias marcados entre `desde` y `hasta` (ambos inclusive), en orden. */
  abstract listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]>;

  /** Lanza `DiaNoLaborableDuplicadoError` si el dia ya estaba marcado. */
  abstract marcar(
    fecha: Date,
    motivo: string,
    usuarioId: string,
  ): Promise<DiaNoLaborable>;

  /** `false` si ese dia no estaba marcado. */
  abstract quitar(fecha: Date): Promise<boolean>;
}
