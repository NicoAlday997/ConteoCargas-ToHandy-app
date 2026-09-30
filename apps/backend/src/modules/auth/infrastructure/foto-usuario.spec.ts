import { conFotoDeHandy } from './foto-usuario';

const FOTO = 'https://handy-prod.s3.amazonaws.com/profile-pictures/42/ana.jpg';

describe('conFotoDeHandy', () => {
  it('un vendedor vinculado con foto la recibe como fotoUrl', () => {
    expect(
      conFotoDeHandy({
        id: 'v-1',
        nombreCompleto: 'Ana Vendedora',
        usuarioHandyId: 42,
        usuarioHandy: { fotoUrl: FOTO },
      }),
    ).toEqual({
      id: 'v-1',
      nombreCompleto: 'Ana Vendedora',
      usuarioHandyId: 42,
      fotoUrl: FOTO,
    });
  });

  it('un vendedor sin foto en Handy responde null', () => {
    expect(
      conFotoDeHandy({ id: 'v-2', usuarioHandy: { fotoUrl: null } }).fotoUrl,
    ).toBeNull();
  });

  it('un rol sin usuarioHandyId (contador, supervisor) responde null sin tronar', () => {
    const usuario = conFotoDeHandy({
      id: 's-1',
      rolApp: 'SUPERVISOR',
      usuarioHandyId: null,
      usuarioHandy: null,
    });
    expect(usuario.fotoUrl).toBeNull();
    expect(usuario).not.toHaveProperty('usuarioHandy');
  });
});
