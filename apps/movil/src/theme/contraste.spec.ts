/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { razonContraste } from './contraste.ts';
import {
  COLORES,
  DATO,
  ESPACIADO,
  ETIQUETA_DATO,
  FUENTE,
  RITMO,
  ROTULO,
  TIPOGRAFIA,
  TONOS,
  TOQUE_MINIMO,
  type ClaveColor,
  type PesoFuente,
} from './tokens.ts';

/** Bodega con poca luz: AA normal para todo texto. */
const MINIMO_TEXTO = 4.5;
/** Texto grande (≥ 18.66 px negrita) y gráficos: WCAG 1.4.3 / 1.4.11. */
const MINIMO_GRANDE = 3;

function comprobar(pares: [string, ClaveColor | string, ClaveColor | string][], minimo: number) {
  for (const [donde, a, b] of pares) {
    const colorA = a in COLORES ? COLORES[a as ClaveColor] : a;
    const colorB = b in COLORES ? COLORES[b as ClaveColor] : b;
    it(`${donde}: ${a} sobre ${b} ≥ ${minimo}:1`, () => {
      assert.ok(razonContraste(colorA, colorB) >= minimo, `${razonContraste(colorA, colorB).toFixed(2)}:1`);
    });
  }
}

describe('contraste: texto general', () => {
  comprobar(
    [
      ['texto sobre el fondo de pantalla', 'texto', 'fondo'],
      ['texto sobre tarjeta', 'texto', 'superficie'],
      ['texto sobre campo en reposo', 'texto', 'superficieHonda'],
      ['secundario sobre el fondo de pantalla ("Faltan 10 productos")', 'textoSecundario', 'fondo'],
      ['secundario sobre tarjeta', 'textoSecundario', 'superficie'],
      ['secundario sobre pastilla neutra', 'textoSecundario', 'superficieHonda'],
      ['error como texto ("Cerrar sesión")', 'error', 'superficie'],
      ['botón destructivo de contorno', 'error', 'superficie'],
      ['antetítulo del login', 'marca', 'fondo'],
      ['texto de "Finalizar" listo (blanco con texto azul)', 'marca', 'superficie'],
    ],
    MINIMO_TEXTO,
  );
});

describe('contraste: encabezado azul', () => {
  comprobar(
    [
      ['título', 'textoSobreColor', 'marca'],
      ['subtítulo y "de 14"', 'marcaTenue', 'marca'],
      ['avance y "Al día" en el panel', 'textoSobreColor', 'marcaHonda'],
      ['"de 14" y Finalizar deshabilitado en el panel', 'marcaTenue', 'marcaHonda'],
      ['botón principal', 'textoSobreColor', 'marca'],
    ],
    MINIMO_TEXTO,
  );
  comprobar([['relleno de la barra de progreso sobre su canal', 'capturado', 'marcaProfunda']], MINIMO_GRANDE);
});

describe('contraste: filas de conteo', () => {
  comprobar(
    [
      ['FALTA: nombre', 'texto', 'superficie'],
      ['FALTA: pastilla del factor', 'discrepanciaTexto', 'discrepanciaFondo'],
      ['CONTADO: nombre', 'texto', 'capturadoFondo'],
      ['CONTADO: pastilla del factor', 'textoSobreColor', 'capturadoHondo'],
      ['CONTADO: número en el campo blanco', 'texto', 'superficie'],
      ['NO LLEVA: pastilla "NO LLEVA" en blanco', 'pendiente', 'superficie'],
      ['NO LLEVA: 0 relleno', 'textoSobreColor', 'pendiente'],
      ['TECLEANDO: nombre', 'textoSobreColor', 'marca'],
      ['TECLEANDO: campo activo', 'texto', 'superficie'],
      ['TECLEANDO: campo inactivo', 'textoSobreColor', 'marcaHonda'],
      ['aviso ámbar', 'discrepanciaTexto', 'discrepanciaFondo'],
      ['aviso de rechazo', 'errorTexto', 'errorFondo'],
    ],
    MINIMO_TEXTO,
  );
  // Total de 33 px negrita: texto grande.
  comprobar(
    [
      ['FALTA: total (33 px negrita)', 'discrepanciaHonda', 'superficie'],
      ['CONTADO: total (33 px negrita)', 'capturadoHondo', 'capturadoFondo'],
      ['NO LLEVA: total (33 px negrita)', 'pendiente', 'pendienteFondo'],
      ['TECLEANDO: total (33 px negrita)', 'textoSobreColor', 'marca'],
    ],
    MINIMO_GRANDE,
  );
  // Bordes de la fila: gráficos.
  comprobar(
    [
      ['botón 0: contorno', 'borde', 'superficie'],
      ['chevron sobre tarjeta', 'textoTerciario', 'superficie'],
    ],
    MINIMO_GRANDE,
  );
});

