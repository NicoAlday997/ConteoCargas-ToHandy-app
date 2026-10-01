import { mensajeInicialSinTerminar } from './inicial-sin-terminar.mensaje';

const SABADO = new Date('2026-10-03T00:00:00-06:00');

describe('mensajeInicialSinTerminar', () => {
  it('en BORRADOR (el vendedor puede cancelarla y moverla) le ofrece las tres salidas', () => {
    expect(
      mensajeInicialSinTerminar({
        id: 'ev-1',
        fechaOperativa: SABADO,
        estado: 'BORRADOR',
      }),
    ).toMatch(
      /^Esta ruta ya tiene una salida sin terminar: la del sábado 3 de octubre, que está .+\. Termínala, cancélala o cámbiale la fecha antes de empezar otra\.$/,
    );
  });

  it('si el vendedor ya no puede cancelarla ni moverla lo manda con su supervisor', () => {
    const mensaje = mensajeInicialSinTerminar({
      id: 'ev-1',
      fechaOperativa: SABADO,
      estado: 'EN_ESPERA_CONTADOR',
    });

    expect(mensaje).toBe(
      'Esta ruta ya tiene una salida sin terminar: la del sábado 3 de octubre, que está en espera del contador. Tú ya no puedes cancelarla ni cambiarle la fecha: pídele a tu supervisor que la revise antes de empezar otra.',
    );
    expect(mensaje).not.toMatch(/cancélala|cámbiale/);
  });

  it.each([
    'EN_ESPERA_CONTADOR',
    'CONFLICTOS_PENDIENTES',
    'EN_ESPERA_AUTORIZACION',
  ] as const)('en %s no le pide cancelarla ni cambiarle la fecha', (estado) => {
    expect(
      mensajeInicialSinTerminar({ id: 'ev-1', fechaOperativa: SABADO, estado }),
    ).toMatch(/pídele a tu supervisor/);
  });

  it('sin datos de la carga (carrera) no inventa la fecha', () => {
    const mensaje = mensajeInicialSinTerminar(null);

    expect(mensaje).toMatch(/^Esta ruta ya tiene una salida sin terminar\./);
    expect(mensaje).not.toMatch(/la del/);
    expect(mensaje).toMatch(/supervisor/);
  });
});
