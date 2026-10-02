import { FiltrosHistorialSchema } from './historial.dto';

/** Un CUID valido cualquiera. */
const CUID = 'ckv9z8x7w0000qwerty123456';

describe('FiltrosHistorialSchema', () => {
  it('lee un dia aaaa-mm-dd como el inicio de ese dia en Mexico', () => {
    const filtros = FiltrosHistorialSchema.parse({
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-20',
    });

    expect(filtros.fechaInicio).toEqual(new Date('2026-09-01T00:00:00-06:00'));
    // La fecha operativa se guarda como el inicio del dia: `lte` lo incluye.
    expect(filtros.fechaFin).toEqual(new Date('2026-09-20T00:00:00-06:00'));
  });

  it('sigue aceptando un instante ISO completo', () => {
    const filtros = FiltrosHistorialSchema.parse({
      fechaInicio: '2026-09-01T06:00:00.000Z',
    });

    expect(filtros.fechaInicio).toEqual(new Date('2026-09-01T06:00:00.000Z'));
  });

  it('rechaza un dia que no existe', () => {
    expect(FiltrosHistorialSchema.safeParse({ fechaFin: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('acepta vendedor, ruta y estado juntos', () => {
    const filtros = FiltrosHistorialSchema.parse({
      vendedorUsuarioAppId: CUID,
      rutaId: CUID,
      estado: 'ENVIADA',
    });

    expect(filtros).toMatchObject({
      vendedorUsuarioAppId: CUID,
      rutaId: CUID,
      estado: 'ENVIADA',
    });
  });

  it('rechaza un vendedor que no es CUID', () => {
    expect(
      FiltrosHistorialSchema.safeParse({ vendedorUsuarioAppId: 'otro' }).success,
    ).toBe(false);
  });
});
