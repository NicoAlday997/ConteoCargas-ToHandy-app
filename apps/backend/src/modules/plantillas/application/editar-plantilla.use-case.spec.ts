import { EditarPlantillaUseCase } from './editar-plantilla.use-case';
import {
  PlantillaEnMemoria,
  plantillaDePrueba,
} from './plantilla-en-memoria.fake-spec';

describe('EditarPlantillaUseCase', () => {
  let repo: PlantillaEnMemoria;
  let useCase: EditarPlantillaUseCase;

  beforeEach(() => {
    repo = new PlantillaEnMemoria();
    useCase = new EditarPlantillaUseCase(repo);
    repo.sembrarPlantilla(
      plantillaDePrueba({ id: 'pl-1', nombre: 'Refrescos' }),
    );
    repo.sembrarPlantilla(plantillaDePrueba({ id: 'pl-2', nombre: 'Dulces' }));
    repo.sembrarRuta('r1');
  });

  it('PLANTILLA_NO_ENCONTRADA si no existe y no toca nada', async () => {
    const resultado = await useCase.ejecutar('nada', { nombre: 'X' });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PLANTILLA_NO_ENCONTRADA',
    });
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('renombra y cambia la descripcion', async () => {
    const resultado = await useCase.ejecutar('pl-1', {
      nombre: 'Refrescos y aguas',
      descripcion: 'Cinco rutas',
    });

    if (!resultado.exito) throw new Error(resultado.motivo);
    expect(resultado.plantilla).toMatchObject({
      nombre: 'Refrescos y aguas',
      descripcion: 'Cinco rutas',
    });
  });

  it('rechaza NOMBRE_DUPLICADO si el nombre es el de otra plantilla', async () => {
    const resultado = await useCase.ejecutar('pl-1', { nombre: 'DULCES' });

    expect(resultado).toEqual({ exito: false, motivo: 'NOMBRE_DUPLICADO' });
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('renombrarla a su propio nombre (otra capitalizacion) no es duplicado', async () => {
    const resultado = await useCase.ejecutar('pl-1', { nombre: 'REFRESCOS' });

    expect(resultado.exito).toBe(true);
  });

  it('rechaza PLANTILLA_EN_USO al desactivar una plantilla asignada a una ruta vigente', async () => {
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: true }];

    const resultado = await useCase.ejecutar('pl-1', { activa: false });

    expect(resultado).toEqual({ exito: false, motivo: 'PLANTILLA_EN_USO' });
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('una asignacion ya cerrada no impide desactivar', async () => {
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: false }];

    const resultado = await useCase.ejecutar('pl-1', { activa: false });

    if (!resultado.exito) throw new Error(resultado.motivo);
    expect(resultado.plantilla.activa).toBe(false);
  });

  it('reactivar no revisa rutas', async () => {
    repo.sembrarPlantilla(
      plantillaDePrueba({ id: 'pl-3', nombre: 'Vieja', activa: false }),
    );

    const resultado = await useCase.ejecutar('pl-3', { activa: true });

    if (!resultado.exito) throw new Error(resultado.motivo);
    expect(resultado.plantilla.activa).toBe(true);
  });

  it('renombrar una plantilla en uso esta permitido', async () => {
    repo.asignaciones = [{ rutaId: 'r1', plantillaId: 'pl-1', vigente: true }];

    const resultado = await useCase.ejecutar('pl-1', {
      nombre: 'Refrescos 2026',
    });

    expect(resultado.exito).toBe(true);
  });
});
