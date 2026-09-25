import {
  PlantillaEnMemoria,
  plantillaDePrueba,
  productoDePrueba,
} from './plantilla-en-memoria.fake-spec';
import { QuitarProductosDePlantillaUseCase } from './quitar-productos-de-plantilla.use-case';

describe('QuitarProductosDePlantillaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: QuitarProductosDePlantillaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new QuitarProductosDePlantillaUseCase(repo);
    for (const code of ['P1', 'P2', 'P3']) {
      repo.sembrarProducto(productoDePrueba(code, `Producto ${code}`));
    }
    repo.sembrarPlantilla(plantillaDePrueba(), ['P1', 'P2', 'P3']);
  });

  it('PLANTILLA_NO_ENCONTRADA si no existe', async () => {
    const resultado = await useCase.ejecutar('nada', ['P1']);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PLANTILLA_NO_ENCONTRADA',
    });
    expect(repo.quitados).toHaveLength(0);
  });

  it('quita varios productos de una vez', async () => {
    const resultado = await useCase.ejecutar('pl-1', ['P1', 'P3']);

    expect(resultado).toEqual({ exito: true, quitados: 2 });
    expect([...repo.productosPorPlantilla.get('pl-1')!]).toEqual(['P2']);
  });

  it('los codigos que no estaban en la plantilla se ignoran', async () => {
    const resultado = await useCase.ejecutar('pl-1', ['P1', 'NO-ESTA', ' P1 ']);

    expect(resultado).toEqual({ exito: true, quitados: 1 });
    expect(repo.quitados).toEqual([
      { plantillaId: 'pl-1', codes: ['P1', 'NO-ESTA'] },
    ]);
  });

  it('no borra el producto del catalogo: otras plantillas y los conteos lo siguen viendo', async () => {
    await useCase.ejecutar('pl-1', ['P1']);

    expect(repo.catalogo.has('P1')).toBe(true);
  });
});
