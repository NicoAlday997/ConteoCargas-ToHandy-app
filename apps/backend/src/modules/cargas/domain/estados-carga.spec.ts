import type { EstadoCarga } from '@prisma/client';
import {
  TRANSICIONES_VALIDAS,
  TODOS_LOS_ESTADOS,
  puedeTransicionar,
  estadosAlcanzables,
  esTerminal,
  permiteConteoDelVendedor,
  permiteVerificacionDelContador,
} from './estados-carga';

describe('TRANSICIONES_VALIDAS — cada transicion declarada del mapa es valida', () => {
  for (const desde of Object.keys(TRANSICIONES_VALIDAS) as EstadoCarga[]) {
    for (const hacia of TRANSICIONES_VALIDAS[desde]) {
      it(`${desde} -> ${hacia}`, () => {
        expect(puedeTransicionar(desde, hacia)).toBe(true);
      });
    }
  }
});

describe('estadosAlcanzables', () => {
  it('devuelve exactamente lo declarado en el mapa', () => {
    for (const desde of TODOS_LOS_ESTADOS) {
      expect(estadosAlcanzables(desde).sort()).toEqual(
        [...TRANSICIONES_VALIDAS[desde]].sort(),
      );
    }
  });

  it('devuelve una copia: mutarla no afecta el mapa interno', () => {
    const copia = estadosAlcanzables('LISTA_PARA_ENVIAR');
    copia.push('BORRADOR');
    expect(estadosAlcanzables('LISTA_PARA_ENVIAR')).not.toContain('BORRADOR');
    expect(TRANSICIONES_VALIDAS.LISTA_PARA_ENVIAR).not.toContain('BORRADOR');
  });
});

describe('INVARIANTE CRITICA: no se puede saltar la verificacion', () => {
  it('BORRADOR no alcanza LISTA_PARA_ENVIAR (ni directa ni transitivamente sin pasar por comparacion)', () => {
    expect(puedeTransicionar('BORRADOR', 'LISTA_PARA_ENVIAR')).toBe(false);
    expect(estadosAlcanzables('BORRADOR')).toEqual(['EN_ESPERA_CONTADOR']);
  });

  it('BORRADOR no alcanza ENVIADA', () => {
    expect(puedeTransicionar('BORRADOR', 'ENVIADA')).toBe(false);
  });

  it('BORRADOR solo puede ir a EN_ESPERA_CONTADOR', () => {
    for (const hacia of TODOS_LOS_ESTADOS) {
      expect(puedeTransicionar('BORRADOR', hacia)).toBe(hacia === 'EN_ESPERA_CONTADOR');
    }
  });

  it('el unico camino a LISTA_PARA_ENVIAR pasa por EN_COMPARACION o CONFLICTOS_PENDIENTES', () => {
    const origenesHaciaListo = TODOS_LOS_ESTADOS.filter((e) =>
      puedeTransicionar(e, 'LISTA_PARA_ENVIAR'),
    ).sort();
    expect(origenesHaciaListo).toEqual(
      ['CONFLICTOS_PENDIENTES', 'EN_COMPARACION', 'ERROR_ENVIO', 'ENVIO_INCIERTO'].sort(),
    );
  });

  it('el unico origen hacia ENVIADA es LISTA_PARA_ENVIAR', () => {
    const origenesHaciaEnviada = TODOS_LOS_ESTADOS.filter((e) =>
      puedeTransicionar(e, 'ENVIADA'),
    );
    expect(origenesHaciaEnviada).toEqual(['LISTA_PARA_ENVIAR']);
  });
});

describe('esTerminal', () => {
  it('ENVIADA es terminal', () => {
    expect(esTerminal('ENVIADA')).toBe(true);
    expect(estadosAlcanzables('ENVIADA')).toEqual([]);
    for (const hacia of TODOS_LOS_ESTADOS) {
      expect(puedeTransicionar('ENVIADA', hacia)).toBe(false);
    }
  });

  it('ENVIADA es el unico estado terminal', () => {
    const terminales = TODOS_LOS_ESTADOS.filter(esTerminal);
    expect(terminales).toEqual(['ENVIADA']);
  });

  it('ERROR_ENVIO y ENVIO_INCIERTO no son terminales: vuelven a LISTA_PARA_ENVIAR', () => {
    expect(esTerminal('ERROR_ENVIO')).toBe(false);
    expect(esTerminal('ENVIO_INCIERTO')).toBe(false);
    expect(estadosAlcanzables('ERROR_ENVIO')).toEqual(['LISTA_PARA_ENVIAR']);
    expect(estadosAlcanzables('ENVIO_INCIERTO')).toEqual(['LISTA_PARA_ENVIAR']);
  });
});

