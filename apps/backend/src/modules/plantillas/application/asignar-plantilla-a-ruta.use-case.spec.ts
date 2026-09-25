import { AsignarPlantillaARutaUseCase } from './asignar-plantilla-a-ruta.use-case';
import {
  PlantillaEnMemoria,
  plantillaDePrueba,
} from './plantilla-en-memoria.fake-spec';

describe('AsignarPlantillaARutaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: AsignarPlantillaARutaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new AsignarPlantillaARutaUseCase(repo);
    repo.sembrarPlantilla(plantillaDePrueba({ id: 'pl-1' }));
    repo.sembrarPlantilla(plantillaDePrueba({ id: 'pl-2', nombre: 'Dulces' }));
    repo.sembrarRuta('r1');
  });

  it('cambia la plantilla de todas las asignaciones vigentes de la ruta', async () => {
    repo.asignaciones = [
      { rutaId: 'r1', plantillaId: 'pl-1', vigente: true },
      { rutaId: 'r1', plantillaId: 'pl-1', vigente: true },
      // Historica: conserva la suya.
      { rutaId: 'r1', plantillaId: 'pl-1', vigente: false },
    ];

    const resultado = await useCase.ejecutar({
      plantillaId: 'pl-2',
      rutaId: 'r1',
    });

    expect(resultado).toEqual({ exito: true, asignacionesActualizadas: 2 });
    expect(repo.asignaciones.map((a) => a.plantillaId)).toEqual([
      'pl-2',
      'pl-2',
      'pl-1',
    ]);
  });

  it('asigna plantilla a una ruta que no tenia ninguna', async () => {
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: null, vigente: true }];

    const resultado = await useCase.ejecutar({
      plantillaId: 'pl-1',
      rutaId: 'r1',
    });

    expect(resultado.exito).toBe(true);
    expect(repo.asignaciones[0]?.plantillaId).toBe('pl-1');
  });

  it('PLANTILLA_NO_ENCONTRADA si la plantilla no existe', async () => {
    const resultado = await useCase.ejecutar({
      plantillaId: 'nada',
      rutaId: 'r1',
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PLANTILLA_NO_ENCONTRADA',
    });
  });

  it('PLANTILLA_INACTIVA si la plantilla esta desactivada', async () => {
    repo.sembrarPlantilla(
      plantillaDePrueba({ id: 'pl-3', nombre: 'Vieja', activa: false }),
    );
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: true }];

    const resultado = await useCase.ejecutar({
      plantillaId: 'pl-3',
      rutaId: 'r1',
    });

    expect(resultado).toEqual({ exito: false, motivo: 'PLANTILLA_INACTIVA' });
    expect(repo.asignaciones[0]?.plantillaId).toBe('pl-1');
  });

  it('RUTA_NO_ENCONTRADA si la ruta no existe o esta inactiva', async () => {
    repo.sembrarRuta('r-baja', false);

    expect(
      await useCase.ejecutar({ plantillaId: 'pl-1', rutaId: 'nada' }),
    ).toEqual({ exito: false, motivo: 'RUTA_NO_ENCONTRADA' });
    expect(
      await useCase.ejecutar({ plantillaId: 'pl-1', rutaId: 'r-baja' }),
    ).toEqual({ exito: false, motivo: 'RUTA_NO_ENCONTRADA' });
  });

  it('RUTA_SIN_ASIGNACION_VIGENTE si la ruta no tiene vendedor asignado', async () => {
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: false }];

    const resultado = await useCase.ejecutar({
      plantillaId: 'pl-2',
      rutaId: 'r1',
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'RUTA_SIN_ASIGNACION_VIGENTE',
    });
    expect(repo.asignaciones[0]?.plantillaId).toBe('pl-1');
  });
});
