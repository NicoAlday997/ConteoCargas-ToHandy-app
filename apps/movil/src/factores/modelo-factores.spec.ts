/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FactorPendienteApi } from '../api/factores.ts';
import {
  agruparPendientes,
  contarPendientes,
  piezasDesdeTexto,
  resumenConfirmacion,
  textoProductos,
} from './modelo-factores.ts';

function fila(code: string | null, nombre: string, familia: string | null, sugerido: number | null = null): FactorPendienteApi {
  return { code, nombre, familia, modalidadVenta: 'POR_PIEZA', piezasPorPaqueteSugerido: sugerido };
}

describe('agruparPendientes', () => {
  it('agrupa por familia en orden alfabético, sin familia al final y productos por nombre', () => {
    const familias = agruparPendientes([
      fila('3', 'PEPSI 1.5 LT C/12', 'REFRESCOS', 12),
      fila('1', 'CANELS. c/70', 'DULCES', 70),
      fila('9', 'SUELTO', null),
      fila('2', 'CANELS. c/60', 'DULCES', 60),
    ]);
    assert.deepEqual(
      familias.map((f) => [f.titulo, f.data.map((p) => p.nombre)]),
      [
        ['DULCES', ['CANELS. c/60', 'CANELS. c/70']],
        ['REFRESCOS', ['PEPSI 1.5 LT C/12']],
        ['Sin familia', ['SUELTO']],
      ],
    );
    assert.equal(familias[2]?.familia, null);
    assert.equal(contarPendientes(familias), 4);
  });

  it('descarta filas sin código y códigos repetidos', () => {
    const familias = agruparPendientes([fila(null, 'X', 'A'), fila(' ', 'Y', 'A'), fila('1', 'Z', 'A'), fila('1', 'Z2', 'A')]);
    assert.equal(contarPendientes(familias), 1);
  });

  it('una sugerencia fuera de rango se trata como "no se pudo extraer"', () => {
    const [familia] = agruparPendientes([fila('1', 'A', 'F', 0), fila('2', 'B', 'F', 501), fila('3', 'C', 'F', 2.5), fila('4', 'D', 'F', 24)]);
    assert.deepEqual(
      familia?.data.map((p) => p.sugerido),
      [null, null, null, 24],
    );
  });

  it('sin datos, sin familias', () => {
    assert.deepEqual(agruparPendientes(null), []);
  });
});

describe('piezasDesdeTexto', () => {
  it('acepta enteros de 1 a 500', () => {
    assert.equal(piezasDesdeTexto('1'), 1);
    assert.equal(piezasDesdeTexto('12'), 12);
    assert.equal(piezasDesdeTexto('500'), 500);
  });

  it('rechaza vacío, cero y fuera de rango', () => {
    assert.equal(piezasDesdeTexto(''), null);
    assert.equal(piezasDesdeTexto('0'), null);
    assert.equal(piezasDesdeTexto('501'), null);
  });
});

describe('resumenConfirmacion', () => {
  it('lo completo se envía 1 a 1: el c/70 del nombre no multiplica', () => {
    assert.equal(resumenConfirmacion('COMPLETO', null), 'Al contar 5 paquetes, se enviarán 5 a Handy.');
    assert.equal(resumenConfirmacion('COMPLETO', 70), 'Al contar 5 paquetes, se enviarán 5 a Handy.');
  });

  it('por pieza multiplica por las piezas del paquete', () => {
    assert.equal(resumenConfirmacion('POR_PIEZA', 12), 'Al contar 5 paquetes, se enviarán 60 piezas a Handy.');
  });

  it('de una familia, el ejemplo aplica a cada producto', () => {
    assert.equal(resumenConfirmacion('COMPLETO', null, true), 'Al contar 5 paquetes de cualquiera de ellos, se enviarán 5 a Handy.');
  });
});

describe('textoProductos', () => {
  it('singular y plural', () => {
    assert.equal(textoProductos(1), '1 producto');
    assert.equal(textoProductos(12), '12 productos');
  });
});
