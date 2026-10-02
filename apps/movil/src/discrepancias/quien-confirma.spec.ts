/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  candidatosConfirmar,
  confirmadorInicial,
  nombreCorto,
  type Participante,
} from './quien-confirma.ts';

const IRVIN: Participante = {
  id: 'vendedor-1',
  nombre: 'Irvin Alday',
  tipoSesion: 'VENDEDOR',
};
const JUAN: Participante = {
  id: 'contador-1',
  nombre: 'Juan Pérez',
  tipoSesion: 'CONTADOR',
};
const ANA: Participante = {
  id: 'contador-2',
  nombre: 'Ana Ruiz',
  tipoSesion: 'CONTADOR',
};

describe('candidatosConfirmar', () => {
  it('nunca ofrece a quien capturó, aunque tenga la sesión abierta', () => {
    assert.deepEqual(
      candidatosConfirmar([IRVIN, JUAN], 'vendedor-1', 'vendedor-1'),
      [JUAN],
    );
  });

  it('pone primero a quien tiene la sesión si puede confirmar', () => {
    assert.deepEqual(
      candidatosConfirmar([IRVIN, JUAN, ANA], 'vendedor-1', 'contador-2'),
      [ANA, JUAN],
    );
  });

  it('sin captura todavía, todos los que contaron', () => {
    assert.deepEqual(candidatosConfirmar([IRVIN, JUAN], null, null), [
      IRVIN,
      JUAN,
    ]);
  });
});

describe('confirmadorInicial', () => {
  it('elige a quien tiene la sesión cuando puede confirmar', () => {
    assert.equal(confirmadorInicial([JUAN, IRVIN], 'contador-1'), 'contador-1');
  });

  it('con una sola otra persona posible, la elige', () => {
    assert.equal(confirmadorInicial([JUAN], 'vendedor-1'), 'contador-1');
  });

  it('con varias y ninguna es la sesión, no elige a nadie', () => {
    assert.equal(confirmadorInicial([JUAN, ANA], 'vendedor-1'), null);
  });
});

describe('nombreCorto', () => {
  it('toma el primer nombre', () => {
    assert.equal(nombreCorto('  Juan  Pérez '), 'Juan');
  });
});
