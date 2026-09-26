/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { COLORES_FAMILIA, TONOS_COLOR_FAMILIA, colorFamiliaDesdeApi, esColorFamiliaValido } from './colores-familia.ts';
import { razonContraste } from './contraste.ts';
import { COLORES } from './tokens.ts';

const canales = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('colores de familia', () => {
  it('son exactamente 10', () => {
    assert.equal(COLORES_FAMILIA.length, 10);
  });

  for (const color of COLORES_FAMILIA) {
    const { solido, tinte, texto } = TONOS_COLOR_FAMILIA[color];

    it(`${color}: texto sobre tinte ≥ 4.5:1`, () => {
      assert.ok(razonContraste(texto, tinte) >= 4.5);
    });

    it(`${color}: el punto se distingue del fondo de pantalla (≥ 3:1)`, () => {
      assert.ok(razonContraste(solido, COLORES.fondo) >= 3);
    });

    it(`${color}: el tinte es el sólido al 15 % sobre el fondo de pantalla`, () => {
      const fondo = canales(COLORES.fondo);
      assert.deepEqual(
        canales(tinte),
        canales(solido).map((c, i) => Math.round(c * 0.15 + fondo[i] * 0.85)),
      );
    });
  }

  it('es el mismo espejo que la paleta del backend', () => {
    const backend = readFileSync(
      new URL('../../../backend/src/modules/catalogo/domain/colores-familia.ts', import.meta.url),
      'utf8',
    );
    for (const color of COLORES_FAMILIA) {
      const { solido, tinte, texto } = TONOS_COLOR_FAMILIA[color];
      assert.ok(
        backend.includes(`${color}: { solido: '${solido}', tinte: '${tinte}', texto: '${texto}' }`),
        `${color} no coincide con el backend`,
      );
    }
  });

  it('valida solo claves de la paleta; lo desconocido se ve neutro', () => {
    assert.equal(esColorFamiliaValido('rojo'), true);
    assert.equal(esColorFamiliaValido('#FF0000'), false);
    assert.equal(colorFamiliaDesdeApi('amarillo'), null);
    assert.equal(colorFamiliaDesdeApi(null), null);
    assert.equal(colorFamiliaDesdeApi('cafe'), 'cafe');
  });
});
