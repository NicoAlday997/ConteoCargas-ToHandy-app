/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { razonContraste } from './contraste.ts';
import {
  COLORES,
  DATO,
  DEGRADADOS,
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

function comprobar(
  pares: [string, ClaveColor | string, ClaveColor | string][],
  minimo: number,
) {
  for (const [donde, a, b] of pares) {
    const colorA = a in COLORES ? COLORES[a as ClaveColor] : a;
    const colorB = b in COLORES ? COLORES[b as ClaveColor] : b;
    it(`${donde}: ${a} sobre ${b} ≥ ${minimo}:1`, () => {
      assert.ok(
        razonContraste(colorA, colorB) >= minimo,
        `${razonContraste(colorA, colorB).toFixed(2)}:1`,
      );
    });
  }
}

describe('contraste: texto general', () => {
  comprobar(
    [
      ['texto sobre el fondo de pantalla', 'texto', 'fondo'],
      ['texto sobre tarjeta', 'texto', 'superficie'],
      ['texto sobre campo en reposo', 'texto', 'superficieHonda'],
      [
        'secundario sobre el fondo de pantalla ("Faltan 10 productos")',
        'textoSecundario',
        'fondo',
      ],
      ['secundario sobre tarjeta', 'textoSecundario', 'superficie'],
      [
        'secundario sobre pastilla neutra',
        'textoSecundario',
        'superficieHonda',
      ],
      ['error como texto ("Cerrar sesión")', 'error', 'superficie'],
      ['rótulo terciario sobre tarjeta', 'textoTerciario', 'superficie'],
      [
        'rótulo terciario sobre el fondo de pantalla',
        'textoTerciario',
        'fondo',
      ],
      ['texto del botón de peligro', 'errorTexto', 'superficie'],
      ['azul señal como texto (enlace) sobre tarjeta', 'accion', 'superficie'],
      ['azul señal como texto sobre el fondo de pantalla', 'accion', 'fondo'],
      ['texto sobre lo seleccionado (tinte azul)', 'texto', 'marcaTinte'],
      ['texto azul hondo sobre lo seleccionado', 'accionHonda', 'marcaTinte'],
      [
        'texto azul hondo sobre azul suave ("Listo", secundario)',
        'accionHonda',
        'azulSuave',
      ],
    ],
    MINIMO_TEXTO,
  );
});

describe('contraste: botones', () => {
  comprobar(
    [
      ['primario: blanco sobre azul señal', 'textoSobreColor', 'accion'],
      ['primario presionado', 'textoSobreColor', 'accionHonda'],
      [
        'secundario: azul hondo sobre pieza blanca',
        'accionHonda',
        'superficie',
      ],
    ],
    MINIMO_TEXTO,
  );
  comprobar([['contorno del peligro', 'error', 'superficie']], MINIMO_GRANDE);
});

describe('contraste: el único degradado con texto encima (héroe, login, inicio)', () => {
  // El texto se lee sobre cualquier punto del degradado: se revisa cada parada.
  for (const color of DEGRADADOS.marca.colores) {
    it(`blanco sobre marca (${color}) ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(
        razonContraste(COLORES.textoSobreColor, color) >= MINIMO_TEXTO,
        razonContraste(COLORES.textoSobreColor, color).toFixed(2),
      );
    });
    it(`azul tenue (subtítulos) sobre el héroe (${color}) ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(
        razonContraste(COLORES.marcaTenue, color) >= MINIMO_TEXTO,
        razonContraste(COLORES.marcaTenue, color).toFixed(2),
      );
    });
    it(`azul retirado (descripción de la entrada) sobre el héroe (${color}) ≥ ${MINIMO_TEXTO}:1`, () => {
      assert.ok(
        razonContraste(COLORES.marcaRetirada, color) >= MINIMO_TEXTO,
        razonContraste(COLORES.marcaRetirada, color).toFixed(2),
      );
    });
  }
});