describe('BLOQUEADA_CORTE_PENDIENTE', () => {
  it('solo vuelve a EN_ESPERA_CONTADOR', () => {
    expect(estadosAlcanzables('BLOQUEADA_CORTE_PENDIENTE')).toEqual(['EN_ESPERA_CONTADOR']);
  });
});

describe('recorrido exhaustivo: TODAS las combinaciones origen x destino', () => {
  // Conjunto declarado, construido de forma independiente al mapa para que este
  // test falle si alguien agrega o quita una arista en TRANSICIONES_VALIDAS.
  const ARISTAS_ESPERADAS = new Set<string>([
    'BORRADOR->EN_ESPERA_CONTADOR',
    'EN_ESPERA_CONTADOR->BLOQUEADA_CORTE_PENDIENTE',
    'EN_ESPERA_CONTADOR->EN_COMPARACION',
    'BLOQUEADA_CORTE_PENDIENTE->EN_ESPERA_CONTADOR',
    'EN_COMPARACION->CONFLICTOS_PENDIENTES',
    'EN_COMPARACION->LISTA_PARA_ENVIAR',
    'CONFLICTOS_PENDIENTES->LISTA_PARA_ENVIAR',
    'LISTA_PARA_ENVIAR->ENVIADA',
    'LISTA_PARA_ENVIAR->ERROR_ENVIO',
    'LISTA_PARA_ENVIAR->ENVIO_INCIERTO',
    'ERROR_ENVIO->LISTA_PARA_ENVIAR',
    'ENVIO_INCIERTO->LISTA_PARA_ENVIAR',
  ]);

  it('puedeTransicionar es true exactamente para las aristas declaradas', () => {
    for (const desde of TODOS_LOS_ESTADOS) {
      for (const hacia of TODOS_LOS_ESTADOS) {
        const esperado = ARISTAS_ESPERADAS.has(`${desde}->${hacia}`);
        expect({ desde, hacia, valido: puedeTransicionar(desde, hacia) }).toEqual({
          desde,
          hacia,
          valido: esperado,
        });
      }
    }
  });

  it('ningun estado transiciona a si mismo', () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      expect(puedeTransicionar(estado, estado)).toBe(false);
    }
  });

  it('cubre los 9 estados del enum EstadoCarga', () => {
    expect(TODOS_LOS_ESTADOS.sort()).toEqual(
      [
        'BLOQUEADA_CORTE_PENDIENTE',
        'BORRADOR',
        'CONFLICTOS_PENDIENTES',
        'EN_COMPARACION',
        'EN_ESPERA_CONTADOR',
        'ENVIADA',
        'ENVIO_INCIERTO',
        'ERROR_ENVIO',
        'LISTA_PARA_ENVIAR',
      ].sort(),
    );
  });
});

describe('permiteConteoDelVendedor (docs/01 seccion 6, regla 2)', () => {
  it('true en BORRADOR y EN_ESPERA_CONTADOR', () => {
    expect(permiteConteoDelVendedor('BORRADOR')).toBe(true);
    expect(permiteConteoDelVendedor('EN_ESPERA_CONTADOR')).toBe(true);
  });

  it('true incluso en BLOQUEADA_CORTE_PENDIENTE: el corte pendiente no frena al vendedor', () => {
    expect(permiteConteoDelVendedor('BLOQUEADA_CORTE_PENDIENTE')).toBe(true);
  });

  it('false una vez que la carga entro a comparacion o mas alla', () => {
    for (const estado of [
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
      'LISTA_PARA_ENVIAR',
      'ENVIADA',
      'ERROR_ENVIO',
      'ENVIO_INCIERTO',
    ] as EstadoCarga[]) {
      expect(permiteConteoDelVendedor(estado)).toBe(false);
    }
  });
});

describe('permiteVerificacionDelContador (docs/02 seccion 4.5)', () => {
  it('true solo en EN_ESPERA_CONTADOR', () => {
    expect(permiteVerificacionDelContador('EN_ESPERA_CONTADOR')).toBe(true);
  });

  it('false en BLOQUEADA_CORTE_PENDIENTE: el corte pendiente bloquea exactamente esta accion', () => {
    expect(permiteVerificacionDelContador('BLOQUEADA_CORTE_PENDIENTE')).toBe(false);
  });

  it('false en el resto de estados', () => {
    for (const estado of TODOS_LOS_ESTADOS.filter((e) => e !== 'EN_ESPERA_CONTADOR')) {
      expect(permiteVerificacionDelContador(estado)).toBe(false);
    }
  });
});
