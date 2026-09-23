import {
  esPiezasPorPaqueteValido,
  extraerFactorDeNombre,
} from './factor-empaque';

describe('extraerFactorDeNombre', () => {
  describe('nombres reales del catalogo de Handy', () => {
    it.each([
      ['PEPSI 1.5 LT C/12', 12],
      ['BIG COLA 3.000 LT C / 6', 6],
      ['CANELS. c/70', 70],
      ['MARUCHAN 64g C/12', 12],
      ['BARRILITOS .750 ml C/24', 24],
      ['PEPSI 3.000 LT C/8', 8],
      ['SUPER VALUE COLA PET NO RETORNABLE 3000 ml 6 pack', 6],
    ])('%p da %p', (nombre, esperado) => {
      expect(extraerFactorDeNombre(nombre)).toBe(esperado);
    });

    it('"BLUE RIVERS" da null', () => {
      expect(extraerFactorDeNombre('BLUE RIVERS')).toBeNull();
    });
  });

  describe('variantes de "C/"', () => {
    it.each([
      ['REFRESCO C / 12', 12],
      ['REFRESCO C/12', 12],
      ['REFRESCO c/70', 70],
      ['REFRESCO C /6', 6],
      ['REFRESCO c / 24', 24],
    ])('%p da %p', (nombre, esperado) => {
      expect(extraerFactorDeNombre(nombre)).toBe(esperado);
    });
  });

  describe('variantes de "X" y "pack"', () => {
    it.each([
      ['AGUA 600 ML X 12', 12],
      ['AGUA 600 ML x12', 12],
      ['AGUA 600 ML 12 pack', 12],
      ['AGUA 600 ML 12 PACK', 12],
      ['AGUA 600 ML 12PACK', 12],
    ])('%p da %p', (nombre, esperado) => {
      expect(extraerFactorDeNombre(nombre)).toBe(esperado);
    });

    it('no confunde una X dentro de una palabra con el patron "X 12"', () => {
      expect(extraerFactorDeNombre('MAX 12')).toBeNull();
    });

    it('no toma la parte decimal de una medida como "pack"', () => {
      expect(extraerFactorDeNombre('REFRESCO 1.5 PACK')).toBeNull();
    });
  });

  it('prefiere "C/" cuando el nombre trae mas de un patron', () => {
    expect(extraerFactorDeNombre('REFRESCO 2 PACK C/12')).toBe(12);
  });

  describe('numeros no razonables', () => {
    it.each(['REFRESCO C/0', 'REFRESCO C/501', 'REFRESCO C/9999'])(
      '%p da null',
      (nombre) => {
        expect(extraerFactorDeNombre(nombre)).toBeNull();
      },
    );

    it('acepta los extremos del rango (1 y 500)', () => {
      expect(extraerFactorDeNombre('REFRESCO C/1')).toBe(1);
      expect(extraerFactorDeNombre('REFRESCO C/500')).toBe(500);
    });
  });

  it('da null para un nombre vacio', () => {
    expect(extraerFactorDeNombre('')).toBeNull();
  });
});

describe('esPiezasPorPaqueteValido', () => {
  it.each([1, 12, 500])('acepta %p', (piezas) => {
    expect(esPiezasPorPaqueteValido(piezas)).toBe(true);
  });

  it.each([0, -1, 501, 1.5, NaN, Infinity])('rechaza %p', (piezas) => {
    expect(esPiezasPorPaqueteValido(piezas)).toBe(false);
  });
});
