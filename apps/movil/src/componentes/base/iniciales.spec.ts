/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { iniciales } from './iniciales.ts';

describe('iniciales', () => {
  it('nombre y primer apellido', () => {
    assert.equal(iniciales('Irvin Alday'), 'IA');
    assert.equal(iniciales('María López Ruiz'), 'ML');
  });

  it('una sola palabra: su primera letra', () => {
    assert.equal(iniciales('Beto'), 'B');
  });

  it('sin nombre: signo de pregunta', () => {
    assert.equal(iniciales(''), '?');
    assert.equal(iniciales('   '), '?');
    assert.equal(iniciales(null), '?');
  });

  it('en mayúsculas y sin espacios de más', () => {
    assert.equal(iniciales('  ana   ruiz '), 'AR');
  });
});
