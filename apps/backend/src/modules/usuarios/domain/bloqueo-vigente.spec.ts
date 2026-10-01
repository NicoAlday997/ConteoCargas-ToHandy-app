import { bloqueoVigente } from './bloqueo-vigente';

const AHORA = new Date('2026-10-01T06:00:00-06:00');

describe('bloqueoVigente', () => {
  it('null si nunca se bloqueo', () => {
    expect(bloqueoVigente(null, AHORA)).toBeNull();
  });

  it('null si el bloqueo ya vencio, aunque siga guardado', () => {
    expect(
      bloqueoVigente(new Date('2026-10-01T05:59:59-06:00'), AHORA),
    ).toBeNull();
  });

  it('null justo en el instante en que vence', () => {
    expect(bloqueoVigente(AHORA, AHORA)).toBeNull();
  });

  it('vigente: hasta es el guardado y desde, 15 minutos antes', () => {
    const hasta = new Date('2026-10-01T06:12:00-06:00');

    expect(bloqueoVigente(hasta, AHORA)).toEqual({
      desde: new Date('2026-10-01T05:57:00-06:00'),
      hasta,
    });
  });
});
