import { mensajeInicialSinTerminar } from './inicial-sin-terminar.mensaje';

describe('mensajeInicialSinTerminar', () => {
  it('nombra la carga que estorba con fecha y estado en palabras', () => {
    expect(
      mensajeInicialSinTerminar({
        id: 'ev-1',
        fechaOperativa: new Date('2026-10-03T00:00:00-06:00'),
        estado: 'EN_ESPERA_CONTADOR',
      }),
    ).toBe(
      'Esta ruta ya tiene una salida sin terminar: la del sábado 3 de octubre, que está en espera del contador. Termínala, cancélala o cámbiale la fecha antes de empezar otra.',
    );
  });

  it('sin datos de la carga (carrera) no inventa la fecha', () => {
    const mensaje = mensajeInicialSinTerminar(null);

    expect(mensaje).toMatch(/^Esta ruta ya tiene una salida sin terminar\./);
    expect(mensaje).not.toMatch(/la del/);
  });
});
