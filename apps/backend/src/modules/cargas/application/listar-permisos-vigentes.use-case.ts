import type {
  PermisoCargaRepository,
  PermisoVigenteDetallado,
} from './permiso-carga.repository';

/**
 * Caso de uso: el supervisor consulta los permisos de carga sin liquidar cuya
 * ventana de 24 h sigue abierta, usados o no. Incluir los usados le deja ver
 * que el permiso de hoy ya se gasto (y en que carga) en vez de verlo
 * desaparecer. Los vencidos no se listan: los consumidos quedan visibles en el
 * historial de la carga que los uso.
 */
export class ListarPermisosVigentesUseCase {
  constructor(private readonly permisos: PermisoCargaRepository) {}

  ejecutar(ahora: Date): Promise<PermisoVigenteDetallado[]> {
    return this.permisos.listarNoVencidos(ahora);
  }
}
