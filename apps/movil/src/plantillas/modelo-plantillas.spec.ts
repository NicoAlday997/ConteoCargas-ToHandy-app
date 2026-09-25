/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlantillaDetalleApi, RutaConPlantillaApi } from '../api/plantillas.ts';
import { agruparCatalogo } from '../factores/modelo-factores.ts';
import {
  alternar,
  alternarVarios,
  errorNombre,
  familiasSelector,
  normalizarDetalle,
  normalizarLista,
  rutasRespectoA,
  textoRutas,
  todosMarcados,
} from './modelo-plantillas.ts';

describe('normalizarLista', () => {
  it('separa activas e inactivas, ordena por nombre y descarta filas sin id', () => {
    const lista = normalizarLista([
      { id: 'b', nombre: 'Refrescos', descripcion: null, activa: true, totalProductos: 63, rutas: [] },
      { id: 'c', nombre: 'Vieja', descripcion: ' ', activa: false, totalProductos: 3, rutas: null },
      { id: 'a', nombre: 'Dulces', descripcion: 'Ruta 6', activa: true, totalProductos: 73, rutas: [{ id: 'r6', nombre: 'Ruta 6', codigo: 'R6' }] },
      { id: null, nombre: 'Sin id', descripcion: null, activa: true, totalProductos: 0, rutas: [] },
    ]);
    assert.deepEqual(
      lista.activas.map((p) => p.nombre),
      ['Dulces', 'Refrescos'],
    );
    assert.deepEqual(
      lista.inactivas.map((p) => p.nombre),
      ['Vieja'],
    );
    assert.equal(lista.inactivas[0]?.descripcion, null);
    assert.deepEqual(lista.activas[0]?.rutas, [{ id: 'r6', nombre: 'Ruta 6' }]);
  });

  it('sin datos, listas vacías', () => {
    assert.deepEqual(normalizarLista(null), { activas: [], inactivas: [] });
  });
});

describe('normalizarDetalle', () => {
  const api: PlantillaDetalleApi = {
    id: 'pl',
    nombre: 'Refrescos',
    descripcion: null,
    activa: true,
    totalProductos: 99,
    rutas: [],
    familias: [
      {
        familia: 'REFRESCOS',
        productos: [
          { code: '1', nombre: 'PEPSI', familia: 'REFRESCOS', modalidadVenta: 'POR_PIEZA', piezasPorPaquete: 12, factorConfirmado: true, activo: true },
          { code: '2', nombre: 'VIEJO', familia: 'REFRESCOS', modalidadVenta: 'COMPLETO', piezasPorPaquete: null, factorConfirmado: false, activo: false },
          { code: '1', nombre: 'REPETIDO', familia: 'REFRESCOS', modalidadVenta: null, piezasPorPaquete: null, factorConfirmado: null, activo: null },
        ],
      },
      { familia: null, productos: [{ code: '3', nombre: 'CHICLE', familia: null, modalidadVenta: 'COMPLETO', piezasPorPaquete: null, factorConfirmado: true, activo: true }] },
      { familia: 'VACIA', productos: [] },
    ],
  };

  it('arma familias, marca empaque e inactivos, y cuenta lo que se ve', () => {
    const detalle = normalizarDetalle(api);
    assert.ok(detalle);
    assert.equal(detalle.totalProductos, 3);
    assert.deepEqual(
      detalle.familias.map((f) => [f.titulo, f.data.map((p) => p.code)]),
      [
        ['REFRESCOS', ['1', '2']],
        ['Sin familia', ['3']],
      ],
    );
    const [pepsi, viejo] = detalle.familias[0]!.data;
    assert.deepEqual(pepsi?.empaque, { modalidad: 'POR_PIEZA', piezas: 12 });
    // Sin confirmar no se muestra como si lo fuera.
    assert.equal(viejo?.empaque, null);
    assert.equal(viejo?.activo, false);
  });

  it('sin id, null', () => {
    assert.equal(normalizarDetalle({ ...api, id: null }), null);
  });
});

describe('selección', () => {
  it('alternar marca y desmarca sin mutar el conjunto original', () => {
    const original = new Set(['a']);
    assert.deepEqual([...alternar(original, 'b')], ['a', 'b']);
    assert.deepEqual([...alternar(original, 'a')], []);
    assert.deepEqual([...original], ['a']);
  });

  it('alternarVarios marca todos si falta alguno y los desmarca si ya estaban todos', () => {
    const parcial = alternarVarios(new Set(['a', 'x']), ['a', 'b']);
    assert.deepEqual([...parcial].sort(), ['a', 'b', 'x']);
    assert.ok(todosMarcados(parcial, ['a', 'b']));
    const ninguno = alternarVarios(parcial, ['a', 'b']);
    assert.deepEqual([...ninguno], ['x']);
    assert.equal(todosMarcados(new Set(), []), false);
  });
});

