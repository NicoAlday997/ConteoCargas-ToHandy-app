/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  falloSincronizacion,
  resumirSincronizacion,
  textoSinConfirmar,
  textoUltimaSincronizacion,
} from './modelo-sincronizacion.ts';

// 30 sep 2026, 10:00 en México (16:00 UTC).
const AHORA = new Date('2026-09-30T16:00:00.000Z');

describe('textoUltimaSincronizacion', () => {
  it('nunca sincronizado', () => {
    assert.deepEqual(textoUltimaSincronizacion(null, AHORA), { texto: 'Nunca se ha sincronizado', vieja: true });
  });

  it('hoy a las 5:00 a.m., en la hora del negocio', () => {
    assert.deepEqual(textoUltimaSincronizacion('2026-09-30T11:00:00.000Z', AHORA), {
      texto: 'Última vez: hoy a las 5:00 a.m.',
      vieja: false,
    });
  });

  it('ayer por la noche, en 12 h', () => {
    assert.equal(textoUltimaSincronizacion('2026-09-30T03:30:00.000Z', AHORA).texto, 'Última vez: ayer a las 9:30 p.m.');
  });

  it('mediodía y medianoche', () => {
    assert.equal(textoUltimaSincronizacion('2026-09-30T18:05:00.000Z', AHORA).texto, 'Última vez: hoy a las 12:05 p.m.');
    assert.equal(textoUltimaSincronizacion('2026-09-30T06:00:00.000Z', AHORA).texto, 'Última vez: hoy a las 12:00 a.m.');
  });

  it('más atrás lleva la fecha corta', () => {
    assert.equal(textoUltimaSincronizacion('2026-09-28T11:00:00.000Z', AHORA).texto, 'Última vez: el 28 sep a las 5:00 a.m.');
  });

  it('se marca vieja con más de 3 días', () => {
    assert.equal(textoUltimaSincronizacion('2026-09-27T16:00:00.000Z', AHORA).vieja, false);
    assert.equal(textoUltimaSincronizacion('2026-09-27T15:59:00.000Z', AHORA).vieja, true);
  });
});

describe('resumirSincronizacion', () => {
  it('solo los renglones con algo que decir', () => {
    const resumen = resumirSincronizacion({
      productos: { nuevos: 3, actualizados: 1, desactivados: 0, sinConfirmarEmpaque: 2 },
      vendedores: { nuevos: 0, actualizados: 1, desactivados: 0 },
      sincronizadoEn: '2026-09-30T21:00:00.000Z',
    });
    assert.deepEqual(resumen, {
      titulo: 'Se actualizó el catálogo',
      renglones: ['3 productos nuevos', '1 producto actualizado', '1 vendedor actualizado'],
      sinConfirmarEmpaque: 2,
      errorVendedores: null,
    });
  });

  it('sin cambios: todo al día', () => {
    const resumen = resumirSincronizacion({
      productos: { nuevos: 0, actualizados: 0, desactivados: 0, sinConfirmarEmpaque: 0 },
      vendedores: { nuevos: 0, actualizados: 0, desactivados: 0 },
      sincronizadoEn: null,
    });
    assert.equal(resumen.titulo, 'Todo al día');
    assert.deepEqual(resumen.renglones, []);
  });

  it('los dados de baja también se dicen', () => {
    const resumen = resumirSincronizacion({
      productos: { nuevos: 0, actualizados: 0, desactivados: 2, sinConfirmarEmpaque: 0 },
      vendedores: { nuevos: 0, actualizados: 0, desactivados: 1 },
      sincronizadoEn: null,
    });
    assert.deepEqual(resumen.renglones, ['2 productos dados de baja en Handy', '1 vendedor dado de baja en Handy']);
  });

  it('vendedores que fallaron: el motivo', () => {
    const resumen = resumirSincronizacion({
      productos: { nuevos: 1, actualizados: 0, desactivados: 0, sinConfirmarEmpaque: 0 },
      vendedores: null,
      errorVendedores: 'Handy no esta disponible en este momento.',
      sincronizadoEn: null,
    });
    assert.equal(resumen.errorVendedores, 'Handy no esta disponible en este momento.');
    assert.deepEqual(resumen.renglones, ['1 producto nuevo']);
  });
});

describe('textoSinConfirmar', () => {
  it('singular y plural', () => {
    assert.equal(textoSinConfirmar(1), '1 producto no se puede contar hasta que confirmes cómo se vende.');
    assert.equal(textoSinConfirmar(2), '2 productos no se pueden contar hasta que confirmes cómo se venden.');
  });
});

describe('falloSincronizacion', () => {
  it('Handy caído: reintentable', () => {
    const fallo = falloSincronizacion({ sinRed: false, estado: 502, codigo: 'HANDY_NO_DISPONIBLE' });
    assert.equal(fallo.titulo, 'Handy no respondió');
    assert.equal(fallo.detalle, 'Vuelve a intentarlo en un momento; no se perdió nada.');
    assert.equal(fallo.reintentable, true);
  });

  it('token inválido: no se arregla reintentando', () => {
    const fallo = falloSincronizacion({ sinRed: false, estado: 502, codigo: 'HANDY_TOKEN_INVALIDO' });
    assert.equal(fallo.titulo, 'Handy rechazó la conexión');
    assert.equal(fallo.reintentable, false);
  });

  it('sin red', () => {
    assert.equal(falloSincronizacion({ sinRed: true }).titulo, 'Sin conexión');
  });
});