/**
 * Los controles que dejaron el degradado por color plano (regla junto a
 * DEGRADADOS en tokens.ts) y los fondos sólidos que ahora garantizan el texto
 * blanco aunque el degradado no pinte.
 */
describe('contraste: fondos sólidos bajo texto blanco', () => {
  comprobar(
    [
      [
        'campo activo del teclado: número blanco sobre azul noche plano',
        'textoSobreColor',
        'marca',
      ],
      ['campo activo del teclado: rótulo', 'marcaTenue', 'marca'],
      ['tecla de avance', 'textoSobreColor', 'accion'],
      ['tecla de avance presionada', 'textoSobreColor', 'accionHonda'],
      ['botón principal', 'textoSobreColor', 'accion'],
      ['botón principal presionado', 'textoSobreColor', 'accionHonda'],
      ['visor de lo contado', 'textoSobreColor', 'accion'],
      ['iniciales del Avatar', 'textoSobreColor', 'accion'],
      ['panel del avance: el número ("0")', 'textoSobreColor', 'marcaHonda'],
      ['panel del avance: "de 9 resueltas"', 'marcaTenue', 'marcaHonda'],
      ['pastilla del rol en el inicio', 'textoSobreColor', 'marcaHonda'],
      ['pastilla "Guardado" del conteo', 'textoSobreColor', 'carril'],
      // Si hasta el héroe fallara, su color plano sigue sosteniendo el texto.
      ['título del héroe sobre su color plano', 'textoSobreColor', 'marca'],
    ],
    MINIMO_TEXTO,
  );
  // El velo del canal (rgba(6, 18, 51, 0.55)) sobre el panel azul hondo da #0E2155.
  comprobar(
    [
      [
        'relleno plano de la barra sobre el canal del panel',
        'accionViva',
        '#0E2155',
      ],
    ],
    MINIMO_GRANDE,
  );

  it('panel del avance: el número y su texto se distinguen entre sí (blanco más claro que el azul tenue)', () => {
    // Además van en tamaños y pesos distintos (36 px ExtraBold contra 14 px).
    assert.ok(
      razonContraste(COLORES.textoSobreColor, COLORES.marcaTenue) > 1.5,
    );
  });
});

describe('contraste: héroe azul noche y fila que se teclea', () => {
  comprobar(
    [
      ['título', 'textoSobreColor', 'marca'],
      ['subtítulo, "de 14" y quién cuenta', 'marcaTenue', 'marca'],
      [
        'campo inactivo de la fila que se teclea',
        'textoSobreColor',
        'marcaHonda',
      ],
      [
        '"piezas" en el visor de la fila que se teclea',
        'marcaTenue',
        'marcaHonda',
      ],
      [
        'pastilla del empaque en la fila que se teclea',
        'textoSobreColor',
        'marcaClara',
      ],
      ['campo activo (blanco)', 'texto', 'superficie'],
    ],
    MINIMO_TEXTO,
  );
  comprobar(
    [
      [
        'aro azul luminoso del campo activo sobre azul noche',
        'accionViva',
        'marca',
      ],
      [
        'relleno de la barra de avance sobre el canal',
        'accionViva',
        'marcaProfunda',
      ],
    ],
    MINIMO_GRANDE,
  );
});

describe('contraste: teclado de cantidad (panel claro)', () => {
  comprobar(
    [
      ['dígito de una tecla', 'texto', 'fondo'],
      ['tecla presionada (encendida en azul)', 'textoSobreColor', 'accion'],
      ['tecla "No lleva"', 'textoSobreColor', 'pendiente'],
      ['aviso ámbar', 'discrepanciaTexto', 'discrepanciaFondo'],
      ['opción de campo activa (pieza blanca)', 'accionHonda', 'superficie'],
      ['opción de campo inactiva', 'textoSecundario', 'superficieHonda'],
      [
        'lectura del visor (blanco sobre azul noche)',
        'textoSobreColor',
        'marca',
      ],
      ['lectura por reemplazar', 'marcaTenue', 'marca'],
    ],
    MINIMO_TEXTO,
  );
});

