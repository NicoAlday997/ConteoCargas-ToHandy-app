import {
  exigirEntornoValido,
  mensajeProblemasEntorno,
  revisarEntorno,
} from './entorno';

const ENTORNO_VALIDO = {
  DATABASE_URL: 'postgresql://usuario:clave-super-secreta@db:5432/handy',
  JWT_SECRET: 'x'.repeat(32),
  HANDY_API_TOKEN: 'token-secreto-de-handy',
  HANDY_API_BASE_URL: 'https://hub.handy.la/api/v2',
  NODE_ENV: 'production',
  TZ: 'America/Mexico_City',
};

describe('revisarEntorno', () => {
  it('con todas las variables bien no reporta nada', () => {
    expect(revisarEntorno(ENTORNO_VALIDO)).toEqual([]);
  });

  it('reporta cada variable obligatoria que falta', () => {
    expect(revisarEntorno({})).toEqual([
      { variable: 'DATABASE_URL', tipo: 'falta' },
      { variable: 'JWT_SECRET', tipo: 'falta' },
      { variable: 'HANDY_API_TOKEN', tipo: 'falta' },
      { variable: 'HANDY_API_BASE_URL', tipo: 'falta' },
      { variable: 'NODE_ENV', tipo: 'falta' },
      { variable: 'TZ', tipo: 'falta' },
    ]);
  });

  it('vacia o solo espacios cuenta como que falta', () => {
    expect(
      revisarEntorno({ ...ENTORNO_VALIDO, JWT_SECRET: '', HANDY_API_TOKEN: '  ' }),
    ).toEqual([
      { variable: 'JWT_SECRET', tipo: 'falta' },
      { variable: 'HANDY_API_TOKEN', tipo: 'falta' },
    ]);
  });

  it('JWT_SECRET de menos de 32 caracteres es invalido', () => {
    expect(
      revisarEntorno({ ...ENTORNO_VALIDO, JWT_SECRET: 'x'.repeat(31) }),
    ).toEqual([{ variable: 'JWT_SECRET', tipo: 'invalida' }]);
  });

  it('TZ distinta de America/Mexico_City es invalida', () => {
    expect(revisarEntorno({ ...ENTORNO_VALIDO, TZ: 'UTC' })).toEqual([
      { variable: 'TZ', tipo: 'invalida' },
    ]);
  });

  it('rechaza DATABASE_URL, HANDY_API_BASE_URL y NODE_ENV mal formadas', () => {
    expect(
      revisarEntorno({
        ...ENTORNO_VALIDO,
        DATABASE_URL: 'mysql://localhost/x',
        HANDY_API_BASE_URL: 'no es url',
        NODE_ENV: 'produccion',
      }),
    ).toEqual([
      { variable: 'DATABASE_URL', tipo: 'invalida' },
      { variable: 'HANDY_API_BASE_URL', tipo: 'invalida' },
      { variable: 'NODE_ENV', tipo: 'invalida' },
    ]);
  });
});

describe('mensajeProblemasEntorno', () => {
  it('nombra las variables pero nunca imprime sus valores', () => {
    const entorno = {
      ...ENTORNO_VALIDO,
      JWT_SECRET: 'secreto-corto',
      HANDY_API_TOKEN: undefined,
      DATABASE_URL: 'mysql://usuario:clave-super-secreta@db/x',
    };
    const mensaje = mensajeProblemasEntorno(revisarEntorno(entorno));

    expect(mensaje).toContain('Faltan: HANDY_API_TOKEN.');
    expect(mensaje).toContain(
      'JWT_SECRET no es valida: debe tener al menos 32 caracteres.',
    );
    expect(mensaje).toContain('DATABASE_URL no es valida');
    expect(mensaje).not.toContain('secreto-corto');
    expect(mensaje).not.toContain('clave-super-secreta');
  });
});

describe('exigirEntornoValido', () => {
  let salir: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    salir = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    salir.mockRestore();
    error.mockRestore();
  });

  it('con el entorno completo no termina el proceso', () => {
    exigirEntornoValido(ENTORNO_VALIDO);

    expect(salir).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('si falta algo escribe el motivo y termina con codigo 1', () => {
    exigirEntornoValido({ ...ENTORNO_VALIDO, JWT_SECRET: undefined });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Faltan: JWT_SECRET.'),
    );
    expect(salir).toHaveBeenCalledWith(1);
  });
});
