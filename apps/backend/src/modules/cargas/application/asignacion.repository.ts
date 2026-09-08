/**
 * Puerto de consulta de la asignacion de ruta vigente de un vendedor
 * (`AsignacionRutaVendedor` en el esquema; docs/02 seccion 3).
 *
 * "Vigente" = el registro cuyo `vigenteHasta` es `null`. Al reasignar una ruta
 * se cierra el registro anterior (se le pone `vigenteHasta`) y se abre uno
 * nuevo, asi que en todo momento hay como maximo una asignacion abierta por
 * vendedor. Un vendedor sin ninguna asignacion abierta no tiene ruta y no puede
 * contar (RF-12).
 *
 * Capa de aplicacion: este archivo describe QUE se necesita de la persistencia,
 * no COMO. El adaptador Prisma vive en `infrastructure/`.
 */

/**
 * Snapshot minimo de la asignacion vigente. La `plantillaId` puede ser `null`:
 * una ruta sin plantilla asignada muestra el catalogo completo.
 */
export interface AsignacionVigente {
  rutaId: string;
  plantillaId: string | null;
}

export abstract class AsignacionRepository {
  /**
   * Devuelve la asignacion de ruta abierta (`vigenteHasta = null`) del vendedor,
   * o `null` si no tiene ninguna.
   */
  abstract buscarAsignacionVigente(
    usuarioAppId: string,
  ): Promise<AsignacionVigente | null>;
}