describe('contraste: filas de conteo', () => {
  comprobar(
    [
      ['SIN CONTAR: nombre', 'texto', 'superficie'],
      ['SIN CONTAR: pastilla del factor', 'textoSecundario', 'superficieHonda'],
      [
        'SIN CONTAR: rótulo "piezas" del visor vacío',
        'textoSecundario',
        'superficie',
      ],
      ['CONTADO: nombre sobre azul suave', 'texto', 'azulSuave'],
      ['CONTADO: pastilla del factor', 'textoSobreColor', 'accion'],
      ['CONTADO: número en el campo blanco', 'texto', 'superficie'],
      ['CONTADO: visor encendido', 'textoSobreColor', 'accion'],
      [
        'CONTADO: palomita blanca en su círculo verde',
        'textoSobreColor',
        'capturadoHondo',
      ],
      ['NO LLEVA: nombre', 'pendiente', 'pendienteFondo'],
      ['NO LLEVA: 0 del botón', 'pendiente', 'superficie'],
      ['NO LLEVA: visor "0 · No lleva"', 'textoSobreColor', 'pendiente'],
      ['aviso de rechazo', 'errorTexto', 'errorFondo'],
    ],
    MINIMO_TEXTO,
  );
  // Contornos y gráficos: 3:1 (WCAG 1.4.11).
  comprobar(
    [
      ['SIN CONTAR: "—" del visor vacío', 'textoTerciario', 'superficie'],
      ['botón 0: contorno', 'borde', 'superficie'],
      ['contorno de campo sobre el fondo de pantalla', 'borde', 'fondo'],
      ['chevron sobre tarjeta', 'textoTerciario', 'superficie'],
    ],
    MINIMO_GRANDE,
  );
});

/**
 * Pares que NO llegan a 3:1 y se aceptan a sabiendas: contornos suaves que
 * nunca son la única señal. La fila SIN CONTAR se separa del fondo por su
 * blanco, su contorno, su sombra y, sobre todo, por su visor punteado; la
 * CONTADO, por su visor encendido y su palomita. Quedan aquí con su umbral
 * para que un cambio que los empeore falle.
 */
describe('contraste: excepciones documentadas de la paleta', () => {
  const EXCEPCIONES: [string, ClaveColor, ClaveColor, number][] = [
    [
      'fila SIN CONTAR: blanco sobre el fondo de pantalla',
      'superficie',
      'fondo',
      1.1,
    ],
    ['borde de la fila SIN CONTAR', 'bordeSinContar', 'superficie', 2.1],
    ['contorno de tarjeta', 'contornoTarjeta', 'superficie', 1.35],
  ];
  for (const [donde, texto, fondo, minimo] of EXCEPCIONES) {
    it(`${donde}: ${texto} sobre ${fondo} se mantiene ≥ ${minimo}:1`, () => {
      assert.ok(
        razonContraste(COLORES[texto], COLORES[fondo]) >= minimo - 0.005,
      );
    });
  }
});

describe('contraste: entrada, inicio y menús', () => {
  comprobar(
    [
      ['nombre y "Handy Conteo" sobre el héroe', 'textoSobreColor', 'marca'],
      ['lema y "Hola," sobre el héroe', 'marcaTenue', 'marca'],
      ['iniciales en el avatar azul', 'textoSobreColor', 'accion'],
      ['nombre en la tarjeta de usuario', 'texto', 'superficie'],
      ['rol en la tarjeta de usuario', 'textoSecundario', 'superficie'],
      ['"Completa" en la banda de familia', 'capturadoHondo', 'capturadoFondo'],
    ],
    MINIMO_TEXTO,
  );
  comprobar(
    [
      [
        'pictograma de tarea azul sobre su círculo azul suave',
        'accion',
        'azulSuave',
      ],
      ['círculo vacío del PIN sobre claro', 'borde', 'superficie'],
      ['círculo activo del PIN sobre claro', 'accion', 'superficie'],
    ],
    MINIMO_GRANDE,
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
      assert.ok(
        razonContraste(COLORES.textoSobreColor, tono.solido) >= MINIMO_TEXTO,
      );
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
    assert.equal(
      razonContraste('#13172A', '#FFFFFF'),
      razonContraste('#FFFFFF', '#13172A'),
    );
  });
});

