/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatearNombreFamilia, formatearNombreProducto } from './formato-nombre.ts';

describe('formatearNombreProducto', () => {
  it('mayúscula inicial por palabra, sin tocar el empaque', () => {
    assert.equal(formatearNombreProducto('ENCENDEDOR ECONOMICOS C/50'), 'Encendedor Economicos C/50');
  });

  it('deja las siglas cortas que ya venían en mayúsculas', () => {
    assert.equal(formatearNombreProducto('PILA PANASONIC AA, AAA'), 'Pila Panasonic AA, AAA');
  });

  it('deja números, unidades y empaques', () => {
    assert.equal(formatearNombreProducto('BIG COLA 3.030 LT C/6'), 'Big Cola 3.030 LT C/6');
  });

  it('deja intacto lo que ya trae minúsculas o números', () => {
    assert.equal(formatearNombreProducto('NESCAFE 16 S./14g'), 'Nescafe 16 S./14g');
  });

  it('respeta unidades pegadas a la cifra y el c/ en minúscula', () => {
    assert.equal(formatearNombreProducto('REFRESCO 2L 600ML 1KG CANELS c/70'), 'Refresco 2L 600ML 1KG Canels c/70');
  });

  it('acentos y eñes', () => {
    assert.equal(formatearNombreProducto('PIÑA ÁCIDA'), 'Piña Ácida');
  });
});

describe('formatearNombreFamilia', () => {
  it('solo la primera letra en mayúscula', () => {
    assert.equal(formatearNombreFamilia('REFRESCOS'), 'Refrescos');
    assert.equal(formatearNombreFamilia('BOTANAS Y DULCES'), 'Botanas y dulces');
  });

  it('conserva siglas y lo que ya traía minúsculas', () => {
    assert.equal(formatearNombreFamilia('PILAS AA'), 'Pilas AA');
    assert.equal(formatearNombreFamilia('Aguas'), 'Aguas');
  });
});
