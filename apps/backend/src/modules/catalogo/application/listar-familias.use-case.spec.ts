import { FamiliaEnMemoria } from './familia-en-memoria.fake-spec';
import { ListarFamiliasUseCase } from './listar-familias.use-case';

describe('ListarFamiliasUseCase', () => {
  let repo: FamiliaEnMemoria;
  let useCase: ListarFamiliasUseCase;

  beforeEach(() => {
    repo = new FamiliaEnMemoria();
    useCase = new ListarFamiliasUseCase(repo);
  });

  it('por omision ninguna familia tiene color', async () => {
    repo.productos = ['REFRESCOS', 'REFRESCOS', 'DULCES'];

    expect(await useCase.ejecutar()).toEqual([
      { familia: 'DULCES', color: null, productos: 1 },
      { familia: 'REFRESCOS', color: null, productos: 2 },
    ]);
  });

  it('ordena por nombre, cuenta productos y trae el color asignado', async () => {
    repo.productos = ['REFRESCOS', 'aguas', 'BOTANAS', 'REFRESCOS'];
    repo.colores.set('REFRESCOS', { color: 'rojo', asignadoPorId: 'sup-1' });

    expect(await useCase.ejecutar()).toEqual([
      { familia: 'aguas', color: null, productos: 1 },
      { familia: 'BOTANAS', color: null, productos: 1 },
      { familia: 'REFRESCOS', color: 'rojo', productos: 2 },
    ]);
  });

  it('no lista los productos sin familia', async () => {
    repo.productos = [null, null, 'DULCES'];

    const lista = await useCase.ejecutar();

    expect(lista.map((f) => f.familia)).toEqual(['DULCES']);
  });

  it('no lista el color de una familia que ya no esta en el catalogo', async () => {
    repo.productos = ['DULCES'];
    repo.colores.set('VIEJA', { color: 'azul', asignadoPorId: 'sup-1' });

    expect(await useCase.ejecutar()).toEqual([
      { familia: 'DULCES', color: null, productos: 1 },
    ]);
  });
});
