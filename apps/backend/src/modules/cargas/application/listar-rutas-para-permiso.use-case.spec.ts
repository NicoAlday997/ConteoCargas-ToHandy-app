import { ListarRutasParaPermisoUseCase } from './listar-rutas-para-permiso.use-case';
import {
  PermisoCargaRepository,
  type PermisoCargaSinLiquidar,
  type PermisoVigenteDetallado,
  type RutaParaPermiso,
} from './permiso-carga.repository';

class FakePermisoCargaRepository extends PermisoCargaRepository {
  rutas: RutaParaPermiso[] = [];

  async listarRutasActivas(): Promise<RutaParaPermiso[]> {
    return this.rutas;
  }

  existeRuta(): Promise<boolean> {
    throw new Error('no usado en esta prueba');
  }
  buscarVigente(): Promise<PermisoCargaSinLiquidar | null> {
    throw new Error('no usado en esta prueba');
  }
  crear(): Promise<PermisoCargaSinLiquidar> {
    throw new Error('no usado en esta prueba');
  }
  listarNoVencidos(): Promise<PermisoVigenteDetallado[]> {
    throw new Error('no usado en esta prueba');
  }
}

describe('ListarRutasParaPermisoUseCase', () => {
  it('devuelve las rutas activas con su vendedor asignado', async () => {
    const permisos = new FakePermisoCargaRepository();
    permisos.rutas = [
      { id: 'r1', nombre: 'Ruta 1', codigo: 'R1', vendedorNombre: 'Juan' },
      { id: 'r2', nombre: 'Ruta 2', codigo: 'R2', vendedorNombre: null },
    ];

    const resultado = await new ListarRutasParaPermisoUseCase(permisos).ejecutar();

    expect(resultado).toEqual(permisos.rutas);
  });
});
