/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PermisoCargaApi } from '../api/permisos.ts';
import {
  momentoLegible,
  motivoValido,
  normalizarPermisos,
  rutasConPermisoPendiente,
  tiempoRestante,
} from './modelo-permisos.ts';

const AHORA = new Date('2026-09-23T17:00:00-06:00');
const HORA = 60 * 60 * 1000;

function fila(id: string, extra: Partial<PermisoCargaApi> = {}): PermisoCargaApi {
  return {
    id,
    rutaId: 'ruta-1',
    rutaNombre: 'Ruta 1',
    otorgadoPorId: 'sup-1',
    otorgadoPorNombre: 'Ana',
    motivo: 'Liquida mañana',
    fechaOtorgado: new Date(AHORA.getTime() - HORA).toISOString(),
    fechaExpiracion: new Date(AHORA.getTime() + 23 * HORA).toISOString(),
    usado: false,
    eventoCargaId: null,
    ...extra,
  };
}

describe('tiempoRestante', () => {
  it('en horas y minutos', () => {
    assert.equal(tiempoRestante(new Date(AHORA.getTime() + 5 * HORA + 20 * 60_000), AHORA), 'Quedan 5 h 20 min');
    assert.equal(tiempoRestante(new Date(AHORA.getTime() + 2 * HORA), AHORA), 'Quedan 2 h');
  });

  it('con menos de una hora, solo minutos', () => {
    assert.equal(tiempoRestante(new Date(AHORA.getTime() + 35 * 60_000 + 30_000), AHORA), 'Quedan 35 min');
  });

  it('al borde y ya vencido', () => {
    assert.equal(tiempoRestante(new Date(AHORA.getTime() + 30_000), AHORA), 'Vence en menos de un minuto');
    assert.equal(tiempoRestante(AHORA, AHORA), 'Vencido');
  });
});

describe('momentoLegible', () => {
  it('usa la hora del negocio y el día relativo', () => {
    assert.equal(momentoLegible(new Date('2026-09-24T17:05:00-06:00'), AHORA), 'mañana a las 17:05');
    assert.equal(momentoLegible(new Date('2026-09-23T09:00:00-06:00'), AHORA), 'hoy a las 09:00');
  });
});

describe('normalizarPermisos', () => {
  it('descarta filas sin id o sin vencimiento y pone los usados al final', () => {
    const permisos = normalizarPermisos([
      fila('usado', { usado: true, eventoCargaId: 'ev-1', fechaExpiracion: new Date(AHORA.getTime() + HORA).toISOString() }),
      fila('tarde'),
      fila('pronto', { fechaExpiracion: new Date(AHORA.getTime() + 2 * HORA).toISOString() }),
      fila('', {}),
      fila('sin-fecha', { fechaExpiracion: null }),
    ]);
    assert.deepEqual(
      permisos.map((p) => p.id),
      ['pronto', 'tarde', 'usado'],
    );
    assert.equal(permisos[2].eventoCargaId, 'ev-1');
  });
});

describe('rutasConPermisoPendiente', () => {
  it('solo cuenta los sin usar y sin vencer', () => {
    const permisos = normalizarPermisos([
      fila('a', { rutaId: 'r1' }),
      fila('b', { rutaId: 'r2', usado: true }),
      fila('c', { rutaId: 'r3', fechaExpiracion: AHORA.toISOString() }),
    ]);
    assert.deepEqual([...rutasConPermisoPendiente(permisos, AHORA)], ['r1']);
  });
});

describe('motivoValido', () => {
  it('no cuenta los espacios de las orillas', () => {
    assert.equal(motivoValido('  ok   ', 5), false);
    assert.equal(motivoValido(' Liquida ', 5), true);
  });
});