describe('familiasSelector', () => {
  const catalogo = agruparCatalogo([
    { code: '1', nombre: 'PEPSI 2L', familia: 'REFRESCOS', modalidadVenta: 'POR_PIEZA', piezasPorPaquete: 8, factorConfirmado: true, confirmadoPor: null, fechaConfirmacionFactor: null },
    { code: '2', nombre: 'PEPSI 600', familia: 'REFRESCOS', modalidadVenta: 'POR_PIEZA', piezasPorPaquete: 12, factorConfirmado: true, confirmadoPor: null, fechaConfirmacionFactor: null },
    { code: '3', nombre: 'CANELS c/70', familia: 'DULCES', modalidadVenta: 'COMPLETO', piezasPorPaquete: null, factorConfirmado: true, confirmadoPor: null, fechaConfirmacionFactor: null },
  ]);

  it('marca lo que ya está en la plantilla y solo ofrece el resto', () => {
    const familias = familiasSelector(catalogo, new Set(['1']), '');
    const refrescos = familias.find((f) => f.familia === 'REFRESCOS');
    assert.deepEqual(
      refrescos?.data.map((p) => [p.code, p.incluido]),
      [
        ['1', true],
        ['2', false],
      ],
    );
    assert.deepEqual(refrescos?.disponibles, ['2']);
  });

  it('busca por nombre sin importar mayúsculas y quita las familias sin coincidencias', () => {
    const familias = familiasSelector(catalogo, new Set(), 'pepsi 600');
    assert.deepEqual(
      familias.map((f) => [f.titulo, f.data.map((p) => p.code)]),
      [['REFRESCOS', ['2']]],
    );
  });
});

describe('rutasRespectoA', () => {
  const filas: RutaConPlantillaApi[] = [
    { id: 'r3', nombre: 'Ruta 3', codigo: 'R3', vendedores: [], plantillas: [], sinPlantilla: false },
    { id: 'r2', nombre: 'Ruta 2', codigo: 'R2', vendedores: ['Ana'], plantillas: [{ id: 'otra', nombre: 'Dulces' }], sinPlantilla: false },
    { id: 'r10', nombre: 'Ruta 10', codigo: 'R10', vendedores: ['Luis'], plantillas: [], sinPlantilla: true },
    { id: 'r1', nombre: 'Ruta 1', codigo: 'R1', vendedores: ['Irvin'], plantillas: [{ id: 'pl', nombre: 'Refrescos' }], sinPlantilla: false },
  ];

  it('primero las que la usan, luego las asignables y al final las sin vendedor', () => {
    const rutas = rutasRespectoA(filas, 'pl');
    assert.deepEqual(
      rutas.map((r) => [r.id, r.usaEsta, r.asignable]),
      [
        ['r1', true, true],
        ['r2', false, true],
        ['r10', false, true],
        ['r3', false, false],
      ],
    );
    assert.equal(rutas[1]?.actual, 'Usa Dulces');
    assert.equal(rutas[2]?.actual, 'Sin plantilla: ve todo el catálogo');
    assert.equal(rutas[3]?.actual, 'Sin vendedor asignado');
  });

  it('una ruta con un vendedor aún sin plantilla no cuenta como que ya la usa', () => {
    const [ruta] = rutasRespectoA(
      [{ id: 'r1', nombre: 'Ruta 1', codigo: 'R1', vendedores: ['A', 'B'], plantillas: [{ id: 'pl', nombre: 'Refrescos' }], sinPlantilla: true }],
      'pl',
    );
    assert.equal(ruta?.usaEsta, false);
    assert.equal(ruta?.actual, 'Usa Refrescos (un vendedor sin plantilla)');
  });
});

describe('textos', () => {
  it('textoRutas', () => {
    assert.equal(textoRutas([]), 'Ninguna ruta la usa');
    assert.equal(
      textoRutas([
        { id: '1', nombre: 'Ruta 1' },
        { id: '2', nombre: 'Ruta 2' },
      ]),
      'Ruta 1, Ruta 2',
    );
  });

  it('errorNombre', () => {
    assert.equal(errorNombre('  '), 'Escribe un nombre.');
    assert.equal(errorNombre('x'.repeat(81)), 'Máximo 80 caracteres.');
    assert.equal(errorNombre(' Dulces '), null);
  });
});
