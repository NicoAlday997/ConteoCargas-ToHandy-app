/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RespuestaEvento, SesionConteoApi } from '../api/cargas.ts';
import { vigenciaDesdeEstadoHttp, vigenciaDesdeEvento } from './vigencia-carga.ts';

function sesion(id: string, estado: SesionConteoApi['estado']): SesionConteoApi {
  return {
    id,
    eventoCargaId: 'e1',
    tipo: 'VENDEDOR',
    usuarioAppId: 'u1',
    estado,
    iniciadaEn: null,
    finalizadaEn: null,
  };
}

function respuesta(sesiones: SesionConteoApi[] | null, estado = 'BORRADOR'): RespuestaEvento {
  return {
    evento: {
      id: 'e1',
      rutaId: 'r1',
      plantillaId: null,
      tipo: 'INICIAL',
      estado,
      fechaConteo: null,
      fechaOperativa: null,
      creadoEn: null,
    },
    sesiones,
  };
}

describe('vigenciaDesdeEvento', () => {
  it('una carga CANCELADA ya no se puede continuar, aunque la sesión figure abierta', () => {
    assert.equal(vigenciaDesdeEvento(respuesta([sesion('s1', 'ABIERTA')], 'CANCELADA'), 's1'), 'no-disponible');
  });

  it('con la sesión abierta se puede continuar', () => {
    assert.equal(vigenciaDesdeEvento(respuesta([sesion('s1', 'ABIERTA')]), 's1'), 'vigente');
  });

  it('con la sesión ya cerrada no hay nada que continuar', () => {
    assert.equal(vigenciaDesdeEvento(respuesta([sesion('s1', 'CERRADA')]), 's1'), 'no-disponible');
  });

  it('si la sesión ya no está en el evento, no está disponible', () => {
    assert.equal(vigenciaDesdeEvento(respuesta([sesion('otra', 'ABIERTA')]), 's1'), 'no-disponible');
  });

  it('una respuesta ilegible no borra lo contado', () => {
    assert.equal(vigenciaDesdeEvento(null, 's1'), 'sin-verificar');
    assert.equal(vigenciaDesdeEvento(respuesta(null), 's1'), 'sin-verificar');
    assert.equal(vigenciaDesdeEvento({ evento: null, sesiones: [] }, 's1'), 'sin-verificar');
  });
});

describe('vigenciaDesdeEstadoHttp', () => {
  it('404 y 403 significan que la carga ya no es de este teléfono', () => {
    assert.equal(vigenciaDesdeEstadoHttp(404), 'no-disponible');
    assert.equal(vigenciaDesdeEstadoHttp(403), 'no-disponible');
  });

  it('un error del servidor no borra lo contado', () => {
    assert.equal(vigenciaDesdeEstadoHttp(500), 'sin-verificar');
    assert.equal(vigenciaDesdeEstadoHttp(503), 'sin-verificar');
  });
});
