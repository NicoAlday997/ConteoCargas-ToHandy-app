import {
  capturarCantidadFinal,
  confirmarCantidadFinal,
  esCantidadAtipica,
  todasResueltas,
  EstadoDiscrepancia,
} from './resolver-discrepancia';

/** Discrepancia recien detectada: dos conteos que difieren, nada resuelto. */
function nuevaDiscrepancia(
  parcial: Partial<EstadoDiscrepancia> = {},
): EstadoDiscrepancia {
  return {
    productoCode: 'P1',
    cantidadPrimerConteo: 10,
    cantidadSegundoConteo: 12,
    ...parcial,
  };
}

describe('capturarCantidadFinal', () => {
  it('captura una cantidad valida y registra quien la capturo', () => {
    const estado = nuevaDiscrepancia();

    const r = capturarCantidadFinal(estado, 11, 'user-vendedor');

    expect(r).toEqual({
      exito: true,
      estado: {
        productoCode: 'P1',
        cantidadPrimerConteo: 10,
        cantidadSegundoConteo: 12,
        cantidadFinal: 11,
        capturadaPorId: 'user-vendedor',
      },
    });
  });

  it('acepta cero como cantidad final valida', () => {
    const r = capturarCantidadFinal(nuevaDiscrepancia(), 0, 'user-a');

    expect(r.exito).toBe(true);
    expect(r.exito && r.estado.cantidadFinal).toBe(0);
  });

  it('rechaza cantidad negativa con CANTIDAD_INVALIDA', () => {
    const r = capturarCantidadFinal(nuevaDiscrepancia(), -1, 'user-a');

    expect(r).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });
  });

  it('rechaza cantidad decimal con CANTIDAD_INVALIDA', () => {
    const r = capturarCantidadFinal(nuevaDiscrepancia(), 11.5, 'user-a');

    expect(r).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });
  });

  it('rechaza NaN e Infinity con CANTIDAD_INVALIDA', () => {
    expect(capturarCantidadFinal(nuevaDiscrepancia(), Number.NaN, 'user-a')).toEqual({
      exito: false,
      motivo: 'CANTIDAD_INVALIDA',
    });
    expect(
      capturarCantidadFinal(nuevaDiscrepancia(), Number.POSITIVE_INFINITY, 'user-a'),
    ).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });
  });

  it('rechaza recapturar sobre una discrepancia ya confirmada con YA_CONFIRMADA', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
      confirmadaPorId: 'user-b',
    });

    const r = capturarCantidadFinal(estado, 99, 'user-a');

    expect(r).toEqual({ exito: false, motivo: 'YA_CONFIRMADA' });
  });

  it('permite recapturar mientras no exista confirmacion', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
    });

    const r = capturarCantidadFinal(estado, 13, 'user-a');

    expect(r.exito).toBe(true);
    expect(r.exito && r.estado.cantidadFinal).toBe(13);
    expect(r.exito && r.estado.capturadaPorId).toBe('user-a');
  });

  it('no muta el estado recibido', () => {
    const estado = nuevaDiscrepancia();
    const copia = JSON.parse(JSON.stringify(estado));

    capturarCantidadFinal(estado, 11, 'user-a');

    expect(estado).toEqual(copia);
  });
});

describe('confirmarCantidadFinal', () => {
  it('confirma cuando la persona es distinta de quien capturo', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
    });

    const r = confirmarCantidadFinal(estado, 'user-b');

    expect(r).toEqual({
      exito: true,
      estado: {
        productoCode: 'P1',
        cantidadPrimerConteo: 10,
        cantidadSegundoConteo: 12,
        cantidadFinal: 11,
        capturadaPorId: 'user-a',
        confirmadaPorId: 'user-b',
      },
    });
  });

  it('rechaza AUTOCONFIRMACION_PROHIBIDA si el mismo usuario captura y confirma', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
    });

    const r = confirmarCantidadFinal(estado, 'user-a');

    expect(r).toEqual({ exito: false, motivo: 'AUTOCONFIRMACION_PROHIBIDA' });
  });

  it('la autoconfirmacion se rechaza incluso si la cantidad ya estaba confirmada por otro', () => {
    // Prevalece la regla del sistema: mismo usuario que capturo => prohibido.
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
      confirmadaPorId: 'user-b',
    });

    const r = confirmarCantidadFinal(estado, 'user-a');

    expect(r).toEqual({ exito: false, motivo: 'AUTOCONFIRMACION_PROHIBIDA' });
  });

  it('rechaza NO_HAY_CAPTURA_PREVIA si nadie capturo todavia', () => {
    const r = confirmarCantidadFinal(nuevaDiscrepancia(), 'user-b');

    expect(r).toEqual({ exito: false, motivo: 'NO_HAY_CAPTURA_PREVIA' });
  });

  it('rechaza NO_HAY_CAPTURA_PREVIA aunque exista cantidadFinal sin capturadaPorId', () => {
    const estado = nuevaDiscrepancia({ cantidadFinal: 11 });

    const r = confirmarCantidadFinal(estado, 'user-b');

    expect(r).toEqual({ exito: false, motivo: 'NO_HAY_CAPTURA_PREVIA' });
  });

  it('rechaza YA_CONFIRMADA en una segunda confirmacion por una tercera persona', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
      confirmadaPorId: 'user-b',
    });

    const r = confirmarCantidadFinal(estado, 'user-c');

    expect(r).toEqual({ exito: false, motivo: 'YA_CONFIRMADA' });
  });

  it('no muta el estado recibido', () => {
    const estado = nuevaDiscrepancia({
      cantidadFinal: 11,
      capturadaPorId: 'user-a',
    });
    const copia = JSON.parse(JSON.stringify(estado));

    confirmarCantidadFinal(estado, 'user-b');

    expect(estado).toEqual(copia);
  });

  it('flujo completo: capturar y luego confirmar deja la discrepancia resuelta', () => {
    const captura = capturarCantidadFinal(nuevaDiscrepancia(), 11, 'user-a');
    expect(captura.exito).toBe(true);
    if (!captura.exito) return;

    const confirma = confirmarCantidadFinal(captura.estado, 'user-b');
    expect(confirma.exito).toBe(true);
    if (!confirma.exito) return;

    expect(todasResueltas([confirma.estado])).toBe(true);
  });
});

