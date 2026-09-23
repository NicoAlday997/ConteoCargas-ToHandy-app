import {
  esFechaOperativaValida,
  fechaOperativaDesdeDia,
  fechaOperativaPropuesta,
  normalizarFechaOperativa,
} from './fecha-operativa';

/**
 * Casos reales de la operacion (hora de Mexico, UTC-6): la carga de la tarde
 * sale al dia siguiente; la de la mañana (camion descompuesto) sale ese mismo
 * dia. Nunca se registra una carga para un dia pasado.
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

  it('contando el 24 a las 08:00 (camion descompuesto) propone el 24', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-24T08:00:00-06:00'))).toEqual(
      INICIO_24,
    );
  });

  it('a las 11:59 todavia propone hoy', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-23T11:59:59-06:00'))).toEqual(
      INICIO_23,
    );
  });

  it('a las 12:00 en punto ya propone mañana', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-23T12:00:00-06:00'))).toEqual(
      INICIO_24,
    );
  });

  it('usa el dia de Mexico, no el de UTC: 23 a las 20:00 (ya 24 en UTC) propone el 24', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-24T02:00:00Z'))).toEqual(
      INICIO_24,
    );
  });

  it('cruza fin de mes', () => {
    expect(fechaOperativaPropuesta(new Date('2026-09-30T17:00:00-06:00'))).toEqual(
      new Date('2026-10-01T00:00:00-06:00'),
    );
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
