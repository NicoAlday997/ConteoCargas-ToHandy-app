/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { razonContraste } from './contraste.ts';
import { COLORES, DATO, ESPACIADO, RITMO, ROTULO, TIPOGRAFIA, TONOS, TOQUE_MINIMO, type ClaveColor } from './tokens.ts';

/** Bodega con poca luz: nada de texto por debajo de AA normal. */
const MINIMO_TEXTO = 4.5;
/** Contorno de controles y tarjetas (WCAG 1.4.11). */
const MINIMO_CONTORNO = 3;

const TEXTOS: ClaveColor[] = [
  'texto',
  'textoSecundario',
  'marca',
  'marcaOscuro',
  'capturado',
  'pendiente',
  'discrepancia',
  'error',
];
const FONDOS_CLAROS: ClaveColor[] = ['fondoPantalla', 'fondo', 'superficie'];
/** Fondos sobre los que va `textoSobreColor`: botones, etiquetas, bandas y estados presionados. */
const FONDOS_OSCUROS: ClaveColor[] = [
  'texto',
  'textoSecundario',
  'marca',
  'marcaOscuro',
  'capturado',
  'pendiente',
  'discrepancia',
  'error',
];
/** Contornos de controles también sobre los fondos tintados (filas capturadas, en cero). */
const FONDOS_CONTORNO: ClaveColor[] = [...FONDOS_CLAROS, 'capturadoFondo', 'pendienteFondo', 'discrepanciaFondo'];

describe('contraste de los tokens', () => {
  for (const texto of TEXTOS) {
    for (const fondo of FONDOS_CLAROS) {
      it(`${texto} sobre ${fondo} ≥ ${MINIMO_TEXTO}:1`, () => {
        assert.ok(razonContraste(COLORES[texto], COLORES[fondo]) >= MINIMO_TEXTO);
      });
    }
  }

  for (const fondo of FONDOS_OSCUROS) {
    it(`textoSobreColor sobre ${fondo} ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(razonContraste(COLORES.textoSobreColor, COLORES[fondo]) >= MINIMO_TEXTO);
    });
  }

  // Dentro de un bloque tintado van su texto oscuro y el texto general.
  for (const [nombre, tono] of Object.entries(TONOS)) {
    for (const [clave, color] of [
      [`${nombre}.texto`, tono.texto],
      ['texto', COLORES.texto],
      ['textoSecundario', COLORES.textoSecundario],
    ]) {
      it(`${clave} sobre ${nombre}.fondo ≥ ${MINIMO_TEXTO}:1`, () => {
        assert.ok(razonContraste(color, tono.fondo) >= MINIMO_TEXTO);
      });
    }
  }

  // El estado en la primera línea de una tarjeta blanca (punto y nombre en su color).
  for (const [nombre, tono] of Object.entries(TONOS)) {
    for (const fondo of FONDOS_CLAROS) {
      it(`${nombre}.texto sobre ${fondo} ≥ ${MINIMO_TEXTO}:1`, () => {
        assert.ok(razonContraste(tono.texto, COLORES[fondo]) >= MINIMO_TEXTO);
      });
    }
  }

  it(`marcaClaro sobre marca ≥ ${MINIMO_TEXTO}:1 (texto secundario de un encabezado de marca)`, () => {
    assert.ok(razonContraste(COLORES.marcaClaro, COLORES.marca) >= MINIMO_TEXTO);
  });

  for (const fondo of FONDOS_CONTORNO) {
    it(`borde sobre ${fondo} ≥ ${MINIMO_CONTORNO}:1`, () => {
      assert.ok(razonContraste(COLORES.borde, COLORES[fondo]) >= MINIMO_CONTORNO);
    });
  }
});

describe('razonContraste', () => {
  it('negro sobre blanco es 21:1', () => {
    assert.equal(Math.round(razonContraste('#000000', '#FFFFFF')), 21);
  });

  it('no depende del orden', () => {
    assert.equal(razonContraste('#0F172A', '#FFFFFF'), razonContraste('#FFFFFF', '#0F172A'));
  });
});

describe('ritmo de espaciado', () => {
  for (const [nombre, valor] of Object.entries({ ...ESPACIADO, ...RITMO, TOQUE_MINIMO })) {
    it(`${nombre} (${valor}) cae en la rejilla de 4`, () => {
      assert.equal(valor % 4, 0);
    });
  }

  it('más aire entre secciones que entre grupos, entre grupos que entre hermanos, y entre hermanos que dentro de uno', () => {
    assert.ok(RITMO.seccion > RITMO.grupo && RITMO.grupo > RITMO.relacionado && RITMO.relacionado > RITMO.interno);
  });

  it('entre grupos hay al menos el cuádruple de aire que dentro: el ojo agrupa solo', () => {
    assert.ok(RITMO.grupo >= RITMO.interno * 4);
  });
});

describe('jerarquía rótulo / dato', () => {
  const niveles = Object.values(TIPOGRAFIA)
    .map((t) => t.fontSize)
    .sort((a, b) => a - b);

  it('el dato está al menos dos niveles de la escala por encima del rótulo', () => {
    assert.ok(niveles.indexOf(DATO.fontSize) - niveles.indexOf(ROTULO.fontSize) >= 2);
  });

  it('el dato pesa más que el rótulo', () => {
    assert.ok(Number(DATO.fontWeight) - Number(ROTULO.fontWeight) >= 200);
  });

  it(`el rótulo, aunque se retira, cumple ${MINIMO_TEXTO}:1 sobre todos los fondos claros`, () => {
    for (const fondo of FONDOS_CLAROS) {
      assert.ok(razonContraste(ROTULO.color, COLORES[fondo]) >= MINIMO_TEXTO);
    }
  });
});
