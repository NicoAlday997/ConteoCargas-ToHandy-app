import { AgregarProductosAPlantillaUseCase } from './agregar-productos-a-plantilla.use-case';
import {
  PlantillaEnMemoria,
  plantillaDePrueba,
  productoDePrueba,
} from './plantilla-en-memoria.fake-spec';

describe('AgregarProductosAPlantillaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: AgregarProductosAPlantillaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new AgregarProductosAPlantillaUseCase(repo);
    for (const code of ['P1', 'P2', 'P3']) {
      repo.sembrarProducto(productoDePrueba(code, `Producto ${code}`));
    }
    repo.sembrarPlantilla(plantillaDePrueba(), ['P1']);
  });

  it('PLANTILLA_NO_ENCONTRADA si no existe', async () => {
    const resultado = await useCase.ejecutar('nada', ['P2']);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PLANTILLA_NO_ENCONTRADA',
    });
    expect(repo.agregados).toHaveLength(0);
  });

  it('agrega varios productos de una vez', async () => {
    const resultado = await useCase.ejecutar('pl-1', ['P2', 'P3']);

    expect(resultado).toEqual({ exito: true, agregados: 2, yaEstaban: 0 });
    expect([...repo.productosPorPlantilla.get('pl-1')!]).toEqual([
      'P1',
      'P2',
      'P3',
    ]);
  });

  it('los que ya estaban no se duplican y se reportan', async () => {
    const resultado = await useCase.ejecutar('pl-1', ['P1', 'P2']);

    expect(resultado).toEqual({ exito: true, agregados: 1, yaEstaban: 1 });
    expect(repo.productosPorPlantilla.get('pl-1')!.size).toBe(2);
  });

  it('normaliza codigos repetidos o con espacios antes de agregar', async () => {
    await useCase.ejecutar('pl-1', [' P2 ', 'P2', '']);

    expect(repo.agregados).toEqual([{ plantillaId: 'pl-1', codes: ['P2'] }]);
  });

  it('rechaza PRODUCTOS_NO_ENCONTRADOS y no agrega ninguno si algun codigo no existe', async () => {
    const resultado = await useCase.ejecutar('pl-1', ['P2', 'X9', 'X8']);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PRODUCTOS_NO_ENCONTRADOS',
      codes: ['X9', 'X8'],
    });
    expect(repo.agregados).toHaveLength(0);
  });

  it('se pueden agregar productos a una plantilla inactiva (para prepararla)', async () => {
    repo.sembrarPlantilla(
      plantillaDePrueba({ id: 'pl-2', nombre: 'Nueva', activa: false }),
    );

    const resultado = await useCase.ejecutar('pl-2', ['P1']);

    expect(resultado).toEqual({ exito: true, agregados: 1, yaEstaban: 0 });
  });
});
