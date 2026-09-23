import { aPiezas, sueltasExcedenPaquete } from './conversion-empaque';

/**
 * Casos tomados del catalogo real: PEPSI C/12 es el ejemplo tipico de producto
 * que se cuenta por paquete en bodega.
 */

const PEPSI_C12 = 12;

describe('aPiezas', () => {
  it('5 paquetes + 3 sueltas de PEPSI C/12 da 63 piezas', () => {
    expect(aPiezas(5, 3, PEPSI_C12)).toBe(63);
  });

  it('10 paquetes de PEPSI C/12 da 120 piezas', () => {
    expect(aPiezas(10, 0, PEPSI_C12)).toBe(120);
  });

  it('0 paquetes + 7 sueltas da 7 piezas', () => {
    expect(aPiezas(0, 7, PEPSI_C12)).toBe(7);
  });

  it('sin factor (null) devuelve solo las sueltas', () => {
    expect(aPiezas(0, 7, null)).toBe(7);
  });

  it('sin factor (null) rechaza paquetes > 0', () => {
    expect(() => aPiezas(2, 0, null)).toThrow(RangeError);
  });

  it('todo en cero da 0', () => {
    expect(aPiezas(0, 0, PEPSI_C12)).toBe(0);
  });

  it.each([
    ['paquetes negativos', -1, 0],
    ['sueltas negativas', 0, -1],
    ['paquetes decimales', 1.5, 0],
    ['sueltas decimales', 0, 2.5],
    ['NaN', Number.NaN, 0],
  ])('rechaza %s', (_caso, paquetes, sueltas) => {
    expect(() => aPiezas(paquetes, sueltas, PEPSI_C12)).toThrow(RangeError);
  });

  it.each([0, -12, 1.5])('rechaza un factor invalido (%p)', (factor) => {
    expect(() => aPiezas(1, 0, factor)).toThrow(RangeError);
  });
});

describe('sueltasExcedenPaquete', () => {
  it('false cuando las sueltas no completan un paquete', () => {
    expect(sueltasExcedenPaquete(11, PEPSI_C12)).toBe(false);
  });

  it('true cuando las sueltas son exactamente un paquete', () => {
    expect(sueltasExcedenPaquete(12, PEPSI_C12)).toBe(true);
  });

  it('true cuando las sueltas pasan de un paquete', () => {
    expect(sueltasExcedenPaquete(15, PEPSI_C12)).toBe(true);
  });

  it('false sin factor, cualquiera que sea la cantidad', () => {
    expect(sueltasExcedenPaquete(500, null)).toBe(false);
  });
});
