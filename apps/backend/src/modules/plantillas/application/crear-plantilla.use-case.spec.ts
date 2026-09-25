import { CrearPlantillaUseCase } from './crear-plantilla.use-case';
import {
  PlantillaEnMemoria,
  plantillaDePrueba,
} from './plantilla-en-memoria.fake-spec';

describe('CrearPlantillaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: CrearPlantillaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new CrearPlantillaUseCase(repo);
  });

  it('crea una plantilla activa con nombre y descripcion', async () => {
    const resultado = await useCase.ejecutar({
      nombre: 'Dulces',
      descripcion: 'Ruta de dulces',
    });

    if (!resultado.exito) throw new Error(resultado.motivo);
    expect(resultado.plantilla).toMatchObject({
      nombre: 'Dulces',
      descripcion: 'Ruta de dulces',
      activa: true,
    });
    expect(repo.creadas).toEqual([
      { nombre: 'Dulces', descripcion: 'Ruta de dulces' },
    ]);
  });

  it('sin descripcion la guarda como null', async () => {
    await useCase.ejecutar({ nombre: 'Dulces' });

    expect(repo.creadas).toEqual([{ nombre: 'Dulces', descripcion: null }]);
  });

  it('rechaza NOMBRE_DUPLICADO sin importar mayusculas ni acentos', async () => {
    repo.sembrarPlantilla(plantillaDePrueba({ nombre: 'Dulces y Abarrotes' }));

    const resultado = await useCase.ejecutar({ nombre: 'DULCES Y ABARROTES' });

    expect(resultado).toEqual({ exito: false, motivo: 'NOMBRE_DUPLICADO' });
    expect(repo.creadas).toHaveLength(0);
  });

  it('tambien choca con el nombre de una plantilla inactiva', async () => {
    repo.sembrarPlantilla(
      plantillaDePrueba({ nombre: 'Vieja', activa: false }),
    );

    const resultado = await useCase.ejecutar({ nombre: 'vieja' });

    expect(resultado).toEqual({ exito: false, motivo: 'NOMBRE_DUPLICADO' });
  });
});
