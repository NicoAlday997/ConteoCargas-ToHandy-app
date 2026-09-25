import { ListarPlantillasUseCase } from './listar-plantillas.use-case';
import {
  PlantillaEnMemoria,
  plantillaDePrueba,
  productoDePrueba,
} from './plantilla-en-memoria.fake-spec';

describe('ListarPlantillasUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: ListarPlantillasUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new ListarPlantillasUseCase(repo);
    repo.sembrarProducto(productoDePrueba('P1', 'PEPSI 2L'));
    repo.sembrarProducto(productoDePrueba('P2', 'AGUA 1L', 'AGUAS'));
    repo.sembrarPlantilla(plantillaDePrueba({ id: 'pl-1' }), ['P1', 'P2']);
    repo.sembrarPlantilla(
      plantillaDePrueba({ id: 'pl-2', nombre: 'Vieja', activa: false }),
    );
    repo.sembrarRuta('r1');
    repo.sembrarRuta('r2');
    repo.asignaciones = [
      { rutaId: 'r1', plantillaId: 'pl-1', vigente: true },
      // Dos vendedores en la misma ruta: la ruta cuenta una vez.
      { rutaId: 'r1', plantillaId: 'pl-1', vigente: true },
      { rutaId: 'r2', plantillaId: 'pl-1', vigente: true },
      // Una asignacion cerrada ya no cuenta.
      { rutaId: 'r2', plantillaId: 'pl-2', vigente: false },
    ];
  });

  it('por omision solo lista las activas, con productos y rutas vigentes', async () => {
    const lista = await useCase.ejecutar();

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'pl-1', totalProductos: 2 });
    expect(lista[0]?.rutas.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('con incluirInactivas tambien lista las desactivadas', async () => {
    const lista = await useCase.ejecutar({ incluirInactivas: true });

    expect(lista.map((p) => p.id)).toEqual(['pl-1', 'pl-2']);
    expect(lista[1]).toMatchObject({
      activa: false,
      totalProductos: 0,
      rutas: [],
    });
  });
});
