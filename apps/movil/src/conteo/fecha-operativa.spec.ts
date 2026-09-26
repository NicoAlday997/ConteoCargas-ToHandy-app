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
  opcionesFechaOperativa,
  sumarDias,
  textoSalida,
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
