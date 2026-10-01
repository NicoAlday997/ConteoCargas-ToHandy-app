import {
  DIAS_HABILES_SEMANA,
  diasHabilesDesde,
  diaTexto,
  esDiaHabil,
  etiquetaFechaOperativa,
  fechaEnPalabras,
  MAXIMO_DIAS_BUSQUEDA,
  opcionesFechaOperativa,
  SinDiasHabilesError,
  siguienteDiaHabil,
} from './calendario-laboral';

/**
 * Calendario laboral: lunes a sabado, menos los dias que marque un supervisor.
 * Septiembre de 2026: viernes 25, sabado 26, domingo 27, lunes 28. Todas las
 * horas en Mexico (UTC-6).
 */

/** Inicio del dia `aaaa-mm-dd` en Mexico. */
const dia = (texto: string) => new Date(`${texto}T00:00:00-06:00`);
const dias = (...textos: string[]) => textos.map(dia);
const textos = (fechas: Date[]) => fechas.map(diaTexto);

/** Del `desde` al `hasta` inclusive, dia por dia. */
function rango(desde: string, hasta: string): Date[] {
  const fechas: Date[] = [];
  for (
    let f = new Date(`${desde}T12:00:00Z`);
    f <= new Date(`${hasta}T12:00:00Z`);
    f = new Date(f.getTime() + 24 * 60 * 60 * 1000)
  ) {
    fechas.push(dia(f.toISOString().slice(0, 10)));
  }
  return fechas;
}

