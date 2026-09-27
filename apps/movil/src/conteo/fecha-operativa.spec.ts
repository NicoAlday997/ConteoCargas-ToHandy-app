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
  opcionesCambioFecha,
  opcionesFechaOperativa,
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

describe('opcionesFechaOperativa', () => {
  it('en la mañana también propone mañana: hoy se ofrece pero no se sugiere', () => {
    const opciones = opcionesFechaOperativa(new Date('2026-09-24T08:00:00-06:00'));
    assert.deepEqual(opciones, { hoy: '2026-09-24', manana: '2026-09-25', propuesta: 'manana' });
  });

  it('por la tarde propone mañana', () => {
    const opciones = opcionesFechaOperativa(new Date('2026-09-23T18:00:00-06:00'));
    assert.deepEqual(opciones, { hoy: '2026-09-23', manana: '2026-09-24', propuesta: 'manana' });
  });

  it('cruza fin de mes y de año', () => {
    assert.equal(opcionesFechaOperativa(new Date('2026-12-31T18:00:00-06:00')).manana, '2027-01-01');
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

describe('opcionesCambioFecha', () => {
  it('de hoy a una semana, en orden, con el día actual incluido', () => {
    assert.deepEqual(opcionesCambioFecha('2026-09-25', '2026-09-26'), [
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
  });

  it('agrega el día actual si cae después de la semana, para poder marcarlo', () => {
    const dias = opcionesCambioFecha('2026-09-25', '2026-10-10');
    assert.equal(dias.length, 8);
    assert.equal(dias.at(-1), '2026-10-10');
  });

  it('nunca ofrece un día pasado, aunque la carga esté en uno', () => {
    const dias = opcionesCambioFecha('2026-09-25', '2026-09-24');
    assert.equal(dias[0], '2026-09-25');
    assert.ok(!dias.includes('2026-09-24'));
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
