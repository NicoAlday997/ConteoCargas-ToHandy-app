import {
  ZONA_NEGOCIO,
  aFormatoHandy,
  desdeIsoHandy,
  finDelDiaNegocio,
  inicioDelDiaNegocio,
} from './fecha-handy';

// America/Mexico_City sin horario de verano desde 2022 => offset fijo -06:00.
// Los instantes de prueba se eligen para que ese -6h sea facil de verificar a mano.

describe('aFormatoHandy', () => {
  it('formatea como dd/MM/aaaa HH:mm:ss en hora de Mexico', () => {
    expect(aFormatoHandy(new Date('2026-01-15T18:30:45.000Z'))).toBe(
      '15/01/2026 12:30:45',
    );
  });

  it('convierte la hora, no solo la reetiqueta: 02:00 UTC es 20:00 del dia anterior', () => {
    // Carga contada a las 20:00 en Garcia.
    expect(aFormatoHandy(new Date('2026-09-03T02:00:00.000Z'))).toBe(
      '02/09/2026 20:00:00',
    );
  });

  it('representa la medianoche local como 00:00:00 (no 24:00:00)', () => {
    expect(aFormatoHandy(new Date('2026-06-01T06:00:00.000Z'))).toBe(
      '01/06/2026 00:00:00',
    );
  });

  it('rellena con ceros dia, mes y hora de un solo digito', () => {
    expect(aFormatoHandy(new Date('2026-03-09T13:04:07.000Z'))).toBe(
      '09/03/2026 07:04:07',
    );
  });

  it('lanza si recibe una fecha invalida', () => {
    expect(() => aFormatoHandy(new Date('no-es-fecha'))).toThrow(TypeError);
  });
});

describe('desdeIsoHandy', () => {
  it('interpreta el ISO con Z que devuelve Handy sin perder el instante', () => {
    const iso = '2026-09-03T02:00:00.000Z';
    expect(desdeIsoHandy(iso).getTime()).toBe(Date.parse(iso));
    expect(desdeIsoHandy(iso).toISOString()).toBe(iso);
  });

  it('acepta ISO con milisegundos', () => {
    const iso = '2026-09-03T02:00:00.123Z';
    expect(desdeIsoHandy(iso).toISOString()).toBe(iso);
  });

  it('lanza ante un string que no es fecha', () => {
    expect(() => desdeIsoHandy('mañana')).toThrow(TypeError);
    expect(() => desdeIsoHandy('')).toThrow(TypeError);
  });
});

describe('inicioDelDiaNegocio / finDelDiaNegocio', () => {
  // 20:00 del 2 de septiembre en Garcia => ya es 3 de septiembre en UTC.
  const contadaDeNoche = new Date('2026-09-03T02:00:00.000Z');

  it('el dia UTC ingenuo del ejemplo es distinto al dia de negocio (por eso existe este modulo)', () => {
    expect(contadaDeNoche.toISOString().slice(0, 10)).toBe('2026-09-03');
    // ...pero para la operacion sigue siendo el 2 de septiembre.
    expect(aFormatoHandy(contadaDeNoche).slice(0, 10)).toBe('02/09/2026');
  });

  it('inicio = 00:00:00.000 local del dia de negocio', () => {
    expect(inicioDelDiaNegocio(contadaDeNoche).toISOString()).toBe(
      '2026-09-02T06:00:00.000Z',
    );
  });

  it('fin = 23:59:59.999 local del dia de negocio', () => {
    expect(finDelDiaNegocio(contadaDeNoche).toISOString()).toBe(
      '2026-09-03T05:59:59.999Z',
    );
  });

  it('cualquier instante del mismo dia de negocio produce el mismo inicio y fin', () => {
    const alMediodia = new Date('2026-09-02T18:00:00.000Z'); // 12:00 en Garcia
    const casiMedianoche = new Date('2026-09-03T05:59:59.999Z'); // 23:59:59.999 local
    expect(inicioDelDiaNegocio(alMediodia).toISOString()).toBe(
      '2026-09-02T06:00:00.000Z',
    );
    expect(inicioDelDiaNegocio(casiMedianoche).toISOString()).toBe(
      '2026-09-02T06:00:00.000Z',
    );
    expect(finDelDiaNegocio(alMediodia).getTime()).toBe(
      finDelDiaNegocio(casiMedianoche).getTime(),
    );
  });

  it('la ventana [inicio, fin] cubre un dia completo menos 1 ms', () => {
    const inicio = inicioDelDiaNegocio(contadaDeNoche);
    const fin = finDelDiaNegocio(contadaDeNoche);
    expect(fin.getTime() - inicio.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('funciona con una fecha de otro mes', () => {
    const enJulio = new Date('2026-07-04T17:00:00.000Z'); // 11:00 en Garcia
    expect(inicioDelDiaNegocio(enJulio).toISOString()).toBe(
      '2026-07-04T06:00:00.000Z',
    );
    expect(finDelDiaNegocio(enJulio).toISOString()).toBe(
      '2026-07-05T05:59:59.999Z',
    );
  });

  it('inicio y fin, formateados a Handy, caen en el mismo dia local', () => {
    expect(aFormatoHandy(inicioDelDiaNegocio(contadaDeNoche))).toBe(
      '02/09/2026 00:00:00',
    );
    expect(aFormatoHandy(finDelDiaNegocio(contadaDeNoche))).toBe(
      '02/09/2026 23:59:59',
    );
  });

  it('lanza si recibe una fecha invalida', () => {
    expect(() => inicioDelDiaNegocio(new Date(NaN))).toThrow(TypeError);
    expect(() => finDelDiaNegocio(new Date(NaN))).toThrow(TypeError);
  });
});

describe('ZONA_NEGOCIO', () => {
  it('es America/Mexico_City', () => {
    expect(ZONA_NEGOCIO).toBe('America/Mexico_City');
  });
});
