/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fraccionAvance } from './fraccion-avance.ts';

describe('fraccionAvance', () => {
  it('con total 0 no hay avance', () => {
    assert.equal(fraccionAvance(0, 0), 0);
    assert.equal(fraccionAvance(3, 0), 0);
  });

  it('se topa en 1 si lo actual pasa del total', () => {
    assert.equal(fraccionAvance(14, 14), 1);
    assert.equal(fraccionAvance(20, 14), 1);
  });

  it('la mitad con 7 de 14', () => {
    assert.equal(fraccionAvance(7, 14), 0.5);
  });

  it('nunca negativa', () => {
    assert.equal(fraccionAvance(-2, 14), 0);
  });
});
