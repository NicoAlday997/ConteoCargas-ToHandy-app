/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { textoFranjaDiferencia } from './franja-diferencia.ts';

describe('textoFranjaDiferencia', () => {
  it('caso largo: 1 paquete y 2 piezas, con quién contó más y el total', () => {
    assert.deepEqual(textoFranjaDiferencia(8, 6, null, 'Vendedor: más'), {
      valor: '1 paquete y 2 piezas',
      detalle: 'Vendedor: más · (8 piezas)',
    });
  });

  it('caso más largo: 12 paquetes y 11 piezas', () => {
    assert.deepEqual(
      textoFranjaDiferencia(12 * 12 + 11, 12, null, 'Contador: más'),
      {
        valor: '12 paquetes y 11 piezas',
        detalle: 'Contador: más · (155 piezas)',
      },
    );
  });

  it('sin factor no repite el total en piezas', () => {
    assert.deepEqual(textoFranjaDiferencia(5, null, null, 'Vendedor: más'), {
      valor: '5 piezas',
      detalle: 'Vendedor: más',
    });
  });

  it('sin nada que decir abajo, sin detalle', () => {
    assert.deepEqual(textoFranjaDiferencia(5, null, null, null), {
      valor: '5 piezas',
      detalle: null,
    });
  });
});
