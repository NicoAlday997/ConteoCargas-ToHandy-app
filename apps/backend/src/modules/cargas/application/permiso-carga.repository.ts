/**
 * Puerto de persistencia de los permisos del supervisor para iniciar una carga
 * INICIAL con la ruta anterior del vendedor sin liquidar en Handy.
 *
 * Un permiso vence a las 24 horas de otorgado y es de UN SOLO USO. "Vigente" =
 * no usado y con `fechaExpiracion` posterior a `ahora`. El consumo NO vive
 * aqui: ocurre dentro de `CargaRepository.crearEvento`, en la misma
 * transaccion que crea el evento, para que dos solicitudes simultaneas no
 * puedan gastar el mismo permiso.
 *
 * Capa de aplicacion: no importa Prisma, HTTP ni NestJS.
 */

/** Vista de un `PermisoCargaSinLiquidar` para la capa de aplicacion. */
export interface PermisoCargaSinLiquidar {
  id: string;
  rutaId: string;
  otorgadoPorId: string;
  motivo: string;
  fechaOtorgado: Date;
  fechaExpiracion: Date;
  usado: boolean;
  /** Evento que consumio el permiso; `null` mientras no se use. */
  eventoCargaId: string | null;
}

/** Permiso vigente con los nombres que el supervisor necesita ver. */
export interface PermisoVigenteDetallado extends PermisoCargaSinLiquidar {
  rutaNombre: string;
  otorgadoPorNombre: string;
}

export interface DatosCrearPermiso {
  rutaId: string;
  otorgadoPorId: string;
  motivo: string;
  fechaOtorgado: Date;
  fechaExpiracion: Date;
}

export abstract class PermisoCargaRepository {
  abstract existeRuta(rutaId: string): Promise<boolean>;

  /** El permiso vigente (no usado, sin vencer) de la ruta; `null` si no hay. */
  abstract buscarVigente(
    rutaId: string,
    ahora: Date,
  ): Promise<PermisoCargaSinLiquidar | null>;

  abstract crear(datos: DatosCrearPermiso): Promise<PermisoCargaSinLiquidar>;

  /** Todos los permisos vigentes, del que vence antes al que vence despues. */
  abstract listarVigentes(ahora: Date): Promise<PermisoVigenteDetallado[]>;
}
