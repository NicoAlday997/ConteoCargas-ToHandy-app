import {
  esFechaOperativaValida,
  fechaOperativaDesdeDia,
  fechaOperativaPropuesta,
  normalizarFechaOperativa,
} from './fecha-operativa';

/**
 * Casos reales de la operacion (hora de Mexico, UTC-6): lo normal es contar
 * para que el camion salga al dia siguiente, asi que siempre se propone
 * mañana; hoy (camion descompuesto) se elige a mano. Nunca se registra una
 * carga para un dia pasado.
 */

const INICIO_22 = new Date('2026-09-22T00:00:00-06:00');
const INICIO_23 = new Date('2026-09-23T00:00:00-06:00');
const INICIO_24 = new Date('2026-09-24T00:00:00-06:00');

describe('fechaOperativaPropuesta', () => {
  it('contando el 23 a las 18:00 propone el 24', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-23T18:00:00-06:00'))).toEqual(
      INICIO_24,
    );
  });

  it('contando el 23 a las 08:00 tambien propone el 24: hoy es la excepcion y se elige a mano', () => {
    expect(
      fechaOperativaPropuesta(new Date('2026-09-23T08:00:00-06:00')),
    ).toEqual(INICIO_24);
  });

  it('no depende de la hora: del primer al ultimo instante del 23 propone el 24', () => {
    for (const hora of ['00:00:00', '11:59:59', '12:00:00', '23:59:59']) {
      expect(
        fechaOperativaPropuesta(new Date(`2026-09-23T${hora}-06:00`)),
      ).toEqual(INICIO_24);
    }
  });

  it('nunca propone hoy', () => {
    expect(
      fechaOperativaPropuesta(new Date('2026-09-23T06:00:00-06:00')),
    ).not.toEqual(INICIO_23);
  });

  it('usa el dia de Mexico, no el de UTC: 23 a las 20:00 (ya 24 en UTC) propone el 24', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-24T02:00:00Z'))).toEqual(
      INICIO_24,
    );
  });

  it('cruza fin de mes', () => {
    expect(
      fechaOperativaPropuesta(new Date('2026-09-30T09:00:00-06:00')),
    ).toEqual(new Date('2026-10-01T00:00:00-06:00'));
  });
});

describe('esFechaOperativaValida', () => {
  const AHORA_23 = new Date('2026-09-23T18:00:00-06:00');

  it('rechaza el 22 si hoy es 23', () => {
    expect(esFechaOperativaValida(INICIO_22, AHORA_23)).toBe(false);
  });

  it('rechaza el ultimo instante de ayer', () => {
    expect(
      esFechaOperativaValida(new Date('2026-09-22T23:59:59.999-06:00'), AHORA_23),
    ).toBe(false);
  });

  it('acepta hoy aunque ya haya pasado el inicio del dia', () => {
    expect(esFechaOperativaValida(INICIO_23, AHORA_23)).toBe(true);
  });

  it('acepta mañana y cualquier dia futuro', () => {
    expect(esFechaOperativaValida(INICIO_24, AHORA_23)).toBe(true);
    expect(
      esFechaOperativaValida(new Date('2026-12-31T00:00:00-06:00'), AHORA_23),
    ).toBe(true);
  });

  it('compara en dia de Mexico: a las 20:00 del 23 (24 en UTC) el 23 sigue siendo hoy', () => {
    expect(esFechaOperativaValida(INICIO_23, new Date('2026-09-24T02:00:00Z'))).toBe(
      true,
    );
  });

  it('rechaza una fecha invalida', () => {
    expect(esFechaOperativaValida(new Date('no es fecha'), AHORA_23)).toBe(false);
  });
});

describe('normalizarFechaOperativa', () => {
  it('lleva cualquier instante al inicio de su dia en Mexico', () => {
    expect(normalizarFechaOperativa(new Date('2026-09-24T15:30:00-06:00'))).toEqual(
      INICIO_24,
    );
  });
});

describe('fechaOperativaDesdeDia', () => {
  it('convierte aaaa-mm-dd al inicio de ese dia en Mexico', () => {
    expect(fechaOperativaDesdeDia('2026-09-24')).toEqual(INICIO_24);
  });

  it('rechaza formatos distintos de aaaa-mm-dd', () => {
    expect(() => fechaOperativaDesdeDia('24/09/2026')).toThrow(TypeError);
  });

  it('rechaza dias inexistentes', () => {
    expect(() => fechaOperativaDesdeDia('2026-02-30')).toThrow(TypeError);
  });
});
