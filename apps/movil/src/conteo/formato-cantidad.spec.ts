/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatearEnPaquetes, formatearTotalPiezas, unidadEnPlural } from './formato-cantidad.ts';

describe('formatearEnPaquetes', () => {
  it('sin factor devuelve solo piezas', () => {
    assert.equal(formatearEnPaquetes(18, null), '18 piezas');
    assert.equal(formatearEnPaquetes(1, null), '1 pieza');
    assert.equal(formatearEnPaquetes(0, null), '0 piezas');
  });

  it('paquetes completos', () => {
    assert.equal(formatearEnPaquetes(18, 6), '3 paquetes');
    assert.equal(formatearEnPaquetes(6, 6), '1 paquete');
  });

  it('paquetes y piezas sueltas', () => {
    assert.equal(formatearEnPaquetes(19, 6), '3 paquetes y 1 pieza');
    assert.equal(formatearEnPaquetes(25, 6), '4 paquetes y 1 pieza');
    assert.equal(formatearEnPaquetes(7, 6), '1 paquete y 1 pieza');
    assert.equal(formatearEnPaquetes(20, 6), '3 paquetes y 2 piezas');
    assert.equal(formatearEnPaquetes(32, 6), '5 paquetes y 2 piezas');
  });

  it('menos de un paquete se dice en piezas', () => {
    assert.equal(formatearEnPaquetes(5, 6), '5 piezas');
    assert.equal(formatearEnPaquetes(1, 6), '1 pieza');
  });

  it('cero con factor se dice en paquetes', () => {
    assert.equal(formatearEnPaquetes(0, 6), '0 paquetes');
  });

  it('factor 1: todo son paquetes', () => {
    assert.equal(formatearEnPaquetes(3, 1), '3 paquetes');
  });

  it('factor inválido se trata como sin factor', () => {
    assert.equal(formatearEnPaquetes(18, 0), '18 piezas');
    assert.equal(formatearEnPaquetes(18, 2.5), '18 piezas');
  });

  it('nunca usa notación decimal', () => {
    for (let piezas = 0; piezas <= 200; piezas++) {
      for (const factor of [null, 1, 2, 6, 12, 24]) {
        assert.doesNotMatch(formatearEnPaquetes(piezas, factor), /[.,]/);
      }
    }
  });
});

describe('formatearEnPaquetes de un producto que se vende completo', () => {
  it('se dice en su unidad: 5 bolsas de CANELS c/70, no 5 paquetes ni 350 piezas', () => {
    assert.equal(formatearEnPaquetes(5, null, 'Bolsa'), '5 bolsas');
    assert.equal(formatearEnPaquetes(5, null, 'Caja'), '5 cajas');
  });

  it('ignora cualquier factor', () => {
    assert.equal(formatearEnPaquetes(5, 70, 'Bolsa'), '5 bolsas');
  });

  it('singular y cero', () => {
    assert.equal(formatearEnPaquetes(1, null, 'Caja'), '1 caja');
    assert.equal(formatearEnPaquetes(0, null, 'Caja'), '0 cajas');
  });

  it('sin nombre de unidad en Handy dice unidades', () => {
    assert.equal(formatearEnPaquetes(3, null, ''), '3 unidades');
    assert.equal(formatearEnPaquetes(1, null, '  '), '1 unidad');
  });
});

describe('unidadEnPlural', () => {
  it('plurales de las unidades del catálogo', () => {
    assert.equal(unidadEnPlural('Caja'), 'cajas');
    assert.equal(unidadEnPlural('Cajetilla'), 'cajetillas');
    assert.equal(unidadEnPlural('Paquete'), 'paquetes');
    assert.equal(unidadEnPlural('PIEZA'), 'piezas');
    assert.equal(unidadEnPlural('Bolsa'), 'bolsas');
  });

  it('consonante final, z y abreviaturas', () => {
    assert.equal(unidadEnPlural('Rollo'), 'rollos');
    assert.equal(unidadEnPlural('Blíster'), 'blísteres');
    assert.equal(unidadEnPlural('Cruz'), 'cruces');
    assert.equal(unidadEnPlural('Cajet.'), 'cajet.');
  });
});

describe('formatearTotalPiezas', () => {
  it('entre paréntesis, con singular y plural', () => {
    assert.equal(formatearTotalPiezas(18), '(18 piezas)');
    assert.equal(formatearTotalPiezas(1), '(1 pieza)');
  });
});
