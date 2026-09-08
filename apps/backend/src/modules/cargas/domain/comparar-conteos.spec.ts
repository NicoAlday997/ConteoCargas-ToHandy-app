import { compararConteos, ItemConteo } from './comparar-conteos';

describe('compararConteos — autoventa (sin cantidad esperada)', () => {
  it('conteos identicos: sin discrepancias', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(true);
    expect(r.discrepancias).toEqual([]);
    expect(r.totalProductos).toBe(2);
  });

  it('conteos identicos aunque el orden de los productos difiera', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P2', cantidad: 5 },
      { productoCode: 'P1', cantidad: 10 },
    ];

    expect(compararConteos(a, b).coinciden).toBe(true);
  });

  it('diferencia de cantidad en un producto', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 8 },
      { productoCode: 'P2', cantidad: 5 },
    ];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([{ productoCode: 'P1', cantidadA: 10, cantidadB: 8 }]);
    expect(r.totalProductos).toBe(2);
  });

  it('cantidades iguales no generan discrepancia aunque otro producto si difiera', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 3 },
      { productoCode: 'P2', cantidad: 7 },
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 3 },
      { productoCode: 'P2', cantidad: 9 },
    ];

    const r = compararConteos(a, b);

    expect(r.discrepancias).toEqual([{ productoCode: 'P2', cantidadA: 7, cantidadB: 9 }]);
  });

  it('producto solo en el primer conteo: el segundo cuenta como 0, no se ignora', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 7 },
    ];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([{ productoCode: 'P2', cantidadA: 7, cantidadB: 0 }]);
    expect(r.totalProductos).toBe(2);
  });

  it('producto solo en el segundo conteo: el primero cuenta como 0, no se ignora', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P3', cantidad: 4 },
    ];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([{ productoCode: 'P3', cantidadA: 0, cantidadB: 4 }]);
    expect(r.totalProductos).toBe(2);
  });

  it('ambos conteos vacios: coinciden, sin productos', () => {
    const r = compararConteos([], []);

    expect(r).toEqual({ coinciden: true, discrepancias: [], totalProductos: 0 });
  });

  it('un conteo vacio y el otro con productos: todo es discrepancia', () => {
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 3 },
      { productoCode: 'P2', cantidad: 9 },
    ];

    const r = compararConteos([], b);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 0, cantidadB: 3 },
      { productoCode: 'P2', cantidadA: 0, cantidadB: 9 },
    ]);
    expect(r.totalProductos).toBe(2);
  });

  it('varios productos con varias discrepancias simultaneas', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 }, // difiere
      { productoCode: 'P2', cantidad: 5 }, // igual
      { productoCode: 'P3', cantidad: 2 }, // difiere
      { productoCode: 'P4', cantidad: 8 }, // solo en el primero
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 9 },
      { productoCode: 'P2', cantidad: 5 },
      { productoCode: 'P3', cantidad: 0 },
      { productoCode: 'P5', cantidad: 1 }, // solo en el segundo
    ];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 10, cantidadB: 9 },
      { productoCode: 'P3', cantidadA: 2, cantidadB: 0 },
      { productoCode: 'P4', cantidadA: 8, cantidadB: 0 },
      { productoCode: 'P5', cantidadA: 0, cantidadB: 1 },
    ]);
    expect(r.totalProductos).toBe(5);
  });

  it('ninguna discrepancia lleva cantidadEsperada cuando no se paso esperado', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 4 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 6 }];

    const [d] = compararConteos(a, b).discrepancias;

    expect(d).not.toHaveProperty('cantidadEsperada');
  });
});

