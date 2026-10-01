import {
  evaluarCandado,
  VENTANA_CANDADO_MS,
  VENTANA_CANDADO_TRAS_FALLO_MS,
} from './candado-sincronizacion';

describe('evaluarCandado', () => {
  const INICIO = new Date('2026-09-30T16:00:00.000Z');
  const EXITOSA = { iniciadaEn: INICIO, exito: true };
  const FALLIDA = { iniciadaEn: INICIO, exito: false };
  const EN_CURSO = { iniciadaEn: INICIO, exito: null };
  const mas = (ms: number) => new Date(INICIO.getTime() + ms);

  it('nunca se ha sincronizado: libre', () => {
    expect(evaluarCandado(null, INICIO)).toEqual({ libre: true });
  });

  it('las ventanas son de 2 minutos y de 20 segundos tras un fallo', () => {
    expect(VENTANA_CANDADO_MS).toBe(120_000);
    expect(VENTANA_CANDADO_TRAS_FALLO_MS).toBe(20_000);
  });

  describe('tras una sincronizacion exitosa', () => {
    it('a los 30 segundos: cerrado, con el momento exacto en que se abre', () => {
      expect(evaluarCandado(EXITOSA, mas(30_000))).toEqual({
        libre: false,
        motivo: 'SINCRONIZACION_RECIENTE',
        reintentarEn: new Date('2026-09-30T16:02:00.000Z'),
      });
    });

    it('un milisegundo antes de los 2 minutos sigue cerrado', () => {
      expect(evaluarCandado(EXITOSA, mas(VENTANA_CANDADO_MS - 1)).libre).toBe(
        false,
      );
    });

    it('justo a los 2 minutos se abre', () => {
      expect(evaluarCandado(EXITOSA, mas(VENTANA_CANDADO_MS))).toEqual({
        libre: true,
      });
    });
  });

  describe('tras una sincronizacion fallida', () => {
    it('a los 10 segundos: cerrado con motivo propio y solo 20 s de espera', () => {
      expect(evaluarCandado(FALLIDA, mas(10_000))).toEqual({
        libre: false,
        motivo: 'SINCRONIZACION_FALLIDA_RECIENTE',
        reintentarEn: new Date('2026-09-30T16:00:20.000Z'),
      });
    });

    it('justo a los 20 segundos se abre (no castiga con los 2 minutos)', () => {
      expect(evaluarCandado(FALLIDA, mas(20_000))).toEqual({ libre: true });
    });
  });

  it('una corrida en curso bloquea con la ventana completa', () => {
    expect(evaluarCandado(EN_CURSO, mas(60_000))).toEqual({
      libre: false,
      motivo: 'SINCRONIZACION_RECIENTE',
      reintentarEn: new Date('2026-09-30T16:02:00.000Z'),
    });
  });

  it('si la ultima quedo en el futuro (reloj que retrocede), sigue cerrado', () => {
    expect(evaluarCandado(EXITOSA, mas(-60_000)).libre).toBe(false);
    expect(evaluarCandado(FALLIDA, mas(-60_000)).libre).toBe(false);
  });
});