describe('esCantidadAtipica', () => {
  it('es atipica si la cantidad final no coincide con ninguno de los dos conteos', () => {
    const estado = nuevaDiscrepancia({
      cantidadPrimerConteo: 10,
      cantidadSegundoConteo: 12,
      cantidadFinal: 15,
    });

    expect(esCantidadAtipica(estado)).toBe(true);
  });

  it('no es atipica si la cantidad final coincide con el primer conteo', () => {
    const estado = nuevaDiscrepancia({
      cantidadPrimerConteo: 10,
      cantidadSegundoConteo: 12,
      cantidadFinal: 10,
    });

    expect(esCantidadAtipica(estado)).toBe(false);
  });

  it('no es atipica si la cantidad final coincide con el segundo conteo', () => {
    const estado = nuevaDiscrepancia({
      cantidadPrimerConteo: 10,
      cantidadSegundoConteo: 12,
      cantidadFinal: 12,
    });

    expect(esCantidadAtipica(estado)).toBe(false);
  });

  it('no es atipica cuando ambos conteos son iguales y la final los iguala', () => {
    const estado = nuevaDiscrepancia({
      cantidadPrimerConteo: 8,
      cantidadSegundoConteo: 8,
      cantidadFinal: 8,
    });

    expect(esCantidadAtipica(estado)).toBe(false);
  });

  it('es atipica con cantidad final 0 si ninguno de los conteos era 0', () => {
    const estado = nuevaDiscrepancia({
      cantidadPrimerConteo: 10,
      cantidadSegundoConteo: 12,
      cantidadFinal: 0,
    });

    expect(esCantidadAtipica(estado)).toBe(true);
  });

  it('devuelve false mientras no haya cantidad final capturada', () => {
    expect(esCantidadAtipica(nuevaDiscrepancia())).toBe(false);
  });
});

describe('todasResueltas', () => {
  it('lista vacia: true de forma vacua', () => {
    expect(todasResueltas([])).toBe(true);
  });

  it('lista completa: todas con cantidadFinal, capturadaPorId y confirmadaPorId', () => {
    const discrepancias: EstadoDiscrepancia[] = [
      nuevaDiscrepancia({
        productoCode: 'P1',
        cantidadFinal: 11,
        capturadaPorId: 'user-a',
        confirmadaPorId: 'user-b',
      }),
      nuevaDiscrepancia({
        productoCode: 'P2',
        cantidadFinal: 0,
        capturadaPorId: 'user-b',
        confirmadaPorId: 'user-a',
      }),
    ];

    expect(todasResueltas(discrepancias)).toBe(true);
  });

  it('lista parcial: una capturada pero sin confirmar', () => {
    const discrepancias: EstadoDiscrepancia[] = [
      nuevaDiscrepancia({
        productoCode: 'P1',
        cantidadFinal: 11,
        capturadaPorId: 'user-a',
        confirmadaPorId: 'user-b',
      }),
      nuevaDiscrepancia({
        productoCode: 'P2',
        cantidadFinal: 5,
        capturadaPorId: 'user-a',
      }),
    ];

    expect(todasResueltas(discrepancias)).toBe(false);
  });

  it('lista parcial: una sin tocar', () => {
    const discrepancias: EstadoDiscrepancia[] = [
      nuevaDiscrepancia({
        productoCode: 'P1',
        cantidadFinal: 11,
        capturadaPorId: 'user-a',
        confirmadaPorId: 'user-b',
      }),
      nuevaDiscrepancia({ productoCode: 'P2' }),
    ];

    expect(todasResueltas(discrepancias)).toBe(false);
  });

  it('no cuenta como resuelta una con capturadaPorId pero cantidadFinal ausente', () => {
    const discrepancias: EstadoDiscrepancia[] = [
      nuevaDiscrepancia({
        productoCode: 'P1',
        capturadaPorId: 'user-a',
        confirmadaPorId: 'user-b',
      }),
    ];

    expect(todasResueltas(discrepancias)).toBe(false);
  });
});
