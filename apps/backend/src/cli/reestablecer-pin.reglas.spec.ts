import {
  buscarCandidato,
  confirmacionValida,
  describirBase,
  validarArgumentos,
  type CandidatoRestablecer,
} from './reestablecer-pin.reglas';

function persona(id: string, nombreCompleto: string): CandidatoRestablecer {
  return { id, nombreCompleto, rolApp: 'VENDEDOR', activo: true };
}

const PERSONAS = [
  persona('u-1', 'Ana Ramírez'),
  persona('u-2', 'Ana María López'),
  persona('u-3', 'Irvin Gómez'),
];

describe('validarArgumentos', () => {
  it('acepta usuario y motivo de al menos 10 caracteres, ya limpios', () => {
    expect(
      validarArgumentos('  Irvin Gómez ', '  Olvido su PIN y no hay otro  '),
    ).toEqual({
      ok: true,
      usuario: 'Irvin Gómez',
      motivo: 'Olvido su PIN y no hay otro',
    });
  });

  it.each([undefined, '', '   '])('rechaza sin usuario (%p)', (usuario) => {
    const r = validarArgumentos(usuario, 'motivo suficiente');
    expect(r.ok).toBe(false);
  });

  it.each([undefined, '', '    ', 'olvido', '  abcdefghi  '])(
    'rechaza sin motivo de 10 caracteres (%p) y explica por que',
    (motivo) => {
      const r = validarArgumentos('Irvin', motivo);
      expect(r).toEqual({
        ok: false,
        error: expect.stringContaining('unica explicacion'),
      });
    },
  );
});

describe('buscarCandidato', () => {
  it('encuentra a una sola persona por un pedazo, sin acentos ni mayusculas', () => {
    expect(buscarCandidato(PERSONAS, 'IRVIN gomez')).toEqual({
      tipo: 'UNICO',
      usuario: PERSONAS[2],
    });
  });

  it('con varias parecidas no adivina, aunque una sea identica', () => {
    expect(buscarCandidato(PERSONAS, 'ana')).toEqual({
      tipo: 'VARIOS',
      coincidencias: [PERSONAS[0], PERSONAS[1]],
    });
  });

  it('el id desempata', () => {
    expect(buscarCandidato(PERSONAS, 'u-2')).toEqual({
      tipo: 'UNICO',
      usuario: PERSONAS[1],
    });
  });

  it('sin coincidencias responde NINGUNO', () => {
    expect(buscarCandidato(PERSONAS, 'Pedro')).toEqual({ tipo: 'NINGUNO' });
  });
});

describe('confirmacionValida', () => {
  it('pide el nombre completo; acentos, mayusculas y espacios no importan', () => {
    expect(confirmacionValida(PERSONAS[0], '  ana   ramirez ')).toBe(true);
  });

  it.each(['', 'Ana', 'Ana María López'])(
    'rechaza un pedazo u otro nombre (%p)',
    (escrito) => {
      expect(confirmacionValida(PERSONAS[0], escrito)).toBe(false);
    },
  );
});

describe('describirBase', () => {
  it('muestra host, puerto y base, nunca usuario ni contrasena', () => {
    const texto = describirBase(
      'postgresql://usuario:secreta@dpg-abc.oregon-postgres.render.com:5432/handy_conteo',
    );
    expect(texto).toBe('dpg-abc.oregon-postgres.render.com:5432/handy_conteo');
    expect(texto).not.toContain('secreta');
  });
});
