/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizarPrevisualizacion,
  preguntaRecorrer,
  rutasEnConflicto,
  textoConflicto,
  textoRecorridas,
} from './recorrer-cargas.ts';

// El 5 de octubre de 2026 es lunes.
const LUNES_5 = '2026-10-05';

describe('preguntaRecorrer', () => {
  it('nombra cuántas cargas y a qué día', () => {
    assert.equal(
      preguntaRecorrer(6, LUNES_5),
      'Este día tiene 6 cargas. ¿Las recorres al lunes 5?',
    );
    assert.equal(
      preguntaRecorrer(1, LUNES_5),
      'Este día tiene 1 carga. ¿La recorres al lunes 5?',
    );
  });

  it('sin destino sugerido, pregunta el día', () => {
    assert.equal(
      preguntaRecorrer(2, null),
      'Este día tiene 2 cargas. ¿A qué día las recorres?',
    );
  });
});

describe('textoConflicto', () => {
  it('dice la ruta con nombre y el día', () => {
    assert.equal(
      textoConflicto([{ rutaNombre: 'Ruta 3' }], LUNES_5),
      'La Ruta 3 ya tiene una carga inicial para el lunes 5. Resuélvela antes de recorrer las demás.',
    );
  });

  it('con varias, las nombra todas', () => {
    assert.equal(
      textoConflicto(
        [
          { rutaNombre: 'Ruta 1' },
          { rutaNombre: 'Ruta 2' },
          { rutaNombre: 'Ruta 3' },
        ],
        LUNES_5,
      ),
      'Ruta 1, Ruta 2 y Ruta 3 ya tienen una carga inicial para el lunes 5. Resuélvelas antes de recorrer las demás.',
    );
  });
});

describe('textoRecorridas', () => {
  it('confirma cuántas se movieron', () => {
    assert.equal(
      textoRecorridas(6, LUNES_5),
      'Se recorrieron 6 cargas al lunes 5.',
    );
    assert.equal(
      textoRecorridas(1, LUNES_5),
      'Se recorrió 1 carga al lunes 5.',
    );
  });
});

describe('normalizarPrevisualizacion', () => {
  it('lee cargas, excluidas y destino, y descarta renglones sin id', () => {
    const vista = normalizarPrevisualizacion(
      {
        cargas: [
          {
            id: 'ev-1',
            rutaNombre: 'Ruta 1',
            vendedorNombre: 'Irvin',
            tipo: 'INICIAL',
            estado: 'ENVIADA',
            totalProductos: 40,
          },
          { rutaNombre: 'sin id' },
        ],
        excluidas: [{ id: 'ev-2', rutaNombre: 'Ruta 2', estado: 'CANCELADA' }],
        destinoSugerido: LUNES_5,
      },
      '2026-10-03',
    );
    assert.deepEqual(vista.cargas, [
      {
        id: 'ev-1',
        rutaNombre: 'Ruta 1',
        vendedorNombre: 'Irvin',
        tipo: 'INICIAL',
        estado: 'ENVIADA',
        totalProductos: 40,
      },
    ]);
    assert.equal(vista.excluidas.length, 1);
    assert.equal(vista.destinoSugerido, LUNES_5);
  });

  it('una respuesta vacía no truena', () => {
    assert.deepEqual(normalizarPrevisualizacion(null, '2026-10-03'), {
      fecha: '2026-10-03',
      cargas: [],
      excluidas: [],
      destinoSugerido: null,
    });
  });
});

describe('rutasEnConflicto', () => {
  it('saca los nombres del 409', () => {
    assert.deepEqual(
      rutasEnConflicto({ rutas: [{ rutaNombre: 'Ruta 3', rutaId: 'r3' }] }),
      [{ rutaNombre: 'Ruta 3' }],
    );
    assert.deepEqual(rutasEnConflicto(null), []);
  });
});
