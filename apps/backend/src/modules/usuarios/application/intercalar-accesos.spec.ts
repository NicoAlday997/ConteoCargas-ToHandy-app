import type { MovimientoAcceso } from './admin-usuario.repository';
import { intercalarAccesos } from './intercalar-accesos';

const AUTOR = { id: 'sup-1', nombreCompleto: 'Cristian Alday' };

function restablecimiento(id: string, fecha: string): MovimientoAcceso {
  return {
    id,
    tipo: 'PIN_RESTABLECIDO',
    fecha: new Date(fecha),
    origen: 'SUPERVISOR',
    autor: AUTOR,
  };
}

function desbloqueo(id: string, fecha: string): MovimientoAcceso {
  return {
    id,
    tipo: 'BLOQUEO_QUITADO',
    fecha: new Date(fecha),
    autor: AUTOR,
    bloqueadoHasta: new Date(fecha),
  };
}

const ids = (movimientos: MovimientoAcceso[]) => movimientos.map((m) => m.id);

describe('intercalarAccesos', () => {
  // r3 > d2 > r2 > d1 > r1, cada tabla ya del mas reciente al mas antiguo.
  const restablecimientos = [
    restablecimiento('r3', '2026-09-30T10:00:00Z'),
    restablecimiento('r2', '2026-09-20T10:00:00Z'),
    restablecimiento('r1', '2026-09-01T10:00:00Z'),
  ];
  const desbloqueos = [
    desbloqueo('d2', '2026-09-25T10:00:00Z'),
    desbloqueo('d1', '2026-09-10T10:00:00Z'),
  ];

  it('junta las dos tablas del mas reciente al mas antiguo', () => {
    expect(
      ids(intercalarAccesos(restablecimientos, desbloqueos, 1, 10)),
    ).toEqual(['r3', 'd2', 'r2', 'd1', 'r1']);
  });

  it('recorta la pagina pedida', () => {
    expect(
      ids(intercalarAccesos(restablecimientos, desbloqueos, 1, 2)),
    ).toEqual(['r3', 'd2']);
    expect(
      ids(intercalarAccesos(restablecimientos, desbloqueos, 2, 2)),
    ).toEqual(['r2', 'd1']);
    expect(
      ids(intercalarAccesos(restablecimientos, desbloqueos, 3, 2)),
    ).toEqual(['r1']);
    expect(intercalarAccesos(restablecimientos, desbloqueos, 4, 2)).toEqual([]);
  });

  it('a igual fecha desempata por id, siempre en el mismo orden', () => {
    const misma = '2026-09-30T10:00:00Z';
    const a = restablecimiento('a', misma);
    const b = desbloqueo('b', misma);

    expect(ids(intercalarAccesos([a], [b], 1, 10))).toEqual(['b', 'a']);
    expect(ids(intercalarAccesos([], [b, a], 1, 10))).toEqual(['b', 'a']);
  });

  it('sin movimientos, pagina vacia', () => {
    expect(intercalarAccesos([], [], 1, 20)).toEqual([]);
  });
});
