/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CargaHistorialApi, ProductoConsolidadoApi } from '../api/historial.ts';
import { agruparPorDia, normalizarDetalle } from './modelo-historial.ts';

function fila(id: string, fechaOperativa: string | null, extra: Partial<CargaHistorialApi> = {}): CargaHistorialApi {
  return {
    id,
    rutaNombre: 'Ruta 1',
    tipo: 'INICIAL',
    estado: 'ENVIADA',
    fechaOperativa,
    fechaConteo: null,
    vendedorNombre: 'Ana',
    contadorNombre: 'Luis',
    totalProductos: 40,
    productosConDiscrepancia: 0,
    autorizada: false,
    autorizadaPorNombre: null,
    ...extra,
  };
}

function producto(code: string, extra: Partial<ProductoConsolidadoApi> = {}): ProductoConsolidadoApi {
  return {
    productoCode: code,
    nombre: `Producto ${code}`,
    unidadCode: 'PZA',
    unidadDescripcion: 'Pieza',
    familia: 'Dulces',
    modalidadVenta: 'POR_PIEZA',
    piezasPorPaquete: 12,
    factorConfirmado: true,
    cantidadFinal: 24,
    tuvoDiscrepancia: false,
    cantidadVendedor: null,
    cantidadContador: null,
    capturadaPorNombre: null,
    confirmadaPorNombre: null,
    ...extra,
  };
}

describe('agruparPorDia', () => {
  it('agrupa por fecha operativa del día más reciente al más viejo', () => {
    const grupos = agruparPorDia([
      [fila('a', '2026-09-24T06:00:00.000Z'), fila('b', '2026-09-22T06:00:00.000Z')],
      [fila('c', '2026-09-24T06:00:00.000Z', { tipo: 'RECARGA' })],
    ]);
    assert.deepEqual(
      grupos.map((g) => [g.dia, g.data.map((f) => f.id)]),
      [
        ['2026-09-24', ['a', 'c']],
        ['2026-09-22', ['b']],
      ],
    );
  });

  it('una fila repetida entre páginas cuenta una vez; sin id se descarta', () => {
    const grupos = agruparPorDia([
      [fila('a', '2026-09-24T06:00:00.000Z')],
      [fila('a', '2026-09-24T06:00:00.000Z'), fila('', '2026-09-24T06:00:00.000Z')],
    ]);
    assert.equal(grupos[0].data.length, 1);
  });

  it('las cargas sin fecha van al final', () => {
    const grupos = agruparPorDia([[fila('x', null), fila('a', '2026-09-20T06:00:00.000Z')]]);
    assert.deepEqual(
      grupos.map((g) => g.dia),
      ['2026-09-20', null],
    );
  });

  it('lleva el número de discrepancias', () => {
    const [grupo] = agruparPorDia([[fila('a', '2026-09-24T06:00:00.000Z', { productosConDiscrepancia: 3 })]]);
    assert.equal(grupo.data[0].discrepancias, 3);
  });
});

describe('normalizarDetalle', () => {
  it('cuenta productos y discrepancias por familia', () => {
    const detalle = normalizarDetalle({
      evento: {
        id: 'e1',
        rutaNombre: 'Ruta 1',
        tipo: 'INICIAL',
        estado: 'ENVIADA',
        fechaOperativa: '2026-09-24T06:00:00.000Z',
        fechaConteo: null,
        vendedorNombre: 'Ana',
        contadorNombre: 'Luis',
        autorizada: false,
        autorizadaPorNombre: null,
      },
      familias: [
        {
          familia: 'Dulces',
          productos: [
            producto('D1'),
            producto('D2', {
              tuvoDiscrepancia: true,
              cantidadVendedor: 24,
              cantidadContador: 25,
              capturadaPorNombre: 'Ana',
              confirmadaPorNombre: 'Luis',
            }),
          ],
        },
        { familia: 'Vacía', productos: [] },
      ],
    });

    assert.ok(detalle);
    assert.equal(detalle.evento.dia, '2026-09-24');
    assert.equal(detalle.totalProductos, 2);
    assert.equal(detalle.totalDiscrepancias, 1);
    assert.deepEqual(
      detalle.familias.map((f) => [f.familia, f.conDiscrepancia]),
      [['Dulces', 1]],
    );
    assert.deepEqual(detalle.familias[0].productos[1].discrepancia, {
      vendedor: 24,
      contador: 25,
      capturadaPor: 'Ana',
      confirmadaPor: 'Luis',
    });
  });

  it('suma las cantidades finales en piezas y cuenta aparte las que siguen sin resolver', () => {
    const detalle = normalizarDetalle({
      evento: {
        id: 'e1',
        rutaNombre: 'Ruta 1',
        tipo: 'INICIAL',
        estado: 'CONFLICTOS_PENDIENTES',
        fechaOperativa: null,
        fechaConteo: null,
        vendedorNombre: null,
        contadorNombre: null,
        autorizada: null,
        autorizadaPorNombre: null,
      },
      familias: [
        {
          familia: 'Dulces',
          productos: [
            producto('A', { cantidadFinal: 24 }),
            producto('B', { cantidadFinal: 0 }),
            producto('C', { cantidadFinal: null, tuvoDiscrepancia: true }),
          ],
        },
        { familia: 'Botanas', productos: [producto('D', { cantidadFinal: 100 })] },
      ],
    });
    assert.equal(detalle?.totalPiezas, 124);
    assert.equal(detalle?.sinResolver, 1);
  });

  it('sin familia cae en "Sin familia"', () => {
    const detalle = normalizarDetalle({
      evento: {
        id: 'e1',
        rutaNombre: null,
        tipo: null,
        estado: null,
        fechaOperativa: null,
        fechaConteo: null,
        vendedorNombre: null,
        contadorNombre: null,
        autorizada: null,
        autorizadaPorNombre: null,
      },
      familias: [{ familia: null, productos: [producto('X')] }],
    });
    assert.equal(detalle?.familias[0].familia, 'Sin familia');
  });

  it('sin evento no hay detalle', () => {
    assert.equal(normalizarDetalle(null), null);
    assert.equal(normalizarDetalle({ evento: null, familias: [] }), null);
  });
});
