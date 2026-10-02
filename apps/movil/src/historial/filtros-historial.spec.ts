/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  atajosFechas,
  cerrarRango,
  cuantosFiltros,
  dentroDeRango,
  diaMinimo,
  etiquetaVendedor,
  explicarSinResultados,
  FILTROS_VACIOS,
  normalizarVendedores,
  parametrosHistorial,
  quitarFiltro,
  textoFechas,
  tocarDia,
  type FiltrosHistorial,
} from './filtros-historial.ts';

const IRVIN = { id: 'v1', nombre: 'Irvin Pérez', activo: false };
const RUTA_3 = { id: 'r3', nombre: 'Ruta 3', activa: true };

describe('parametrosHistorial', () => {
  it('sin filtros no manda nada', () => {
    assert.equal(parametrosHistorial(FILTROS_VACIOS), '');
  });

  it('manda cada filtro puesto con el nombre que espera el servidor', () => {
    const filtros: FiltrosHistorial = {
      vendedor: IRVIN,
      ruta: RUTA_3,
      desde: '2026-09-01',
      hasta: '2026-09-15',
      estado: 'CANCELADA',
    };
    assert.equal(
      parametrosHistorial(filtros),
      'vendedorUsuarioAppId=v1&rutaId=r3&fechaInicio=2026-09-01&fechaFin=2026-09-15&estado=CANCELADA',
    );
  });
});

describe('cuantosFiltros y quitarFiltro', () => {
  it('las dos fechas cuentan como un solo filtro y se quitan juntas', () => {
    const filtros = {
      ...FILTROS_VACIOS,
      desde: '2026-09-01',
      hasta: '2026-09-15',
      ruta: RUTA_3,
    };
    assert.equal(cuantosFiltros(filtros), 2);
    const sinFechas = quitarFiltro(filtros, 'fechas');
    assert.equal(sinFechas.desde, null);
    assert.equal(sinFechas.hasta, null);
    assert.equal(sinFechas.ruta, RUTA_3);
  });
});

describe('textos', () => {
  it('marca al vendedor inactivo sin esconderlo', () => {
    assert.equal(etiquetaVendedor(IRVIN), 'Irvin Pérez · inactivo');
    assert.equal(etiquetaVendedor({ ...IRVIN, activo: true }), 'Irvin Pérez');
  });

  it('dice el rango de fechas corto', () => {
    assert.equal(textoFechas('2026-09-24', '2026-09-24'), '24 sep');
    assert.equal(textoFechas('2026-09-01', '2026-09-15'), '1–15 sep');
    assert.equal(textoFechas('2026-08-28', '2026-09-03'), '28 ago – 3 sep');
    assert.equal(textoFechas('2026-09-03', null), 'Desde 3 sep');
    assert.equal(textoFechas(null, null), null);
  });

  it('explica por qué no hubo resultados con los filtros puestos', () => {
    assert.equal(
      explicarSinResultados({
        vendedor: IRVIN,
        ruta: RUTA_3,
        desde: '2026-09-01',
        hasta: '2026-09-15',
        estado: 'CANCELADA',
      }),
      'No hay cargas de Irvin Pérez, en Ruta 3, del 1–15 sep, en estado Cancelada.',
    );
  });
});

describe('rango de fechas', () => {
  it('dos toques marcan inicio y fin; si el segundo es anterior se voltean', () => {
    const inicio = tocarDia({ desde: null, hasta: null }, '2026-09-10');
    assert.deepEqual(inicio, { desde: '2026-09-10', hasta: null });
    assert.deepEqual(tocarDia(inicio, '2026-09-15'), {
      desde: '2026-09-10',
      hasta: '2026-09-15',
    });
    assert.deepEqual(tocarDia(inicio, '2026-09-02'), {
      desde: '2026-09-02',
      hasta: '2026-09-10',
    });
  });

  it('un tercer toque empieza otro rango', () => {
    assert.deepEqual(
      tocarDia({ desde: '2026-09-01', hasta: '2026-09-05' }, '2026-09-20'),
      { desde: '2026-09-20', hasta: null },
    );
  });

  it('un rango a medio elegir se aplica como un solo día', () => {
    assert.deepEqual(cerrarRango({ desde: '2026-09-10', hasta: null }), {
      desde: '2026-09-10',
      hasta: '2026-09-10',
    });
    assert.equal(
      dentroDeRango({ desde: '2026-09-10', hasta: null }, '2026-09-10'),
      true,
    );
    assert.equal(
      dentroDeRango({ desde: '2026-09-10', hasta: '2026-09-12' }, '2026-09-13'),
      false,
    );
  });

  it('vendedor y contador no pueden elegir más atrás de 2 semanas; el supervisor sí', () => {
    assert.equal(diaMinimo('VENDEDOR', '2026-09-23'), '2026-09-09');
    assert.equal(diaMinimo('CONTADOR', '2026-09-23'), '2026-09-09');
    assert.equal(diaMinimo('SUPERVISOR', '2026-09-23'), null);
  });

  it('los atajos de mes solo los ve el supervisor', () => {
    assert.deepEqual(
      atajosFechas('CONTADOR', '2026-09-23').map((a) => a.etiqueta),
      ['Hoy', 'Ayer', 'Últimos 7 días'],
    );
    const mesPasado = atajosFechas('SUPERVISOR', '2026-03-10').at(-1);
    assert.deepEqual(mesPasado, {
      etiqueta: 'Mes pasado',
      desde: '2026-02-01',
      hasta: '2026-02-28',
    });
  });
});

describe('normalizarVendedores', () => {
  it('descarta lo que no se puede elegir y conserva a los inactivos', () => {
    assert.deepEqual(
      normalizarVendedores([
        { id: 'v1', nombreCompleto: 'Irvin Pérez', activo: false },
        { id: null, nombreCompleto: 'Sin id', activo: true },
        { id: 'v3', nombreCompleto: '  ', activo: true },
      ]),
      [IRVIN],
    );
  });
});