describe('DIAS_HABILES_SEMANA', () => {
  it('es de lunes a sabado: el domingo no se trabaja', () => {
    expect(DIAS_HABILES_SEMANA).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('esDiaHabil', () => {
  it('lunes a sabado son habiles', () => {
    for (const texto of [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]) {
      expect(esDiaHabil(dia(texto), [])).toBe(true);
    }
  });

  it('el domingo no es habil, sin marcarlo', () => {
    expect(esDiaHabil(dia('2026-09-27'), [])).toBe(false);
  });

  it('un dia marcado como no laborable no es habil', () => {
    expect(esDiaHabil(dia('2026-09-16'), dias('2026-09-16'))).toBe(false);
  });

  it('compara por dia, no por instante: la hora del dia marcado no importa', () => {
    expect(
      esDiaHabil(
        new Date('2026-09-16T17:45:00-06:00'),
        [new Date('2026-09-16T09:00:00-06:00')],
      ),
    ).toBe(false);
  });

  it('usa el dia de Mexico, no el de UTC: sabado 26 a las 20:00 (domingo en UTC) es habil', () => {
    expect(esDiaHabil(new Date('2026-09-27T02:00:00Z'), [])).toBe(true);
  });

  it('otro dia marcado no afecta', () => {
    expect(esDiaHabil(dia('2026-09-17'), dias('2026-09-16'))).toBe(true);
  });
});

describe('siguienteDiaHabil', () => {
  it('del martes, el miercoles', () => {
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-22'), []))).toBe('2026-09-23');
  });

  it('del sabado, el lunes (se salta el domingo)', () => {
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-26'), []))).toBe('2026-09-28');
  });

  it('del domingo, el lunes', () => {
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-27'), []))).toBe('2026-09-28');
  });

  it('nunca devuelve el mismo dia, aunque sea habil', () => {
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-23'), []))).not.toBe('2026-09-23');
  });

  it('se salta los dias marcados', () => {
    expect(
      diaTexto(siguienteDiaHabil(dia('2026-09-26'), dias('2026-09-28'))),
    ).toBe('2026-09-29');
  });

  it('devuelve el inicio del dia en Mexico', () => {
    expect(
      siguienteDiaHabil(new Date('2026-09-22T18:30:00-06:00'), []),
    ).toEqual(dia('2026-09-23'));
  });

  it('cruza fin de mes y de año', () => {
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-30'), []))).toBe('2026-10-01');
    expect(diaTexto(siguienteDiaHabil(dia('2026-12-31'), []))).toBe('2027-01-01');
  });

  it('con un cierre largo, salta todo el cierre', () => {
    const cierre = rango('2026-12-25', '2027-01-01');
    expect(diaTexto(siguienteDiaHabil(dia('2026-12-24'), cierre))).toBe('2027-01-02');
  });

  it(`sin ningun dia habil en ${MAXIMO_DIAS_BUSQUEDA} dias lanza un error explicito`, () => {
    const todo = rango('2026-09-24', '2026-11-30');
    expect(() => siguienteDiaHabil(dia('2026-09-23'), todo)).toThrow(
      SinDiasHabilesError,
    );
  });

  it(`si el unico dia habil cae en el dia ${MAXIMO_DIAS_BUSQUEDA}, lo encuentra`, () => {
    // Del 23 de septiembre, el dia 30 es el 23 de octubre (viernes).
    const hastaAntes = rango('2026-09-24', '2026-10-22');
    expect(diaTexto(siguienteDiaHabil(dia('2026-09-23'), hastaAntes))).toBe(
      '2026-10-23',
    );
  });

  it(`uno despues del dia ${MAXIMO_DIAS_BUSQUEDA} ya no cuenta: lanza`, () => {
    const hastaElTope = rango('2026-09-24', '2026-10-23');
    expect(() => siguienteDiaHabil(dia('2026-09-23'), hastaElTope)).toThrow(
      SinDiasHabilesError,
    );
  });
});

describe('opcionesFechaOperativa', () => {
  it('martes por la tarde: [martes, miercoles]', () => {
    expect(
      textos(opcionesFechaOperativa(new Date('2026-09-22T18:00:00-06:00'), [])),
    ).toEqual(['2026-09-22', '2026-09-23']);
  });

  it('sabado: [sabado, lunes]', () => {
    expect(
      textos(opcionesFechaOperativa(new Date('2026-09-26T17:00:00-06:00'), [])),
    ).toEqual(['2026-09-26', '2026-09-28']);
  });

  it('domingo: [lunes] (hoy no se ofrece porque no se trabaja)', () => {
    expect(
      textos(opcionesFechaOperativa(new Date('2026-09-27T10:00:00-06:00'), [])),
    ).toEqual(['2026-09-28']);
  });

  it('viernes: [viernes, sabado]', () => {
    expect(
      textos(opcionesFechaOperativa(new Date('2026-09-25T16:00:00-06:00'), [])),
    ).toEqual(['2026-09-25', '2026-09-26']);
  });

  it('24 de diciembre con el cierre de Navidad a Año Nuevo marcado: [24 dic, 2 ene]', () => {
    // El 1 de enero de 2027 es viernes: si no se marca, es habil. El cierre
    // completo va del 25 de diciembre al 1 de enero.
    const cierre = rango('2026-12-25', '2027-01-01');
    expect(
      textos(opcionesFechaOperativa(new Date('2026-12-24T15:00:00-06:00'), cierre)),
    ).toEqual(['2026-12-24', '2027-01-02']);
  });

  it('24 de diciembre con solo del 25 al 31 marcados: [24 dic, 1 ene]', () => {
    const cierre = rango('2026-12-25', '2026-12-31');
    expect(
      textos(opcionesFechaOperativa(new Date('2026-12-24T15:00:00-06:00'), cierre)),
    ).toEqual(['2026-12-24', '2027-01-01']);
  });

  it('hoy marcado como no laborable: solo el siguiente habil', () => {
    expect(
      textos(
        opcionesFechaOperativa(
          new Date('2026-09-16T08:00:00-06:00'),
          dias('2026-09-16'),
        ),
      ),
    ).toEqual(['2026-09-17']);
  });

  it('usa el dia de Mexico: sabado 26 a las 20:00 (domingo en UTC) sigue ofreciendo el sabado', () => {
    expect(
      textos(opcionesFechaOperativa(new Date('2026-09-27T02:00:00Z'), [])),
    ).toEqual(['2026-09-26', '2026-09-28']);
  });

  it('nunca mas de dos opciones', () => {
    for (let d = 20; d <= 30; d += 1) {
      const ahora = new Date(`2026-09-${d}T12:00:00-06:00`);
      expect(opcionesFechaOperativa(ahora, []).length).toBeLessThanOrEqual(2);
    }
  });

  it('con una configuracion imposible lanza, no inventa una fecha', () => {
    const todo = rango('2026-09-23', '2026-11-30');
    expect(() =>
      opcionesFechaOperativa(new Date('2026-09-23T12:00:00-06:00'), todo),
    ).toThrow(SinDiasHabilesError);
  });
});

describe('diasHabilesDesde', () => {
  it('de hoy en adelante, sin domingos ni dias marcados', () => {
    const habiles = textos(
      diasHabilesDesde(new Date('2026-09-26T12:00:00-06:00'), dias('2026-09-29')),
    );
    expect(habiles.slice(0, 4)).toEqual([
      '2026-09-26',
      '2026-09-28',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(habiles).not.toContain('2026-09-27');
    expect(habiles).not.toContain('2026-09-29');
  });

  it('en domingo no incluye hoy', () => {
    expect(
      textos(diasHabilesDesde(new Date('2026-09-27T12:00:00-06:00'), []))[0],
    ).toBe('2026-09-28');
  });
});

describe('etiquetaFechaOperativa', () => {
  const SABADO = new Date('2026-09-26T17:00:00-06:00');

  it('hoy: "Hoy, sábado 26 de septiembre"', () => {
    expect(etiquetaFechaOperativa(dia('2026-09-26'), SABADO)).toBe(
      'Hoy, sábado 26 de septiembre',
    );
  });

  it('el sabado, el lunes NO es mañana: "El lunes 28 de septiembre"', () => {
    const etiqueta = etiquetaFechaOperativa(dia('2026-09-28'), SABADO);
    expect(etiqueta).toBe('El lunes 28 de septiembre');
    expect(etiqueta.toLowerCase()).not.toContain('mañana');
  });

  it('solo dice "mañana" cuando de verdad es mañana', () => {
    expect(
      etiquetaFechaOperativa(
        dia('2026-09-23'),
        new Date('2026-09-22T18:00:00-06:00'),
      ),
    ).toBe('Mañana, miércoles 23 de septiembre');
  });

  it('despues de un cierre: "El sábado 2 de enero"', () => {
    expect(
      etiquetaFechaOperativa(
        dia('2027-01-02'),
        new Date('2026-12-24T15:00:00-06:00'),
      ),
    ).toBe('El sábado 2 de enero');
  });

  it('usa el dia de Mexico: sabado 26 a las 20:00 (domingo en UTC) el sabado sigue siendo hoy', () => {
    expect(
      etiquetaFechaOperativa(dia('2026-09-26'), new Date('2026-09-27T02:00:00Z')),
    ).toBe('Hoy, sábado 26 de septiembre');
  });
});

describe('fechaEnPalabras', () => {
  it('nombra el dia sin "hoy" ni "mañana": "sábado 3 de octubre"', () => {
    expect(fechaEnPalabras(dia('2026-10-03'))).toBe('sábado 3 de octubre');
  });

  it('usa el dia de negocio, no el de UTC', () => {
    // 23:30 del miercoles en Mexico ya es jueves en UTC.
    expect(fechaEnPalabras(new Date('2026-09-30T23:30:00-06:00'))).toBe(
      'miércoles 30 de septiembre',
    );
  });
});
