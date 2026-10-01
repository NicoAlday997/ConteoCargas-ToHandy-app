import { evaluarCandado, VENTANA_CANDADO_MS } from './candado-sincronizacion';

describe('evaluarCandado', () => {
  const ULTIMA = new Date('2026-09-30T16:00:00.000Z');

  it('nunca se ha sincronizado: libre', () => {
    expect(evaluarCandado(null, ULTIMA)).toEqual({ libre: true });
  });

  it('la ventana es de 2 minutos', () => {
    expect(VENTANA_CANDADO_MS).toBe(120_000);
  });

  it('a los 30 segundos: cerrado, con el momento exacto en que se abre', () => {
    const ahora = new Date(ULTIMA.getTime() + 30_000);
    expect(evaluarCandado(ULTIMA, ahora)).toEqual({
      libre: false,
      reintentarEn: new Date('2026-09-30T16:02:00.000Z'),
    });
  });

  it('un milisegundo antes de los 2 minutos sigue cerrado', () => {
    const ahora = new Date(ULTIMA.getTime() + VENTANA_CANDADO_MS - 1);
    expect(evaluarCandado(ULTIMA, ahora).libre).toBe(false);
  });

  it('justo a los 2 minutos se abre', () => {
    const ahora = new Date(ULTIMA.getTime() + VENTANA_CANDADO_MS);
    expect(evaluarCandado(ULTIMA, ahora)).toEqual({ libre: true });
  });

  it('si la ultima quedo en el futuro (reloj que retrocede), sigue cerrado', () => {
    const ahora = new Date(ULTIMA.getTime() - 60_000);
    expect(evaluarCandado(ULTIMA, ahora).libre).toBe(false);
  });
});
