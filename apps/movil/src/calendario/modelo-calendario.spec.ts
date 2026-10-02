/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mesDe,
  moverMes,
  semanasDelMes,
  tituloMes,
} from './modelo-calendario.ts';

describe('semanasDelMes', () => {
  it('septiembre 2026 empieza en martes y los domingos van en la última columna', () => {
    const semanas = semanasDelMes({ anio: 2026, mes: 9 });
    assert.equal(semanas[0][0], null);
    assert.equal(semanas[0][1]?.dia, '2026-09-01');
    assert.equal(semanas[0][6]?.dia, '2026-09-06');
    assert.equal(semanas[0][6]?.esDomingo, true);
    assert.equal(semanas[3][6]?.dia, '2026-09-27');
    assert.ok(semanas.every((s) => s.length === 7));
  });

  it('cubre todos los días del mes, sin repetir', () => {
    const dias = semanasDelMes({ anio: 2028, mes: 2 })
      .flat()
      .filter((c) => c !== null);
    assert.equal(dias.length, 29);
    assert.equal(dias.at(-1)?.dia, '2028-02-29');
  });

  it('solo los domingos se marcan como domingo', () => {
    const domingos = semanasDelMes({ anio: 2026, mes: 12 })
      .flat()
      .filter((c) => c?.esDomingo)
      .map((c) => c?.numero);
    assert.deepEqual(domingos, [6, 13, 20, 27]);
  });
});

describe('moverMes', () => {
  it('cruza el año hacia adelante y hacia atrás', () => {
    assert.deepEqual(moverMes({ anio: 2026, mes: 12 }, 1), {
      anio: 2027,
      mes: 1,
    });
    assert.deepEqual(moverMes({ anio: 2027, mes: 1 }, -1), {
      anio: 2026,
      mes: 12,
    });
  });
});

describe('mesDe / tituloMes', () => {
  it('lee el mes de un día y lo nombra', () => {
    assert.equal(tituloMes(mesDe('2026-12-24')), 'Diciembre 2026');
  });
});
