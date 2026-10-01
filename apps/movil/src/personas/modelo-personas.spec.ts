/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CuentaHandyApi, UsuarioAdminApi } from '../api/personas.ts';
import {
  agruparPersonas,
  ayudaRol,
  bloqueoVigente,
  cuentasLibres,
  cuerpoAlta,
  detalleAvisoBloqueados,
  detalleGrupo,
  hayUnSoloSupervisor,
  minutosRestantes,
  normalizarPersonas,
  personasBloqueadas,
  textoBloqueo,
  textoInicioBloqueo,
  textoPinUnaVez,
  tituloAvisoBloqueados,
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

describe('bloqueo por intentos fallidos', () => {
  const AHORA = Date.parse('2026-10-01T12:00:00Z'); // 06:00 en Ciudad de México
  const bloqueado = (hastaIso: string, over: Partial<UsuarioAdminApi> = {}) =>
    usuario({ id: over.id ?? 'b', nombreCompleto: over.nombreCompleto ?? 'Bea', bloqueo: { desde: '2026-10-01T11:57:00Z', hasta: hastaIso }, ...over });

  it('lee el bloqueo del servidor; sin él, o con fechas inválidas, queda null', () => {
    const [con, sin, roto] = normalizarPersonas(
      [bloqueado('2026-10-01T12:12:00Z'), usuario({ id: 's', bloqueo: null }), usuario({ id: 'r', bloqueo: { desde: 'x', hasta: null } })],
      null,
    );
    assert.deepEqual(con.bloqueo, { desde: new Date('2026-10-01T11:57:00Z'), hasta: new Date('2026-10-01T12:12:00Z') });
    assert.equal(sin.bloqueo, null);
    assert.equal(roto.bloqueo, null);
  });

  it('«Bloqueado · 12 min», redondeando hacia arriba y nunca 0', () => {
    const [p] = normalizarPersonas([bloqueado('2026-10-01T12:11:30Z')], null);
    const b = bloqueoVigente(p, AHORA);
    assert.ok(b);
    assert.equal(textoBloqueo(b, AHORA), 'Bloqueado · 12 min');
    assert.equal(minutosRestantes(b, Date.parse('2026-10-01T12:11:10Z')), 1);
  });

  it('un bloqueo que vence con la pantalla abierta deja de contar', () => {
    const [p] = normalizarPersonas([bloqueado('2026-10-01T12:05:00Z')], null);
    assert.ok(bloqueoVigente(p, AHORA));
    assert.equal(bloqueoVigente(p, Date.parse('2026-10-01T12:05:00Z')), null);
  });

  it('un inactivo no se muestra bloqueado: no puede entrar de todos modos', () => {
    const [p] = normalizarPersonas([bloqueado('2026-10-01T12:12:00Z', { activo: false })], null);
    assert.equal(bloqueoVigente(p, AHORA), null);
  });

  it('cuándo se bloqueó, en la hora del negocio', () => {
    const [p] = normalizarPersonas([bloqueado('2026-10-01T12:12:00Z')], null);
    assert.ok(p.bloqueo);
    assert.equal(textoInicioBloqueo(p.bloqueo, AHORA), 'Hoy, 05:57');
    assert.equal(textoInicioBloqueo(p.bloqueo, Date.parse('2026-10-02T12:00:00Z')), 'Jueves 1 de octubre, 05:57');
  });

  it('personasBloqueadas: solo las vigentes, la que más le falta primero', () => {
    const personas = normalizarPersonas(
      [
        bloqueado('2026-10-01T12:03:00Z', { id: 'a', nombreCompleto: 'Ana' }),
        bloqueado('2026-10-01T11:59:00Z', { id: 'v', nombreCompleto: 'Vencido' }),
        bloqueado('2026-10-01T12:14:00Z', { id: 'c', nombreCompleto: 'Carlos' }),
        usuario({ id: 'l', nombreCompleto: 'Libre' }),
      ],
      null,
    );
    assert.deepEqual(
      personasBloqueadas(personas, AHORA).map((p) => p.nombre),
      ['Carlos', 'Ana'],
    );
  });

  it('el aviso del inicio: con una persona dice quién y cuánto falta', () => {
    const una = normalizarPersonas([bloqueado('2026-10-01T12:12:00Z', { nombreCompleto: 'Carlos Ruiz' })], null);
    assert.equal(tituloAvisoBloqueados(una), 'Carlos Ruiz no puede entrar');
    assert.match(detalleAvisoBloqueados(una, AHORA), /faltan 12 min/);
    const dos = normalizarPersonas([bloqueado('2026-10-01T12:12:00Z', { id: '1' }), bloqueado('2026-10-01T12:10:00Z', { id: '2' })], null);
    assert.equal(tituloAvisoBloqueados(dos), '2 personas no pueden entrar');
  });
});

describe('hayUnSoloSupervisor', () => {
  const sup = (id: string, activo = true) => usuario({ id, rolApp: 'SUPERVISOR', activo });

  it('true con exactamente un supervisor activo, aunque haya inactivos', () => {
    assert.equal(hayUnSoloSupervisor(normalizarPersonas([sup('1'), sup('2', false), usuario({ id: 'v' })], null)), true);
  });

  it('false con dos activos', () => {
    assert.equal(hayUnSoloSupervisor(normalizarPersonas([sup('1'), sup('2')], null)), false);
  });

  it('false sin ningún supervisor activo (no hay a quién avisarle)', () => {
    assert.equal(hayUnSoloSupervisor(normalizarPersonas([sup('1', false)], null)), false);
  });
});
