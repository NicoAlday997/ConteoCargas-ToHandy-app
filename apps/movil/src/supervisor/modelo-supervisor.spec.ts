/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CargaHistorialApi } from '../api/historial.ts';
import type { EventoConTiemposApi } from '../api/supervisor.ts';
import {
  accionCancelacion,
  armarCola,
  armarPorEnviar,
  codigosDeDetalle,
  inicioEspera,
  minutosEspera,
  motivoCancelacionValido,
  nivelEspera,
  rechazosParaEnviar,
  textoEspera,
} from './modelo-supervisor.ts';

function fila(id: string, extra: Partial<CargaHistorialApi> = {}): CargaHistorialApi {
  return {
    id,
    rutaNombre: 'Ruta 1',
    tipo: 'INICIAL',
    estado: 'EN_ESPERA_AUTORIZACION',
    fechaOperativa: '2026-09-24T06:00:00.000Z',
    fechaConteo: '2026-09-24T01:00:00.000Z',
    vendedorNombre: 'Ana',
    contadorNombre: 'Luis',
    totalProductos: 40,
    productosConDiscrepancia: 0,
    autorizada: false,
    autorizadaPorNombre: null,
    ...extra,
  };
}

function tiempos(finalizadas: (string | null)[], confirmadas: (string | null)[] = []): EventoConTiemposApi {
  return {
    evento: { estado: 'EN_ESPERA_AUTORIZACION' },
    sesiones: finalizadas.map((finalizadaEn) => ({ finalizadaEn })),
    discrepancias: confirmadas.map((fechaConfirmacion) => ({ fechaConfirmacion })),
  };
}

describe('inicioEspera', () => {
  it('toma el cierre de sesión más reciente', () => {
    const t = inicioEspera(tiempos(['2026-09-24T10:00:00.000Z', '2026-09-24T11:30:00.000Z']));
    assert.equal(t, Date.parse('2026-09-24T11:30:00.000Z'));
  });

  it('una diferencia confirmada después del conteo manda', () => {
    const t = inicioEspera(tiempos(['2026-09-24T10:00:00.000Z', '2026-09-24T11:00:00.000Z'], ['2026-09-24T12:15:00.000Z', null]));
    assert.equal(t, Date.parse('2026-09-24T12:15:00.000Z'));
  });

  it('ignora sesiones abiertas y fechas ilegibles', () => {
    const t = inicioEspera(tiempos([null, 'no es fecha', '2026-09-24T09:00:00.000Z']));
    assert.equal(t, Date.parse('2026-09-24T09:00:00.000Z'));
  });

  it('sin ninguna fecha, null', () => {
    assert.equal(inicioEspera(tiempos([null])), null);
    assert.equal(inicioEspera(null), null);
  });
});

describe('armarCola', () => {
  it('ordena de la que más espera a la más reciente, sin espera al final', () => {
    const cola = armarCola(
      [fila('nueva'), fila('sin-dato'), fila('vieja')],
      new Map([
        ['nueva', tiempos(['2026-09-24T12:00:00.000Z'])],
        ['sin-dato', null],
        ['vieja', tiempos(['2026-09-24T08:00:00.000Z'])],
      ]),
    );
    assert.deepEqual(
      cola.map((c) => c.id),
      ['vieja', 'nueva', 'sin-dato'],
    );
  });

  it('no usa fechaConteo para la espera', () => {
    const [c] = armarCola([fila('a', { fechaConteo: '2026-09-20T00:00:00.000Z' })], new Map([['a', tiempos(['2026-09-24T12:00:00.000Z'])]]));
    assert.equal(c?.esperaDesde, Date.parse('2026-09-24T12:00:00.000Z'));
  });

  it('descarta filas sin id y repetidas', () => {
    const cola = armarCola([fila('a'), fila('a'), fila('', { id: null })], new Map());
    assert.equal(cola.length, 1);
  });
});

describe('armarPorEnviar', () => {
  it('del día más reciente al más viejo', () => {
    const lista = armarPorEnviar([
      fila('lunes', { fechaOperativa: '2026-09-21T06:00:00.000Z' }),
      fila('jueves', { fechaOperativa: '2026-09-24T06:00:00.000Z' }),
    ]);
    assert.deepEqual(
      lista.map((f) => f.id),
      ['jueves', 'lunes'],
    );
  });
});

describe('espera', () => {
  const ahora = Date.parse('2026-09-24T12:00:00.000Z');

  it('minutos enteros y nunca negativos', () => {
    assert.equal(minutosEspera(ahora - 90_000, ahora), 1);
    assert.equal(minutosEspera(ahora + 60_000, ahora), 0);
    assert.equal(minutosEspera(null, ahora), null);
  });

  it('niveles por umbral', () => {
    assert.equal(nivelEspera(5), 'reciente');
    assert.equal(nivelEspera(20), 'atencion');
    assert.equal(nivelEspera(45), 'detenida');
    assert.equal(nivelEspera(null), 'desconocida');
  });

  it('texto legible', () => {
    assert.equal(textoEspera(0), 'Menos de 1 min');
    assert.equal(textoEspera(12), '12 min');
    assert.equal(textoEspera(60), '1 h');
    assert.equal(textoEspera(65), '1 h 5 min');
    assert.equal(textoEspera(60 * 24), '1 día');
    assert.equal(textoEspera(60 * 50), '2 días');
  });
});

describe('rechazosParaEnviar', () => {
  it('solo lo marcado, con el motivo recortado', () => {
    assert.deepEqual(rechazosParaEnviar({ A: '  faltan 2 cajas ' }), [{ productoCode: 'A', motivo: 'faltan 2 cajas' }]);
  });

  it('nada marcado o un motivo corto no se puede enviar', () => {
    assert.equal(rechazosParaEnviar({}), null);
    assert.equal(rechazosParaEnviar({ A: 'faltan 2', B: ' ok ' }), null);
  });
});

describe('codigosDeDetalle', () => {
  it('lee los códigos del detalle del 409', () => {
    assert.deepEqual(codigosDeDetalle('Productos rechazados: 101, 202,303'), ['101', '202', '303']);
  });

  it('sin detalle, nada', () => {
    assert.deepEqual(codigosDeDetalle(null), []);
    assert.deepEqual(codigosDeDetalle('Productos rechazados: '), []);
  });
});

describe('accionCancelacion', () => {
  it('ENVIADA se cancela en Handy', () => {
    assert.equal(accionCancelacion('ENVIADA'), 'cancelar-en-handy');
  });

  it('lo que aún no llega a Handy se cancela aquí', () => {
    for (const estado of [
      'BORRADOR',
      'EN_ESPERA_CONTADOR',
      'BLOQUEADA_CORTE_PENDIENTE',
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
      'EN_ESPERA_AUTORIZACION',
      'LISTA_PARA_ENVIAR',
      'ERROR_ENVIO',
    ] as const) {
      assert.equal(accionCancelacion(estado), 'cancelar', estado);
    }
  });

  it('nada en CANCELADA, en ENVIO_INCIERTO ni sin estado', () => {
    assert.equal(accionCancelacion('CANCELADA'), null);
    assert.equal(accionCancelacion('ENVIO_INCIERTO'), null);
    assert.equal(accionCancelacion(null), null);
  });
});

describe('motivoCancelacionValido', () => {
  it('pide al menos 5 caracteres sin contar espacios de los lados', () => {
    assert.equal(motivoCancelacionValido('abcde'), true);
    assert.equal(motivoCancelacionValido('  abcd  '), false);
    assert.equal(motivoCancelacionValido(''), false);
  });
});
