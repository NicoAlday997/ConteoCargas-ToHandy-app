import type {
  PermisoCargaRepository,
  PermisoVigenteDetallado,
} from './permiso-carga.repository';

/**
 * Caso de uso: el supervisor consulta los permisos de carga sin liquidar que
 * siguen vigentes (sin usar y sin vencer). Los usados o vencidos no se listan
 * aqui: los consumidos quedan visibles en el historial de la carga que los uso.
 */
export class ListarPermisosVigentesUseCase {
  constructor(private readonly permisos: PermisoCargaRepository) {}

  ejecutar(ahora: Date): Promise<PermisoVigenteDetallado[]> {
    return this.permisos.listarVigentes(ahora);
  }
}
