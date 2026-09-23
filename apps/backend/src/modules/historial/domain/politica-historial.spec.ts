import {
  alcanceHistorial,
  cargaDentroDeAlcance,
  fechaInicioEfectiva,
  type AlcanceHistorial,
} from './politica-historial';

/** Hoy es 23 de septiembre por la tarde (hora de Mexico). */
const AHORA = new Date('2026-09-23T18:00:00-06:00');
/** Hace 14 dias, al inicio del dia en Mexico. */
const HACE_14_DIAS = new Date('2026-09-09T00:00:00-06:00');

describe('alcanceHistorial', () => {
  it('VENDEDOR: solo sus cargas, desde hace 14 dias', () => {
    expect(alcanceHistorial('VENDEDOR', 'v1', AHORA)).toEqual({
      usuarioAppIdFiltro: 'v1',
      fechaMinima: HACE_14_DIAS,
    });
  });

  it('CONTADOR: cargas de todos los vendedores, desde hace 14 dias', () => {
    expect(alcanceHistorial('CONTADOR', 'c1', AHORA)).toEqual({
      usuarioAppIdFiltro: null,
      fechaMinima: HACE_14_DIAS,
    });
  });

  it('SUPERVISOR: todo, sin limite de fecha', () => {
    expect(alcanceHistorial('SUPERVISOR', 's1', AHORA)).toEqual({
      usuarioAppIdFiltro: null,
      fechaMinima: null,
    });
  });

  it('cuenta los 14 dias en dia de Mexico, no de UTC', () => {
    // 23 a las 20:00 en Mexico ya es 24 en UTC: el limite sigue siendo el 9.
    expect(
      alcanceHistorial('CONTADOR', 'c1', new Date('2026-09-24T02:00:00Z')).fechaMinima,
    ).toEqual(HACE_14_DIAS);
  });
});

describe('cargaDentroDeAlcance', () => {
  const vendedor = alcanceHistorial('VENDEDOR', 'v1', AHORA);
  const contador = alcanceHistorial('CONTADOR', 'c1', AHORA);
  const supervisor = alcanceHistorial('SUPERVISOR', 's1', AHORA);
  const reciente = new Date('2026-09-20T00:00:00-06:00');
  const vieja = new Date('2026-09-08T00:00:00-06:00');

  it('el vendedor ve su propia carga reciente', () => {
    expect(
      cargaDentroDeAlcance(vendedor, { vendedorUsuarioAppId: 'v1', fechaOperativa: reciente }),
    ).toBe(true);
  });

  it('el vendedor NO ve la carga de otro vendedor', () => {
    expect(
      cargaDentroDeAlcance(vendedor, { vendedorUsuarioAppId: 'v2', fechaOperativa: reciente }),
    ).toBe(false);
  });

  it('el vendedor NO ve una carga sin sesion de vendedor', () => {
    expect(
      cargaDentroDeAlcance(vendedor, { vendedorUsuarioAppId: null, fechaOperativa: reciente }),
    ).toBe(false);
  });

  it('el vendedor NO ve su propia carga de hace mas de 14 dias', () => {
    expect(
      cargaDentroDeAlcance(vendedor, { vendedorUsuarioAppId: 'v1', fechaOperativa: vieja }),
    ).toBe(false);
  });

  it('el limite es inclusivo: la carga de hace exactamente 14 dias entra', () => {
    expect(
      cargaDentroDeAlcance(contador, { vendedorUsuarioAppId: 'v2', fechaOperativa: HACE_14_DIAS }),
    ).toBe(true);
  });

  it('el contador ve cargas de cualquier vendedor dentro de las 2 semanas', () => {
    expect(
      cargaDentroDeAlcance(contador, { vendedorUsuarioAppId: 'v2', fechaOperativa: reciente }),
    ).toBe(true);
    expect(
      cargaDentroDeAlcance(contador, { vendedorUsuarioAppId: 'v2', fechaOperativa: vieja }),
    ).toBe(false);
  });

  it('el supervisor ve todo', () => {
    expect(
      cargaDentroDeAlcance(supervisor, { vendedorUsuarioAppId: null, fechaOperativa: vieja }),
    ).toBe(true);
  });
});

describe('fechaInicioEfectiva', () => {
  const limitado: AlcanceHistorial = { usuarioAppIdFiltro: null, fechaMinima: HACE_14_DIAS };
  const total: AlcanceHistorial = { usuarioAppIdFiltro: null, fechaMinima: null };

  it('sin fecha del cliente usa la minima del alcance', () => {
    expect(fechaInicioEfectiva(limitado, undefined)).toEqual(HACE_14_DIAS);
  });

  it('el cliente no puede ir mas atras que la minima', () => {
    expect(fechaInicioEfectiva(limitado, new Date('2026-01-01T00:00:00-06:00'))).toEqual(
      HACE_14_DIAS,
    );
  });

  it('el cliente si puede estrechar hacia una fecha mas reciente', () => {
    const reciente = new Date('2026-09-20T00:00:00-06:00');
    expect(fechaInicioEfectiva(limitado, reciente)).toEqual(reciente);
  });

  it('sin limite respeta lo que pida el cliente, incluido nada', () => {
    const antigua = new Date('2025-01-01T00:00:00-06:00');
    expect(fechaInicioEfectiva(total, antigua)).toEqual(antigua);
    expect(fechaInicioEfectiva(total, undefined)).toBeUndefined();
  });
});
