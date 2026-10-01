/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estadoMotivo } from './motivo.ts';

describe('estadoMotivo', () => {
  it('vacío: no alcanza, y el contador va hacia el mínimo', () => {
    assert.deepEqual(estadoMotivo('', 10, 200), { suficiente: false, contador: '0/10' });
  });

  it('solo espacios no cuentan', () => {
    assert.deepEqual(estadoMotivo('          ', 10, 200), { suficiente: false, contador: '0/10' });
    assert.deepEqual(estadoMotivo('  corto  ', 10, 200), { suficiente: false, contador: '5/10' });
  });

  it('justo en el mínimo ya alcanza, y el contador pasa al máximo', () => {
    assert.deepEqual(estadoMotivo('abcdefghij', 10, 200), { suficiente: true, contador: '10/200' });
  });

  it('lleno: alcanza', () => {
    assert.deepEqual(estadoMotivo('Se abrió con la fecha equivocada', 10, 200), { suficiente: true, contador: '32/200' });
  });

  it('sin máximo, ya completo, solo el largo', () => {
    assert.deepEqual(estadoMotivo('suficiente', 10), { suficiente: true, contador: '10' });
  });
});