/**
 * Pares de la paleta aprobada que NO llegan a 4.5:1 como texto chico. Son
 * decisiones de diseño tomadas a sabiendas (docs/06 §1): quedan aquí con su
 * umbral real para que un cambio que los empeore falle, y para que nadie los
 * use en otro lugar creyendo que cumplen AA.
 */
describe('contraste: excepciones documentadas de la paleta', () => {
  const EXCEPCIONES: [string, ClaveColor, ClaveColor, number][] = [
    // 3.10:1. Rótulos de 12 px ("Contó", "Productos"): solo sobre tarjeta blanca, nunca sobre el fondo de pantalla (2.72:1).
    ['rótulo terciario sobre tarjeta', 'textoTerciario', 'superficie', 3.1],
    // 3.90:1. Nombre y rótulos de la fila "no lleva": se retira a propósito.
    ['texto de la fila "no lleva"', 'pendiente', 'pendienteFondo', 3.9],
    // 4.28:1. Pastilla "Completa" del encabezado de familia (13 px seminegrita) y unidad del total contado.
    ['pastilla "Completa"', 'capturadoHondo', 'capturadoFondo', 4.28],
    // 1.88:1. Borde ámbar de la fila FALTA: la fila se distingue por su fondo blanco sobre el fondo de pantalla; el borde refuerza.
    ['borde de la fila FALTA', 'discrepancia', 'fondo', 1.88],
    // 2.18:1. Borde turquesa de la fila CONTADO: igual, la fila se distingue por su fondo tintado.
    ['borde de la fila CONTADO', 'capturado', 'fondo', 2.18],
    // 4.51:1 justo: subtítulo de 12 px del encabezado azul.
    ['subtítulo sobre azul', 'marcaTenue', 'marca', 4.5],
  ];
  for (const [donde, texto, fondo, minimo] of EXCEPCIONES) {
    it(`${donde}: ${texto} sobre ${fondo} se mantiene ≥ ${minimo}:1`, () => {
      assert.ok(razonContraste(COLORES[texto], COLORES[fondo]) >= minimo - 0.005);
    });
  }

  it('el rótulo terciario NO se usa sobre el fondo de pantalla (no llega ni a 3:1)', () => {
    assert.ok(razonContraste(COLORES.textoTerciario, COLORES.fondo) < MINIMO_GRANDE);
  });
});

describe('contraste: pastillas de estado (tinte + texto hondo)', () => {
  for (const [nombre, tono] of Object.entries(TONOS)) {
    it(`${nombre}.texto sobre ${nombre}.fondo ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(razonContraste(tono.texto, tono.fondo) >= MINIMO_TEXTO);
    });
    it(`textoSobreColor sobre ${nombre}.solido ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(razonContraste(COLORES.textoSobreColor, tono.solido) >= MINIMO_TEXTO);
    });
    it(`texto general sobre ${nombre}.fondo ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(razonContraste(COLORES.texto, tono.fondo) >= MINIMO_TEXTO);
    });
  }
});

describe('razonContraste', () => {
  it('negro sobre blanco es 21:1', () => {
    assert.equal(Math.round(razonContraste('#000000', '#FFFFFF')), 21);
  });

  it('no depende del orden', () => {
    assert.equal(razonContraste('#13172A', '#FFFFFF'), razonContraste('#FFFFFF', '#13172A'));
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
});

describe('tipografía', () => {
  const PESO: Record<string, number> = {
    [FUENTE.regular]: 400,
    [FUENTE.medio]: 500,
    [FUENTE.semiNegrita]: 600,
    [FUENTE.negrita]: 700,
  };

  it('cada nivel lleva una familia de FUENTE (con fuente propia fontWeight no aplica)', () => {
    const familias = new Set<string>(Object.values(FUENTE));
    for (const [nivel, estilo] of Object.entries(TIPOGRAFIA)) {
      assert.ok(familias.has(estilo.fontFamily), nivel);
      assert.ok(!('fontWeight' in estilo), `${nivel} no debe llevar fontWeight`);
    }
  });

  it('FUENTE tiene exactamente los cuatro pesos que se cargan', () => {
    assert.deepEqual(Object.keys(FUENTE).sort(), (['medio', 'negrita', 'regular', 'semiNegrita'] satisfies PesoFuente[]).sort());
  });

  it('el dato es más grande y pesa más que su rótulo', () => {
    assert.ok(DATO.fontSize > ETIQUETA_DATO.fontSize && DATO.fontSize > ROTULO.fontSize);
    assert.ok(PESO[DATO.fontFamily] - PESO[ETIQUETA_DATO.fontFamily] >= 200);
  });

  it('el total de la fila es 33 px negrita y el número del campo 21 px', () => {
    assert.equal(TIPOGRAFIA.total.fontSize, 33);
    assert.equal(TIPOGRAFIA.total.fontFamily, FUENTE.negrita);
    assert.equal(TIPOGRAFIA.campo.fontSize, 21);
    assert.equal(ROTULO.fontSize, 9);
  });
});
