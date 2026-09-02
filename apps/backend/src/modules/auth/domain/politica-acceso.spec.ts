import {
  esPinValido,
  estaBloqueado,
  puedeIntentarLogin,
  registrarIntentoFallido,
  registrarIntentoExitoso,
  MAX_INTENTOS_FALLIDOS,
  EstadoAcceso,
} from './politica-acceso';

const AHORA = new Date('2026-09-01T20:00:00-06:00');

const estadoLimpio: EstadoAcceso = {
  activo: true,
  intentosFallidos: 0,
  bloqueadoHasta: null,
};

describe('esPinValido', () => {
  it('acepta exactamente 4 digitos', () => {
    expect(esPinValido('1234')).toBe(true);
    expect(esPinValido('0000')).toBe(true);
  });

  it('rechaza longitudes distintas de 4', () => {
    expect(esPinValido('123')).toBe(false);
    expect(esPinValido('12345')).toBe(false);
    expect(esPinValido('')).toBe(false);
  });

  it('rechaza caracteres no numericos', () => {
    expect(esPinValido('12a4')).toBe(false);
    expect(esPinValido('12 4')).toBe(false);
  });
});

describe('registrarIntentoFallido', () => {
  it('incrementa el contador sin bloquear antes del maximo', () => {
    const resultado = registrarIntentoFallido(estadoLimpio, AHORA);
    expect(resultado.intentosFallidos).toBe(1);
    expect(resultado.bloqueadoHasta).toBeNull();
  });

  it('bloquea al alcanzar el maximo de intentos', () => {
    let estado = estadoLimpio;
    for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) {
      estado = registrarIntentoFallido(estado, AHORA);
    }
    expect(estado.intentosFallidos).toBe(MAX_INTENTOS_FALLIDOS);
    expect(estado.bloqueadoHasta).not.toBeNull();
  });

  it('no muta el estado original', () => {
    registrarIntentoFallido(estadoLimpio, AHORA);
    expect(estadoLimpio.intentosFallidos).toBe(0);
  });
});

describe('estaBloqueado', () => {
  it('es falso cuando no hay fecha de bloqueo', () => {
    expect(estaBloqueado(estadoLimpio, AHORA)).toBe(false);
  });

  it('es verdadero mientras el bloqueo no expira', () => {
    const estado: EstadoAcceso = {
      ...estadoLimpio,
      bloqueadoHasta: new Date(AHORA.getTime() + 60_000),
    };
    expect(estaBloqueado(estado, AHORA)).toBe(true);
  });

  it('es falso cuando el bloqueo ya expiro', () => {
    const estado: EstadoAcceso = {
      ...estadoLimpio,
      bloqueadoHasta: new Date(AHORA.getTime() - 60_000),
    };
    expect(estaBloqueado(estado, AHORA)).toBe(false);
  });
});

describe('puedeIntentarLogin', () => {
  it('permite a un usuario activo sin bloqueo', () => {
    expect(puedeIntentarLogin(estadoLimpio, AHORA)).toBe(true);
  });

  it('rechaza a un usuario inactivo aunque no este bloqueado', () => {
    const estado: EstadoAcceso = { ...estadoLimpio, activo: false };
    expect(puedeIntentarLogin(estado, AHORA)).toBe(false);
  });

  it('rechaza a un usuario con bloqueo vigente', () => {
    const estado: EstadoAcceso = {
      ...estadoLimpio,
      bloqueadoHasta: new Date(AHORA.getTime() + 60_000),
    };
    expect(puedeIntentarLogin(estado, AHORA)).toBe(false);
  });
});

describe('registrarIntentoExitoso', () => {
  it('limpia contador y bloqueo previos', () => {
    const estado: EstadoAcceso = {
      activo: true,
      intentosFallidos: 3,
      bloqueadoHasta: new Date(AHORA.getTime() + 60_000),
    };
    const resultado = registrarIntentoExitoso(estado);
    expect(resultado.intentosFallidos).toBe(0);
    expect(resultado.bloqueadoHasta).toBeNull();
  });
});
