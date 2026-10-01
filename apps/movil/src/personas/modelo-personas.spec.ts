/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CuentaHandyApi, UsuarioAdminApi } from '../api/personas.ts';
import {
  agruparPersonas,
  ayudaRol,
  cuentasLibres,
  cuerpoAlta,
  detalleGrupo,
  normalizarPersonas,
  textoPinUnaVez,
  validarAlta,
} from './modelo-personas.ts';

function usuario(over: Partial<UsuarioAdminApi>): UsuarioAdminApi {
  return { id: 'u', nombreCompleto: 'X', rolApp: 'VENDEDOR', usuarioHandyId: null, activo: true, debeCambiarPin: false, ...over };
}

function cuenta(over: Partial<CuentaHandyApi>): CuentaHandyApi {
  return { idHandy: 1, nombre: 'Ruta', fotoUrl: null, activa: true, vinculadaA: null, ...over };
}

describe('normalizarPersonas', () => {
  it('pega la foto de la cuenta de Handy del vendedor', () => {
    const [p] = normalizarPersonas(
      [usuario({ id: 'a', nombreCompleto: 'Ana', usuarioHandyId: 7 })],
      [cuenta({ idHandy: 7, fotoUrl: 'https://f/7.jpg' })],
    );
    assert.equal(p.fotoUrl, 'https://f/7.jpg');
  });

  it('descarta renglones sin id, nombre o rol', () => {
    const personas = normalizarPersonas(
      [usuario({ id: null }), usuario({ id: 'b', nombreCompleto: '  ' }), usuario({ id: 'c', rolApp: null }), usuario({ id: 'd' })],
      null,
    );
    assert.deepEqual(
      personas.map((p) => p.id),
      ['d'],
    );
  });
});

describe('agruparPersonas', () => {
  const personas = normalizarPersonas(
    [
      usuario({ id: '1', nombreCompleto: 'Saúl', rolApp: 'SUPERVISOR' }),
      usuario({ id: '2', nombreCompleto: 'Zoe', rolApp: 'VENDEDOR' }),
      usuario({ id: '3', nombreCompleto: 'Beto', rolApp: 'VENDEDOR', activo: false }),
      usuario({ id: '4', nombreCompleto: 'Ana', rolApp: 'VENDEDOR' }),
    ],
    null,
  );

  it('vendedores, contadores, supervisores; solo los grupos con alguien', () => {
    assert.deepEqual(
      agruparPersonas(personas).map((g) => g.titulo),
      ['Vendedores', 'Supervisores'],
    );
  });

  it('por nombre, con los inactivos al final del grupo', () => {
    assert.deepEqual(
      agruparPersonas(personas)[0].personas.map((p) => p.nombre),
      ['Ana', 'Zoe', 'Beto'],
    );
  });

  it('el detalle cuenta a los inactivos', () => {
    assert.equal(detalleGrupo(agruparPersonas(personas)[0].personas), '3 personas · 1 inactiva');
    assert.equal(detalleGrupo(agruparPersonas(personas)[1].personas), '1 persona');
  });
});

describe('cuentasLibres', () => {
  it('no ofrece las ocupadas por un usuario activo ni las deshabilitadas en Handy', () => {
    const libres = cuentasLibres([
      cuenta({ idHandy: 1, nombre: 'Ruta 3' }),
      cuenta({ idHandy: 2, nombre: 'Ruta 1', vinculadaA: { id: 'u', nombreCompleto: 'Ana' } }),
      cuenta({ idHandy: 3, nombre: 'Ruta 2', activa: false }),
      cuenta({ idHandy: 4, nombre: 'Ruta 0' }),
    ]);
    assert.deepEqual(
      libres.map((c) => c.idHandy),
      [4, 1],
    );
  });

  it('sin cuentas: lista vacía', () => {
    assert.deepEqual(cuentasLibres(null), []);
  });
});

describe('alta', () => {
  it('la línea de ayuda cambia con el rol', () => {
    assert.equal(ayudaRol('VENDEDOR'), 'Elige su cuenta de Handy. Es la ruta que va a recibir.');
    assert.equal(ayudaRol('CONTADOR'), 'No necesita cuenta en Handy: solo usa esta app.');
    assert.equal(ayudaRol('SUPERVISOR'), 'No necesita cuenta en Handy: solo usa esta app.');
  });

  it('un vendedor sin cuenta no se puede guardar; un contador sí', () => {
    assert.equal(validarAlta({ nombre: 'Ana', rol: 'VENDEDOR', cuentaId: null }).cuenta, 'Elige la cuenta de Handy del vendedor.');
    assert.equal(validarAlta({ nombre: 'Ana', rol: 'CONTADOR', cuentaId: null }).cuenta, null);
  });

  it('nombre y rol obligatorios', () => {
    const errores = validarAlta({ nombre: '  ', rol: null, cuentaId: null });
    assert.ok(errores.nombre);
    assert.ok(errores.rol);
  });

  it('solo el vendedor viaja con cuenta de Handy, aunque se haya elegido una antes de cambiar el rol', () => {
    assert.deepEqual(cuerpoAlta({ nombre: ' Ana ', rol: 'VENDEDOR', cuentaId: 9 }), {
      nombreCompleto: 'Ana',
      rolApp: 'VENDEDOR',
      usuarioHandyId: 9,
    });
    assert.deepEqual(cuerpoAlta({ nombre: 'Luis', rol: 'CONTADOR', cuentaId: 9 }), { nombreCompleto: 'Luis', rolApp: 'CONTADOR' });
  });

  it('el aviso del PIN lleva el nombre', () => {
    assert.equal(
      textoPinUnaVez('Ana López'),
      'Este PIN se muestra una sola vez. Dáselo a Ana López; la primera vez que entre, la app le va a pedir que ponga el suyo.',
    );
  });
});
