import type {
  HistorialRepository,
  OpcionesFiltroHistorial,
} from './historial.repository';
import { OpcionesFiltroHistorialUseCase } from './opciones-filtro-historial.use-case';

class FakeHistorialRepository implements HistorialRepository {
  constructor(private readonly opciones: OpcionesFiltroHistorial) {}

  async listarCargas(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }

  async obtenerCargaConsolidada(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }

  async listarOpcionesFiltro(): Promise<OpcionesFiltroHistorial> {
    return this.opciones;
  }
}

describe('OpcionesFiltroHistorialUseCase', () => {
  it('incluye a los inactivos, despues de los activos y en orden alfabetico', async () => {
    const useCase = new OpcionesFiltroHistorialUseCase(
      new FakeHistorialRepository({
        vendedores: [
          { id: 'v1', nombreCompleto: 'Zoe Ruiz', activo: true },
          { id: 'v2', nombreCompleto: 'Irvin Pérez', activo: false },
          { id: 'v3', nombreCompleto: 'Ana López', activo: true },
          { id: 'v4', nombreCompleto: 'Beto Díaz', activo: false },
        ],
        rutas: [],
      }),
    );

    const { vendedores } = await useCase.ejecutar();

    expect(vendedores.map((v) => [v.nombreCompleto, v.activo])).toEqual([
      ['Ana López', true],
      ['Zoe Ruiz', true],
      ['Beto Díaz', false],
      ['Irvin Pérez', false],
    ]);
  });

  it('ordena las rutas con numero natural: Ruta 2 antes que Ruta 10', async () => {
    const useCase = new OpcionesFiltroHistorialUseCase(
      new FakeHistorialRepository({
        vendedores: [],
        rutas: [
          { id: 'r10', nombre: 'Ruta 10', codigo: 'R10', activa: true },
          { id: 'r9', nombre: 'Ruta 9', codigo: 'R9', activa: false },
          { id: 'r2', nombre: 'Ruta 2', codigo: 'R2', activa: true },
        ],
      }),
    );

    const { rutas } = await useCase.ejecutar();

    expect(rutas.map((r) => r.id)).toEqual(['r2', 'r10', 'r9']);
  });
});
