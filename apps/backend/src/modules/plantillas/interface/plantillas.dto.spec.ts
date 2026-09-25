import {
  IdSchema,
  CodigosProductoSchema,
  CrearPlantillaSchema,
  EditarPlantillaSchema,
  ListarPlantillasQuerySchema,
} from './plantillas.dto';

describe('plantillas.dto', () => {
  it('IdSchema acepta cuids y los ids legibles creados por SQL', () => {
    expect(IdSchema.parse('cmugjgoip00004fh0f86vvts2')).toBe(
      'cmugjgoip00004fh0f86vvts2',
    );
    expect(IdSchema.parse('plantilla-ruta6')).toBe('plantilla-ruta6');
    expect(IdSchema.safeParse('  ').success).toBe(false);
  });

  it('CrearPlantilla recorta el nombre y convierte la descripcion vacia en null', () => {
    expect(
      CrearPlantillaSchema.parse({ nombre: '  Dulces ', descripcion: '   ' }),
    ).toEqual({ nombre: 'Dulces', descripcion: null });
  });

  it('CrearPlantilla rechaza nombre vacio y campos desconocidos', () => {
    expect(CrearPlantillaSchema.safeParse({ nombre: '  ' }).success).toBe(
      false,
    );
    expect(
      CrearPlantillaSchema.safeParse({ nombre: 'X', activa: false }).success,
    ).toBe(false);
  });

  it('EditarPlantilla exige al menos un campo', () => {
    expect(EditarPlantillaSchema.safeParse({}).success).toBe(false);
    expect(EditarPlantillaSchema.parse({ activa: false })).toEqual({
      activa: false,
    });
  });

  it('CodigosProducto exige una lista no vacia de codigos no vacios', () => {
    expect(CodigosProductoSchema.safeParse({ codes: [] }).success).toBe(false);
    expect(CodigosProductoSchema.safeParse({ codes: [' '] }).success).toBe(
      false,
    );
    expect(CodigosProductoSchema.parse({ codes: [' A1 '] })).toEqual({
      codes: ['A1'],
    });
  });

  it('ListarPlantillasQuery: incluirInactivas solo con "true"', () => {
    expect(ListarPlantillasQuerySchema.parse({})).toEqual({
      incluirInactivas: false,
    });
    expect(
      ListarPlantillasQuerySchema.parse({ incluirInactivas: 'true' }),
    ).toEqual({ incluirInactivas: true });
    expect(
      ListarPlantillasQuerySchema.safeParse({ incluirInactivas: 'si' }).success,
    ).toBe(false);
  });
});
