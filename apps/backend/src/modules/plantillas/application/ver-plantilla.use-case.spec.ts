import {
  PlantillaEnMemoria,
  plantillaDePrueba,
  productoDePrueba,
} from './plantilla-en-memoria.fake-spec';
import { VerPlantillaUseCase } from './ver-plantilla.use-case';

describe('VerPlantillaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: VerPlantillaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new VerPlantillaUseCase(repo);
  });

  it('PLANTILLA_NO_ENCONTRADA si no existe', async () => {
    expect(await useCase.ejecutar('nada')).toEqual({
      exito: false,
      motivo: 'PLANTILLA_NO_ENCONTRADA',
    });
  });

  it('devuelve los productos agrupados por familia, sin familia al final, y las rutas', async () => {
    repo.sembrarProducto(productoDePrueba('1', 'BIG COLA 10L', 'REFRESCOS'));
    repo.sembrarProducto(productoDePrueba('2', 'CHICLE', null));
    repo.sembrarProducto(productoDePrueba('3', 'BIG COLA 2L', 'REFRESCOS'));
    repo.sembrarProducto(productoDePrueba('4', 'AGUA 1 LT', 'AGUAS'));
    repo.sembrarPlantilla(plantillaDePrueba(), ['1', '2', '3', '4']);
    repo.sembrarRuta('r1');
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: true }];

    const resultado = await useCase.ejecutar('pl-1');
    if (!resultado.exito) throw new Error(resultado.motivo);

    expect(resultado.plantilla.totalProductos).toBe(4);
    expect(resultado.plantilla.rutas.map((r) => r.id)).toEqual(['r1']);
    expect(
      resultado.plantilla.familias.map((f) => [
        f.familia,
        f.productos.map((p) => p.nombre),
      ]),
    ).toEqual([
      ['AGUAS', ['AGUA 1 LT']],
      ['REFRESCOS', ['BIG COLA 2L', 'BIG COLA 10L']],
      [null, ['CHICLE']],
    ]);
  });

  it('incluye los productos desactivados en Handy, marcados como inactivos', async () => {
    repo.sembrarProducto({
      ...productoDePrueba('1', 'DESCONTINUADO'),
      activo: false,
    });
    repo.sembrarPlantilla(plantillaDePrueba(), ['1']);

    const resultado = await useCase.ejecutar('pl-1');
    if (!resultado.exito) throw new Error(resultado.motivo);

    expect(resultado.plantilla.familias[0]?.productos[0]?.activo).toBe(false);
  });
});
