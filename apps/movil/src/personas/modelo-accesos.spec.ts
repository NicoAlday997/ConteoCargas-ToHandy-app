/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MovimientoAccesoApi } from '../api/personas.ts';
import {
  normalizarAccesos,
  textoBloqueoQuitado,
  textoMomento,
  tituloMovimiento,
  type MovimientoAcceso,
} from './modelo-accesos.ts';

function api(over: Partial<MovimientoAccesoApi>): MovimientoAccesoApi {
  return {
    id: 'm',
    tipo: 'PIN_RESTABLECIDO',
    fecha: '2026-09-30T12:00:00-06:00',
    origen: 'SUPERVISOR',
    autor: { id: 's', nombreCompleto: 'Cristian Alday' },
    motivo: null,
    bloqueadoHasta: null,
    ...over,
  };
}

describe('normalizarAccesos', () => {
  it('distingue los tres tipos de renglón', () => {
    const [pin, emergencia, desbloqueo] = normalizarAccesos([
      api({ id: 'a' }),
      api({
        id: 'b',
        origen: 'LINEA_COMANDOS',
        autor: null,
        motivo: ' Único supervisor olvidó su PIN ',
      }),
      api({
        id: 'c',
        tipo: 'BLOQUEO_QUITADO',
        bloqueadoHasta: '2026-09-30T12:12:00-06:00',
      }),
    ]);
    assert.equal(pin.tipo, 'pin');
    assert.deepEqual(emergencia, {
      id: 'b',
      tipo: 'pin-emergencia',
      fecha: new Date('2026-09-30T12:00:00-06:00'),
      motivo: 'Único supervisor olvidó su PIN',
    });
    assert.equal(desbloqueo.tipo, 'desbloqueo');
  });

  it('respeta el orden del servidor', () => {
    const ids = normalizarAccesos([api({ id: 'z' }), api({ id: 'a' })]).map(
      (m) => m.id,
    );
    assert.deepEqual(ids, ['z', 'a']);
  });

  it('sin nombre de autor no esconde el renglón', () => {
    const [m] = normalizarAccesos([api({ autor: null })]);
    assert.equal(tituloMovimiento(m), 'PIN restablecido por un supervisor');
  });

  it('descarta solo lo que no se puede mostrar', () => {
    assert.deepEqual(
      normalizarAccesos([
        api({ id: null }),
        api({ fecha: 'no' }),
        api({ tipo: null }),
      ]),
      [],
    );
    assert.deepEqual(normalizarAccesos(null), []);
  });
});

describe('tituloMovimiento', () => {
  const fecha = new Date('2026-09-30T12:00:00-06:00');
  it('dice qué pasó y quién lo hizo', () => {
    assert.equal(
      tituloMovimiento({
        id: 'a',
        tipo: 'pin',
        fecha,
        autor: 'Cristian Alday',
      }),
      'PIN restablecido por Cristian Alday',
    );
    assert.equal(
      tituloMovimiento({ id: 'b', tipo: 'pin-emergencia', fecha, motivo: 'x' }),
      'PIN restablecido por línea de comandos',
    );
    assert.equal(
      tituloMovimiento({
        id: 'c',
        tipo: 'desbloqueo',
        fecha,
        autor: 'Cristian Alday',
        bloqueadoHasta: null,
      }),
      'Bloqueo quitado por Cristian Alday',
    );
  });
});

describe('textoMomento', () => {
  const ahora = new Date('2026-10-01T09:00:00-06:00').getTime();
  it('hoy, otro día del año y otro año', () => {
    assert.equal(
      textoMomento(new Date('2026-10-01T05:57:00-06:00'), ahora),
      'Hoy, 05:57',
    );
    assert.equal(
      textoMomento(new Date('2026-09-24T23:58:00-06:00'), ahora),
      'Jueves 24 de septiembre, 23:58',
    );
    assert.equal(
      textoMomento(new Date('2025-09-24T23:58:00-06:00'), ahora),
      'Miércoles 24 de septiembre de 2025, 23:58',
    );
  });
});

describe('textoBloqueoQuitado', () => {
  const base: Extract<MovimientoAcceso, { tipo: 'desbloqueo' }> = {
    id: 'c',
    tipo: 'desbloqueo',
    fecha: new Date('2026-09-30T06:00:00-06:00'),
    autor: 'Cristian Alday',
    bloqueadoHasta: new Date('2026-09-30T06:12:00-06:00'),
  };
  it('mismo día: solo la hora', () => {
    assert.equal(textoBloqueoQuitado(base), 'El bloqueo iba hasta las 06:12');
  });
  it('pasaba de medianoche: también el día', () => {
    assert.equal(
      textoBloqueoQuitado({
        ...base,
        fecha: new Date('2026-09-30T23:55:00-06:00'),
        bloqueadoHasta: new Date('2026-10-01T00:07:00-06:00'),
      }),
      'El bloqueo iba hasta el jueves 1 de octubre, 00:07',
    );
  });
  it('sin dato, nada', () => {
    assert.equal(textoBloqueoQuitado({ ...base, bloqueadoHasta: null }), null);
  });
});
