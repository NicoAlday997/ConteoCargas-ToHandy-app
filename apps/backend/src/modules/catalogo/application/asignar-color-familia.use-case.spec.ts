import { AsignarColorFamiliaUseCase } from './asignar-color-familia.use-case';
import { FamiliaEnMemoria } from './familia-en-memoria.fake-spec';

describe('AsignarColorFamiliaUseCase', () => {
  let repo: FamiliaEnMemoria;
  let useCase: AsignarColorFamiliaUseCase;

  beforeEach(() => {
    repo = new FamiliaEnMemoria();
    repo.productos = ['REFRESCOS', 'DULCES'];
    useCase = new AsignarColorFamiliaUseCase(repo);
  });

  it('asigna un color de la paleta y guarda quien lo asigno', async () => {
    const resultado = await useCase.ejecutar({
      familia: 'REFRESCOS',
      color: 'turquesa',
      asignadoPorId: 'sup-1',
    });

    expect(resultado).toEqual({
      exito: true,
      familia: 'REFRESCOS',
      color: 'turquesa',
    });
    expect(repo.colores.get('REFRESCOS')).toEqual({
      color: 'turquesa',
      asignadoPorId: 'sup-1',
    });
  });

  it('reemplaza el color anterior', async () => {
    repo.colores.set('REFRESCOS', { color: 'rojo', asignadoPorId: 'sup-1' });

    await useCase.ejecutar({
      familia: 'REFRESCOS',
      color: 'azul',
      asignadoPorId: 'sup-2',
    });

    expect(repo.colores.get('REFRESCOS')).toEqual({
      color: 'azul',
      asignadoPorId: 'sup-2',
    });
  });

  it('null borra la asignacion', async () => {
    repo.colores.set('DULCES', { color: 'rosa', asignadoPorId: 'sup-1' });

    const resultado = await useCase.ejecutar({
      familia: 'DULCES',
      color: null,
      asignadoPorId: 'sup-1',
    });

    expect(resultado).toEqual({ exito: true, familia: 'DULCES', color: null });
    expect(repo.colores.has('DULCES')).toBe(false);
  });

  it('null sobre una familia sin color no es error', async () => {
    const resultado = await useCase.ejecutar({
      familia: 'DULCES',
      color: null,
      asignadoPorId: 'sup-1',
    });

    expect(resultado.exito).toBe(true);
  });

  it('COLOR_INVALIDO fuera de la paleta, sin tocar nada', async () => {
    for (const color of ['amarillo', '#FF0000', 'ROJO', '']) {
      const resultado = await useCase.ejecutar({
        familia: 'REFRESCOS',
        color,
        asignadoPorId: 'sup-1',
      });
      expect(resultado).toEqual({ exito: false, motivo: 'COLOR_INVALIDO' });
    }
    expect(repo.colores.size).toBe(0);
  });

  it('FAMILIA_NO_ENCONTRADA si ningun producto activo la tiene', async () => {
    const resultado = await useCase.ejecutar({
      familia: 'NO EXISTE',
      color: 'rojo',
      asignadoPorId: 'sup-1',
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'FAMILIA_NO_ENCONTRADA',
    });
    expect(repo.colores.size).toBe(0);
  });
});
