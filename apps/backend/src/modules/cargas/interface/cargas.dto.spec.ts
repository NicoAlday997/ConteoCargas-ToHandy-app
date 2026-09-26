import { CancelarCargaSchema, GuardarItemsSchema, IniciarCargaSchema } from './cargas.dto';

/**
 * Pruebas del body de `PATCH /eventos-carga/:id/sesiones/:sesionId/items`:
 * se reciben paquetes y sueltas; `cantidad` la calcula el backend y nunca se
 * acepta del cliente.
 */
describe('GuardarItemsSchema', () => {
  it('acepta paquetes y sueltas por producto', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [{ productoCode: 'PEPSI-C12', paquetes: 5, sueltas: 3 }],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      items: [{ productoCode: 'PEPSI-C12', paquetes: 5, sueltas: 3 }],
    });
  });

  it('paquetes y sueltas omitidos valen 0', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [{ productoCode: 'CHICLE', sueltas: 7 }],
    });

    expect(resultado.data).toEqual({
      items: [{ productoCode: 'CHICLE', paquetes: 0, sueltas: 7 }],
    });
  });

  it('acepta items vacio (deja la sesion sin productos)', () => {
    expect(GuardarItemsSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it('rechaza `cantidad` enviada por el cliente', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [
        { productoCode: 'PEPSI-C12', paquetes: 1, sueltas: 0, cantidad: 999 },
      ],
    });

    expect(resultado.success).toBe(false);
  });

  it.each([
    ['paquetes negativos', { paquetes: -1, sueltas: 0 }],
    ['sueltas negativas', { paquetes: 0, sueltas: -1 }],
    ['paquetes decimales', { paquetes: 1.5, sueltas: 0 }],
    ['sueltas como texto', { paquetes: 0, sueltas: '3' }],
  ])('rechaza %s', (_caso, valores) => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [{ productoCode: 'PEPSI-C12', ...valores }],
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta capturadoEn ISO 8601 y lo convierte a fecha', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [
        {
          productoCode: 'CHICLE',
          sueltas: 7,
          capturadoEn: '2026-09-22T14:15:00.000Z',
        },
      ],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.items[0].capturadoEn).toEqual(
      new Date('2026-09-22T14:15:00.000Z'),
    );
  });

  it('rechaza capturadoEn que no es fecha ISO', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [{ productoCode: 'CHICLE', sueltas: 7, capturadoEn: 'ayer' }],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un producto repetido', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [
        { productoCode: 'PEPSI-C12', paquetes: 1, sueltas: 0 },
        { productoCode: 'PEPSI-C12', paquetes: 0, sueltas: 2 },
      ],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un productoCode vacio', () => {
    const resultado = GuardarItemsSchema.safeParse({
      items: [{ productoCode: '   ', paquetes: 1, sueltas: 0 }],
    });

    expect(resultado.success).toBe(false);
  });
});

describe('IniciarCargaSchema', () => {
  it('convierte fechaOperativa aaaa-mm-dd al inicio de ese dia en Mexico', () => {
    const resultado = IniciarCargaSchema.safeParse({
      tipo: 'INICIAL',
      fechaOperativa: '2026-09-24',
    });

    expect(resultado.data).toEqual({
      tipo: 'INICIAL',
      fechaOperativa: new Date('2026-09-24T00:00:00-06:00'),
    });
  });

  it('exige fechaOperativa', () => {
    expect(IniciarCargaSchema.safeParse({ tipo: 'INICIAL' }).success).toBe(false);
  });

  it('rechaza formatos distintos de aaaa-mm-dd y dias inexistentes', () => {
    for (const fechaOperativa of ['24/09/2026', '2026-09-24T10:00:00Z', '2026-02-30']) {
      expect(
        IniciarCargaSchema.safeParse({ tipo: 'INICIAL', fechaOperativa }).success,
      ).toBe(false);
    }
  });
});

describe('CancelarCargaSchema', () => {
  it('acepta un body vacio: el motivo es opcional para el vendedor', () => {
    expect(CancelarCargaSchema.safeParse({}).success).toBe(true);
  });

  it('acepta un motivo de texto', () => {
    const resultado = CancelarCargaSchema.safeParse({ motivo: 'Fecha equivocada' });
    expect(resultado.success && resultado.data.motivo).toBe('Fecha equivocada');
  });

  it('rechaza un motivo que no es texto', () => {
    expect(CancelarCargaSchema.safeParse({ motivo: 123 }).success).toBe(false);
  });

  it('rechaza un motivo de mas de 500 caracteres', () => {
    expect(CancelarCargaSchema.safeParse({ motivo: 'x'.repeat(501) }).success).toBe(false);
  });
});
