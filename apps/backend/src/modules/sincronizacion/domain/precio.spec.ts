import { aCentavos, desdeCentavos } from './precio';

describe('aCentavos', () => {
  it.each([
    [16.25, 1625],
    [77.5, 7750],
    [200, 20000],
    [0, 0],
    [0.1, 10],
    [19.99, 1999],
    [0.07, 7],
    [1234.56, 123456],
  ])('convierte %p a %p centavos', (precio, esperado) => {
    expect(aCentavos(precio)).toBe(esperado);
  });

  it('no arrastra el error de punto flotante de 0.1 + 0.2', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // el problema que este modulo evita
    expect(aCentavos(0.1 + 0.2)).toBe(30);
  });

  it('redondea aunque la multiplicacion por 100 no sea exacta en flotante', () => {
    expect(0.07 * 100).not.toBe(7); // da 7.000000000000001 (por exceso)
    expect(aCentavos(0.07)).toBe(7);
    expect(0.29 * 100).not.toBe(29); // da 28.999999999999996 (por defecto)
    expect(aCentavos(0.29)).toBe(29);
  });

  it('siempre devuelve un entero', () => {
    for (const precio of [16.25, 77.5, 0.99, 3.33, 8.7]) {
      expect(Number.isInteger(aCentavos(precio))).toBe(true);
    }
  });

  it('lanza ante valores no finitos', () => {
    expect(() => aCentavos(NaN)).toThrow(TypeError);
    expect(() => aCentavos(Infinity)).toThrow(TypeError);
  });
});

describe('desdeCentavos', () => {
  it.each([
    [1625, 16.25],
    [7750, 77.5],
    [20000, 200],
    [0, 0],
    [30, 0.3],
    [7, 0.07],
  ])('convierte %p centavos a %p', (centavos, esperado) => {
    expect(desdeCentavos(centavos)).toBe(esperado);
  });

  it('lanza si recibe algo que no es un entero de centavos', () => {
    expect(() => desdeCentavos(16.25)).toThrow(TypeError);
  });
});

describe('ida y vuelta', () => {
  it.each([16.25, 77.5, 200, 0.1, 0.07, 19.99, 1234.56])(
    'desdeCentavos(aCentavos(%p)) recupera el valor original',
    (precio) => {
      expect(desdeCentavos(aCentavos(precio))).toBe(precio);
    },
  );

  it('aCentavos(desdeCentavos(c)) devuelve los mismos centavos', () => {
    for (const centavos of [0, 7, 30, 1625, 7750, 20000, 123456]) {
      expect(aCentavos(desdeCentavos(centavos))).toBe(centavos);
    }
  });
});
