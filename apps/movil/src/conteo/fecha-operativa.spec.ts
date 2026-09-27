/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deLaSalida,
  diaDesdeApi,
  diaNegocio,
  diaRelativo,
  esDia,
  formatearDia,
  formatearFechaCorta,
  normalizarFechasDisponibles,
  sumarDias,
  textoCambioFecha,
  textoConfirmarCambioFecha,
  textoSalida,
  textoSalidaCorta,
} from './fecha-operativa.ts';

describe('diaNegocio', () => {
  it('usa la hora de México, no la UTC', () => {
    // 23 de septiembre, 22:30 en México = 24, 04:30 UTC.
    assert.equal(diaNegocio(new Date('2026-09-24T04:30:00Z')), '2026-09-23');
    assert.equal(diaNegocio(new Date('2026-09-24T06:00:00Z')), '2026-09-24');
  });
});

describe('sumarDias', () => {
  it('suma y resta días calendario', () => {
    assert.equal(sumarDias('2026-02-28', 1), '2026-03-01');
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  });
});

describe('diaDesdeApi', () => {
  it('convierte el inicio de día que manda el backend', () => {
    assert.equal(diaDesdeApi('2026-09-24T06:00:00.000Z'), '2026-09-24');
  });

  it('acepta aaaa-mm-dd y descarta lo inválido', () => {
    assert.equal(diaDesdeApi('2026-09-24'), '2026-09-24');
    assert.equal(diaDesdeApi('no es fecha'), null);
    assert.equal(diaDesdeApi(null), null);
  });
});

describe('esDia', () => {
  it('rechaza días inexistentes y otros formatos', () => {
    assert.equal(esDia('2026-02-30'), false);
    assert.equal(esDia('24/09/2026'), false);
    assert.equal(esDia('2026-09-24'), true);
  });
});

describe('formatearDia', () => {
  it('día de la semana, número y mes', () => {
    assert.equal(formatearDia('2026-09-24'), 'Jueves 24 de septiembre');
    assert.equal(formatearDia('2026-11-01'), 'Domingo 1 de noviembre');
  });
});

describe('diaRelativo', () => {
  it('hoy, mañana, ayer o nada', () => {
    assert.equal(diaRelativo('2026-09-23', '2026-09-23'), 'Hoy');
    assert.equal(diaRelativo('2026-09-24', '2026-09-23'), 'Mañana');
    assert.equal(diaRelativo('2026-09-22', '2026-09-23'), 'Ayer');
    assert.equal(diaRelativo('2026-09-20', '2026-09-23'), null);
  });
});

describe('textoSalida', () => {
  it('dice hoy o mañana cuando aplica', () => {
    assert.equal(textoSalida('2026-09-23', '2026-09-23'), 'Sale hoy, miércoles 23 de septiembre');
    assert.equal(textoSalida('2026-09-24', '2026-09-23'), 'Sale mañana, jueves 24 de septiembre');
    assert.equal(textoSalida('2026-09-22', '2026-09-23'), 'Sale el martes 22 de septiembre');
  });
});

describe('deLaSalida', () => {
  it('usa las mismas palabras que textoSalida', () => {
    assert.equal(deLaSalida('2026-09-23', '2026-09-23'), 'de hoy');
    assert.equal(deLaSalida('2026-09-24', '2026-09-23'), 'de mañana');
    assert.equal(deLaSalida('2026-09-26', '2026-09-23'), 'del sábado 26 de septiembre');
  });
});

describe('formatos cortos', () => {
  it('formatearFechaCorta: "24 sep"', () => {
    assert.equal(formatearFechaCorta('2026-09-24'), '24 sep');
    assert.equal(formatearFechaCorta('2026-01-05'), '5 ene');
  });

  it('textoSalidaCorta: día abreviado, en un renglón', () => {
    assert.equal(textoSalidaCorta('2026-09-26', '2026-09-25'), 'Sale mañana, sáb 26 de septiembre');
    assert.equal(textoSalidaCorta('2026-09-25', '2026-09-25'), 'Sale hoy, vie 25 de septiembre');
    assert.equal(textoSalidaCorta('2026-09-30', '2026-09-25'), 'Sale el mié 30 de septiembre');
  });
});

