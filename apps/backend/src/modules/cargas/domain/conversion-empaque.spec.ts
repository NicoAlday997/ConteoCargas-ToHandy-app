import { aPiezas, sueltasExcedenPaquete } from './conversion-empaque';

/**
 * Casos tomados del catalogo real:
 * - PEPSI C/12 se vende por pieza: el paquete se rompe y 12 es el factor real.
 * - CANELS. c/70 se vende completo: Handy cobra la BOLSA ($71 cada una); el
 *   "c/70" solo distingue el producto de CANELS. c/60. Tratarlo como factor
 *   mandaria 5 bolsas como 350 piezas (un corte de $24,850 en vez de $355).
 */

const PEPSI_C12 = 12;
const CANELS_C70 = 70;

describe('aPiezas', () => {
  describe('POR_PIEZA', () => {
    it('5 paquetes + 3 sueltas de PEPSI C/12 da 63 piezas', () => {
      expect(aPiezas(5, 3, PEPSI_C12, 'POR_PIEZA')).toBe(63);
    });

    it('10 paquetes de PEPSI C/12 da 120 piezas', () => {
      expect(aPiezas(10, 0, PEPSI_C12, 'POR_PIEZA')).toBe(120);
    });

    it('0 paquetes + 7 sueltas da 7 piezas', () => {
      expect(aPiezas(0, 7, PEPSI_C12, 'POR_PIEZA')).toBe(7);
    });

    it('sin factor (null) devuelve solo las sueltas', () => {
      expect(aPiezas(0, 7, null, 'POR_PIEZA')).toBe(7);
    });

    it('sin factor (null) rechaza paquetes > 0', () => {
      expect(() => aPiezas(2, 0, null, 'POR_PIEZA')).toThrow(RangeError);
    });

    it('todo en cero da 0', () => {
      expect(aPiezas(0, 0, PEPSI_C12, 'POR_PIEZA')).toBe(0);
    });

    it.each([0, -12, 1.5])('rechaza un factor invalido (%p)', (factor) => {
      expect(() => aPiezas(1, 0, factor, 'POR_PIEZA')).toThrow(RangeError);
    });
  });

  describe('COMPLETO', () => {
    it('5 paquetes de CANELS c/70 da 5 (bolsas, no 350 piezas)', () => {
      expect(aPiezas(5, 0, CANELS_C70, 'COMPLETO')).toBe(5);
    });

    it('ignora el factor aunque no haya ninguno guardado', () => {
      expect(aPiezas(5, 0, null, 'COMPLETO')).toBe(5);
    });

    it('0 paquetes da 0', () => {
      expect(aPiezas(0, 0, CANELS_C70, 'COMPLETO')).toBe(0);
    });

    it('rechaza sueltas: un producto que se vende completo no se rompe', () => {
      expect(() => aPiezas(5, 3, CANELS_C70, 'COMPLETO')).toThrow(RangeError);
    });
  });

  it.each([
    ['paquetes negativos', -1, 0],
    ['sueltas negativas', 0, -1],
    ['paquetes decimales', 1.5, 0],
    ['sueltas decimales', 0, 2.5],
    ['NaN', Number.NaN, 0],
  ])('rechaza %s en ambas modalidades', (_caso, paquetes, sueltas) => {
    expect(() => aPiezas(paquetes, sueltas, PEPSI_C12, 'POR_PIEZA')).toThrow(
      RangeError,
    );
    expect(() => aPiezas(paquetes, sueltas, PEPSI_C12, 'COMPLETO')).toThrow(
      RangeError,
    );
  });
});

describe('sueltasExcedenPaquete', () => {
  it('false cuando las sueltas no completan un paquete', () => {
    expect(sueltasExcedenPaquete(11, PEPSI_C12, 'POR_PIEZA')).toBe(false);
  });

  it('true cuando las sueltas son exactamente un paquete', () => {
    expect(sueltasExcedenPaquete(12, PEPSI_C12, 'POR_PIEZA')).toBe(true);
  });

  it('true cuando las sueltas pasan de un paquete', () => {
    expect(sueltasExcedenPaquete(15, PEPSI_C12, 'POR_PIEZA')).toBe(true);
  });

  it('false sin factor, cualquiera que sea la cantidad', () => {
    expect(sueltasExcedenPaquete(500, null, 'POR_PIEZA')).toBe(false);
  });

  it('false en un producto que se vende completo', () => {
    expect(sueltasExcedenPaquete(500, CANELS_C70, 'COMPLETO')).toBe(false);
  });
});
