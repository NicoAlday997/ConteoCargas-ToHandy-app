import {
  AsignarColorFamiliaSchema,
  FamiliaParamSchema,
  esColorAsignable,
} from './familias.dto';

describe('familias.dto', () => {
  it('FamiliaParam recorta y rechaza vacio', () => {
    expect(FamiliaParamSchema.parse(' REFRESCOS ')).toBe('REFRESCOS');
    expect(FamiliaParamSchema.safeParse('  ').success).toBe(false);
  });

  it('AsignarColorFamilia exige color (texto o null) y nada mas', () => {
    expect(AsignarColorFamiliaSchema.parse({ color: 'rojo' })).toEqual({
      color: 'rojo',
    });
    expect(AsignarColorFamiliaSchema.parse({ color: null })).toEqual({
      color: null,
    });
    expect(AsignarColorFamiliaSchema.safeParse({}).success).toBe(false);
    expect(
      AsignarColorFamiliaSchema.safeParse({ color: 'rojo', extra: 1 }).success,
    ).toBe(false);
  });

  it('esColorAsignable: null o una clave de la paleta', () => {
    expect(esColorAsignable(null)).toBe(true);
    expect(esColorAsignable('cafe')).toBe(true);
    expect(esColorAsignable('#FFCC00')).toBe(false);
  });
});
