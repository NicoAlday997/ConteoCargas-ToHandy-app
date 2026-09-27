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

/** Bodega con poca luz y calle a pleno sol: AA normal para todo texto. */
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
      ['rótulo terciario sobre tarjeta', 'textoTerciario', 'superficie'],
      ['rótulo terciario sobre el fondo de pantalla', 'textoTerciario', 'fondo'],
      ['texto del botón de peligro', 'errorTexto', 'superficie'],
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
      ['subtítulo, "de 14" y quién cuenta', 'marcaTenue', 'marca'],
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
      ['SIN CONTAR: nombre', 'texto', 'superficie'],
      ['SIN CONTAR: pastilla del factor', 'textoSecundario', 'superficieHonda'],
      ['CONTADO: nombre', 'texto', 'capturadoFondo'],
      ['CONTADO: pastilla del factor', 'textoSobreColor', 'capturadoHondo'],
      ['CONTADO: número en el campo blanco', 'texto', 'superficie'],
      ['NO LLEVA: nombre', 'pendiente', 'pendienteFondo'],
      ['NO LLEVA: 0 del botón', 'pendiente', 'superficie'],
      ['NO LLEVA: visor "0 · No lleva"', 'textoSobreColor', 'pendiente'],
      ['CONTADO: visor (lectura en blanco sobre turquesa hondo)', 'textoSobreColor', 'capturadoHondo'],
      ['CONTADO: palomita y "Completa"', 'capturadoHondo', 'capturadoFondo'],
      ['SIN CONTAR: rótulo "PIEZAS" del visor vacío', 'textoSecundario', 'superficie'],
      ['TECLEANDO: visor', 'textoSobreColor', 'marcaHonda'],
      ['TECLEANDO: nombre', 'textoSobreColor', 'marca'],
      ['TECLEANDO: campo activo', 'texto', 'superficie'],
      ['TECLEANDO: campo inactivo', 'textoSobreColor', 'marcaHonda'],
      ['aviso ámbar', 'discrepanciaTexto', 'discrepanciaFondo'],
      ['aviso de rechazo', 'errorTexto', 'errorFondo'],
    ],
    MINIMO_TEXTO,
  );
  // Total de 33 px negrita: texto grande.
  // Contornos y gráficos: 3:1 (WCAG 1.4.11).
  comprobar(
    [
      ['SIN CONTAR: "—" del visor vacío', 'textoTerciario', 'superficie'],
      ['botón 0: contorno', 'borde', 'superficie'],
      ['contorno de campo sobre el fondo de pantalla', 'borde', 'fondo'],
      ['chevron sobre tarjeta', 'textoTerciario', 'superficie'],
      ['contorno del visor CONTADO sobre la fila', 'capturadoHondo', 'capturadoFondo'],
    ],
    MINIMO_GRANDE,
  );
});

/**
 * Pares que NO llegan a 3:1 y se aceptan a sabiendas: contornos suaves que
 * nunca son la única señal. La fila SIN CONTAR se separa del fondo por su
 * blanco, su contorno y, sobre todo, por su visor punteado; la CONTADO, por su
 * visor sólido. Quedan aquí con su umbral para que un cambio que los empeore falle.
 */
describe('contraste: excepciones documentadas de la paleta', () => {
  const EXCEPCIONES: [string, ClaveColor, ClaveColor, number][] = [
    ['fila SIN CONTAR: blanco sobre el fondo de pantalla', 'superficie', 'fondo', 1.24],
    ['borde de la fila SIN CONTAR', 'bordeSinContar', 'superficie', 2.04],
    ['contorno de tarjeta', 'contornoTarjeta', 'superficie', 1.5],
    ['borde de la fila CONTADO', 'capturado', 'capturadoFondo', 2.0],
  ];
  for (const [donde, texto, fondo, minimo] of EXCEPCIONES) {
    it(`${donde}: ${texto} sobre ${fondo} se mantiene ≥ ${minimo}:1`, () => {
      assert.ok(razonContraste(COLORES[texto], COLORES[fondo]) >= minimo - 0.005);
    });
  }
});

describe('contraste: inicio y menús', () => {
  comprobar(
    [
      ['nombre sobre la banda de identidad', 'texto', 'superficie'],
      ['rol sobre la banda de identidad', 'textoSecundario', 'superficie'],
      ['iniciales sobre el círculo de tinta', 'textoSobreColor', 'texto'],
      ['ícono de tarea en tinta sobre gris hundido', 'texto', 'superficieHonda'],
      ['"Completa" en la pastilla blanca de la banda de familia', 'capturadoHondo', 'superficie'],
    ],
    MINIMO_TEXTO,
  );
});

describe('contraste: íconos de tarea y de estado vacío (gráficos)', () => {
  for (const [nombre, tono] of Object.entries(TONOS)) {
    it(`${nombre}.solido sobre ${nombre}.fondo ≥ ${MINIMO_GRANDE}:1`, () => {
      assert.ok(razonContraste(tono.solido, tono.fondo) >= MINIMO_GRANDE);
    });
  }
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
    [FUENTE.extraNegrita]: 800,
  };

  it('cada nivel lleva una familia de FUENTE (con fuente propia fontWeight no aplica)', () => {
    const familias = new Set<string>(Object.values(FUENTE));
    for (const [nivel, estilo] of Object.entries(TIPOGRAFIA)) {
      assert.ok(familias.has(estilo.fontFamily), nivel);
      assert.ok(!('fontWeight' in estilo), `${nivel} no debe llevar fontWeight`);
    }
  });

  it('FUENTE tiene exactamente los cinco pesos que se cargan', () => {
    assert.deepEqual(
      Object.keys(FUENTE).sort(),
      (['extraNegrita', 'medio', 'negrita', 'regular', 'semiNegrita'] satisfies PesoFuente[]).sort(),
    );
  });

  it('el dato es más grande y pesa más que su rótulo', () => {
    assert.ok(DATO.fontSize > ETIQUETA_DATO.fontSize && DATO.fontSize > ROTULO.fontSize);
    assert.ok(PESO[DATO.fontFamily] - PESO[ETIQUETA_DATO.fontFamily] >= 200);
  });

  it('la lectura de la fila es 32 px ExtraBold y el número del campo 22 px', () => {
    assert.equal(TIPOGRAFIA.total.fontSize, 32);
    assert.equal(TIPOGRAFIA.total.fontFamily, FUENTE.extraNegrita);
    assert.equal(TIPOGRAFIA.campo.fontSize, 22);
  });

  it('ningún texto baja de 12 px: "PAQUETES" contra "SUELTAS" se lee a pleno sol', () => {
    for (const [nivel, estilo] of Object.entries(TIPOGRAFIA)) {
      assert.ok(estilo.fontSize >= 12, `${nivel} mide ${estilo.fontSize}`);
    }
    assert.ok(ROTULO.fontSize >= 12);
  });
});