describe('ritmo de espaciado', () => {
  for (const [nombre, valor] of Object.entries({
    ...ESPACIADO,
    ...RITMO,
    TOQUE_MINIMO,
  })) {
    it(`${nombre} (${valor}) cae en la rejilla de 4`, () => {
      assert.equal(valor % 4, 0);
    });
  }

  it('más aire entre secciones que entre grupos, entre grupos que entre hermanos, y entre hermanos que dentro de uno', () => {
    assert.ok(
      RITMO.seccion > RITMO.grupo &&
        RITMO.grupo > RITMO.relacionado &&
        RITMO.relacionado > RITMO.interno,
    );
  });
});

describe('tipografía', () => {
  const PESO = new Map<string, number>([
    [FUENTE.regular, 400],
    [FUENTE.medio, 500],
    [FUENTE.semiNegrita, 600],
    [FUENTE.negrita, 700],
    [FUENTE.extraNegrita, 800],
  ]);

  it('cada nivel lleva una familia de FUENTE (con fuente propia fontWeight no aplica)', () => {
    const familias = new Set<string>(Object.values(FUENTE));
    for (const [nivel, estilo] of Object.entries(TIPOGRAFIA)) {
      assert.ok(familias.has(estilo.fontFamily), nivel);
      assert.ok(
        !('fontWeight' in estilo),
        `${nivel} no debe llevar fontWeight`,
      );
    }
  });

  it('una sola familia, Manrope, en los cinco cortes que se cargan', () => {
    const cortes = new Set<string>(Object.values(FUENTE));
    assert.equal(cortes.size, 5);
    for (const corte of cortes) assert.match(corte, /^Manrope_/);
    assert.deepEqual(
      Object.keys(FUENTE).sort(),
      (
        [
          'extraNegrita',
          'medio',
          'negrita',
          'regular',
          'rotulo',
          'semiNegrita',
          'titular',
        ] satisfies PesoFuente[]
      ).sort(),
    );
  });

  it('el dato es más grande y pesa más que su rótulo, en minúsculas', () => {
    assert.ok(
      DATO.fontSize > ETIQUETA_DATO.fontSize && DATO.fontSize > ROTULO.fontSize,
    );
    assert.ok(
      (PESO.get(DATO.fontFamily) ?? 0) >
        (PESO.get(ETIQUETA_DATO.fontFamily) ?? 0),
    );
    assert.ok(!('textTransform' in ETIQUETA_DATO));
  });

  it('las lecturas van en ExtraBold: el total de la fila y la cifra dominante', () => {
    assert.equal(TIPOGRAFIA.total.fontFamily, FUENTE.extraNegrita);
    assert.equal(TIPOGRAFIA.numero.fontFamily, FUENTE.extraNegrita);
    assert.ok(
      TIPOGRAFIA.total.fontSize >= 28 && TIPOGRAFIA.campo.fontSize >= 22,
    );
  });

  it('ningún texto baja de 12 px: "Paquetes" contra "Sueltas" se lee a pleno sol', () => {
    for (const [nivel, estilo] of Object.entries(TIPOGRAFIA)) {
      assert.ok(estilo.fontSize >= 12, `${nivel} mide ${estilo.fontSize}`);
    }
    assert.ok(ROTULO.fontSize >= 12);
  });
});