describe('compararConteos — preventa (con cantidad esperada)', () => {
  it('A y B coinciden entre si y con lo esperado: sin discrepancia', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const esperado: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];

    const r = compararConteos(a, b, esperado);

    expect(r.coinciden).toBe(true);
    expect(r.discrepancias).toEqual([]);
    expect(r.totalProductos).toBe(2);
  });

  it('A y B coinciden entre si pero difieren de lo esperado: faltante de bodega, se reporta con cantidadEsperada', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 8 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 8 }];
    const esperado: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b, esperado);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 8, cantidadB: 8, cantidadEsperada: 10 },
    ]);
  });

  it('A y B difieren entre si Y de lo esperado', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 9 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 7 }];
    const esperado: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b, esperado);

    expect(r.coinciden).toBe(false);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 9, cantidadB: 7, cantidadEsperada: 10 },
    ]);
  });

  it('A y B difieren entre si pero uno de ellos coincide con lo esperado', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 6 }];
    const esperado: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b, esperado);

    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 10, cantidadB: 6, cantidadEsperada: 10 },
    ]);
  });

  it('la discrepancia incluye cantidadEsperada incluso cuando el producto falta en un conteo', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];
    const b: ItemConteo[] = [];
    const esperado: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b, esperado);

    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 10, cantidadB: 0, cantidadEsperada: 10 },
    ]);
  });

  it('un producto que solo esta en lo esperado cuenta en totalProductos y es discrepancia (0 vs 0 vs esperado)', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 5 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 5 }];
    const esperado: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 5 },
      { productoCode: 'P2', cantidad: 3 },
    ];

    const r = compararConteos(a, b, esperado);

    expect(r.totalProductos).toBe(2);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P2', cantidadA: 0, cantidadB: 0, cantidadEsperada: 3 },
    ]);
  });

  it('esperado como arreglo vacio activa el modo preventa (no se trata como undefined)', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 2 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 2 }];

    const r = compararConteos(a, b, []);

    // A y B coinciden, pero lo esperado para P1 es 0 => sobrante de bodega.
    expect(r.discrepancias).toEqual([
      { productoCode: 'P1', cantidadA: 2, cantidadB: 2, cantidadEsperada: 0 },
    ]);
  });

  it('mezcla: coincidencia total, desacuerdo entre personas y faltante de bodega en la misma carga', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 4 }, // ok en los tres
      { productoCode: 'P2', cantidad: 6 }, // A != B
      { productoCode: 'P3', cantidad: 9 }, // A == B pero != esperado
    ];
    const b: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 4 },
      { productoCode: 'P2', cantidad: 5 },
      { productoCode: 'P3', cantidad: 9 },
    ];
    const esperado: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 4 },
      { productoCode: 'P2', cantidad: 6 },
      { productoCode: 'P3', cantidad: 10 },
    ];

    const r = compararConteos(a, b, esperado);

    expect(r.coinciden).toBe(false);
    expect(r.totalProductos).toBe(3);
    expect(r.discrepancias).toEqual([
      { productoCode: 'P2', cantidadA: 6, cantidadB: 5, cantidadEsperada: 6 },
      { productoCode: 'P3', cantidadA: 9, cantidadB: 9, cantidadEsperada: 10 },
    ]);
  });
});

describe('compararConteos — pureza (no muta ni depende del entorno)', () => {
  it('no muta ni reordena los arreglos de entrada', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P9', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ];
    const b: ItemConteo[] = [{ productoCode: 'P9', cantidad: 3 }];
    const esperado: ItemConteo[] = [{ productoCode: 'P2', cantidad: 5 }];

    const aRef = a;
    const bRef = b;
    const esperadoRef = esperado;
    const aCopia = a.map((i) => ({ ...i }));
    const bCopia = b.map((i) => ({ ...i }));
    const esperadoCopia = esperado.map((i) => ({ ...i }));

    compararConteos(a, b, esperado);

    expect(a).toBe(aRef); // misma referencia: no se reasigno
    expect(b).toBe(bRef);
    expect(esperado).toBe(esperadoRef);
    expect(a).toEqual(aCopia); // mismo contenido y mismo orden
    expect(b).toEqual(bCopia);
    expect(esperado).toEqual(esperadoCopia);
  });

  it('es determinista: mismas entradas producen resultados iguales', () => {
    const a: ItemConteo[] = [{ productoCode: 'P1', cantidad: 4 }];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 6 }];

    expect(compararConteos(a, b)).toEqual(compararConteos(a, b));
  });
});

describe('compararConteos — validacion de entrada', () => {
  it('acumula un producto repetido dentro del mismo conteo', () => {
    const a: ItemConteo[] = [
      { productoCode: 'P1', cantidad: 4 },
      { productoCode: 'P1', cantidad: 6 },
    ];
    const b: ItemConteo[] = [{ productoCode: 'P1', cantidad: 10 }];

    const r = compararConteos(a, b);

    expect(r.coinciden).toBe(true);
    expect(r.totalProductos).toBe(1);
  });

  it('lanza TypeError ante una cantidad no finita', () => {
    expect(() => compararConteos([{ productoCode: 'P1', cantidad: NaN }], [])).toThrow(TypeError);
    expect(() => compararConteos([], [{ productoCode: 'P1', cantidad: Infinity }])).toThrow(
      TypeError,
    );
  });

  it('lanza TypeError ante una cantidad negativa', () => {
    expect(() => compararConteos([{ productoCode: 'P1', cantidad: -1 }], [])).toThrow(TypeError);
  });

  it('lanza TypeError ante un productoCode vacio', () => {
    expect(() => compararConteos([{ productoCode: '', cantidad: 1 }], [])).toThrow(TypeError);
  });

  it('lanza TypeError cuando el esperado trae un item invalido', () => {
    expect(() =>
      compararConteos([{ productoCode: 'P1', cantidad: 1 }], [{ productoCode: 'P1', cantidad: 1 }], [
        { productoCode: 'P1', cantidad: -3 },
      ]),
    ).toThrow(TypeError);
  });
});
