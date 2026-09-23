import type {
  PermisoCargaRepository,
  RutaParaPermiso,
} from './permiso-carga.repository';

/**
 * Caso de uso: rutas entre las que el supervisor elige al otorgar un permiso
 * de carga sin liquidar. Solo las activas; con el vendedor asignado, que es
 * a quien el supervisor identifica ("la de Juan").
 */
export class ListarRutasParaPermisoUseCase {
  constructor(private readonly permisos: PermisoCargaRepository) {}

  ejecutar(): Promise<RutaParaPermiso[]> {
    return this.permisos.listarRutasActivas();
  }
}