describe('textoConfirmarCambioFecha', () => {
  it('dice el día nuevo y cuántos productos se conservan', () => {
    assert.deepEqual(textoConfirmarCambioFecha('2026-09-27', 30), {
      titulo: '¿Cambiar la salida al domingo 27 de septiembre?',
      cuerpo:
        'Lo que llevas contado se conserva: los 30 productos siguen ahí. Solo cambia el día para el que sale el camión.',
    });
  });

  it('en singular con un producto', () => {
    assert.equal(
      textoConfirmarCambioFecha('2026-09-27', 1).cuerpo,
      'Lo que llevas contado se conserva: el producto sigue ahí. Solo cambia el día para el que sale el camión.',
    );
  });

  it('sin nada contado omite la frase de lo conservado', () => {
    assert.equal(textoConfirmarCambioFecha('2026-09-27', 0).cuerpo, 'Solo cambia el día para el que sale el camión.');
  });
});

describe('textoCambioFecha', () => {
  it('mismo mes: el mes una sola vez', () => {
    assert.equal(
      textoCambioFecha('2026-09-26', '2026-09-27', 'Irvin Alday'),
      'Fecha cambiada del 26 al 27 de septiembre por Irvin Alday',
    );
  });

  it('cruza de mes: cada fecha con su mes', () => {
    assert.equal(
      textoCambioFecha('2026-09-30', '2026-10-01', 'Irvin Alday'),
      'Fecha cambiada del 30 de septiembre al 1 de octubre por Irvin Alday',
    );
  });

  it('cruza de año: cada fecha con su año', () => {
    assert.equal(
      textoCambioFecha('2026-12-31', '2027-01-01', null),
      'Fecha cambiada del 31 de diciembre de 2026 al 1 de enero de 2027',
    );
  });

  it('sin nombre, no inventa uno', () => {
    assert.equal(textoCambioFecha('2026-09-26', '2026-09-27', null), 'Fecha cambiada del 26 al 27 de septiembre');
  });
});

describe('normalizarFechasDisponibles', () => {
  it('conserva la etiqueta del servidor y ordena por día', () => {
    assert.deepEqual(
      normalizarFechasDisponibles([
        { fecha: '2026-09-28', etiqueta: 'El lunes 28 de septiembre', esHoy: false },
        { fecha: '2026-09-26', etiqueta: 'Hoy, sábado 26 de septiembre', esHoy: true },
      ]),
      [
        { dia: '2026-09-26', etiqueta: 'Hoy, sábado 26 de septiembre', esHoy: true },
        { dia: '2026-09-28', etiqueta: 'El lunes 28 de septiembre', esHoy: false },
      ],
    );
  });

  it('descarta días inválidos y repetidos', () => {
    const fechas = normalizarFechasDisponibles([
      { fecha: '28/09/2026', etiqueta: 'x', esHoy: false },
      { fecha: '2026-09-28', etiqueta: 'El lunes 28 de septiembre', esHoy: false },
      { fecha: '2026-09-28', etiqueta: 'otra', esHoy: false },
      { fecha: null, etiqueta: 'x', esHoy: true },
    ]);
    assert.deepEqual(
      fechas.map((f) => f.dia),
      ['2026-09-28'],
    );
  });

  it('sin etiqueta nombra el día sin relativos (nunca inventa "mañana")', () => {
    const [fecha] = normalizarFechasDisponibles([{ fecha: '2026-09-28' }]);
    assert.equal(fecha.etiqueta, 'Lunes 28 de septiembre');
    assert.equal(fecha.esHoy, false);
  });

  it('sin respuesta: lista vacía', () => {
    assert.deepEqual(normalizarFechasDisponibles(null), []);
  });
});
