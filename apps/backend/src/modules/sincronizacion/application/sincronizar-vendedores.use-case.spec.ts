import { CatalogoEnMemoria } from './catalogo-en-memoria.fake-spec';
import {
  HandyGateway,
  type PaginaHandy,
  type ProductoHandy,
  type UsuarioHandyDto,
} from './handy.gateway';
import { SincronizarVendedoresUseCase } from './sincronizar-vendedores.use-case';

/**
 * Pruebas del caso de uso de sincronizacion de vendedores. Dobles en memoria de
 * los puertos; el doble de `HandyGateway` simula DOS paginas.
 */

function usuarioHandy(over: Partial<UsuarioHandyDto> = {}): UsuarioHandyDto {
  return {
    id: 1,
    name: 'Vendedor Uno',
    email: 'uno@ruta.mx',
    enabled: true,
    role: { id: 4, authority: 'ROLE_SALES' },
    lastUpdated: '2026-09-01T10:00:00.000Z',
    pictureUrl: 'https://cdn.handy.la/web-app/sales/user-profile.png',
    ...over,
  };
}

class FakeHandyGateway extends HandyGateway {
  readonly paginasPedidasVendedores: number[] = [];

  constructor(
    private readonly paginasVendedores: PaginaHandy<UsuarioHandyDto>[],
  ) {
    super();
  }

  listarProductos(): Promise<PaginaHandy<ProductoHandy>> {
    throw new Error('no usado en estas pruebas');
  }

  async listarVendedores(
    pagina: number,
  ): Promise<PaginaHandy<UsuarioHandyDto>> {
    this.paginasPedidasVendedores.push(pagina);
    return (
      this.paginasVendedores[pagina - 1] ?? {
        items: [],
        totalPaginas: this.paginasVendedores.length,
        totalRegistros: 0,
      }
    );
  }

  consultarRutaAbierta(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  crearRuta(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  recargarRuta(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  cancelarRuta(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

describe('SincronizarVendedoresUseCase', () => {
  it('recorre las dos paginas y sincroniza todos los vendedores', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [usuarioHandy({ id: 1 }), usuarioHandy({ id: 2 })],
        totalPaginas: 2,
        totalRegistros: 3,
      },
      {
        items: [usuarioHandy({ id: 3 })],
        totalPaginas: 2,
        totalRegistros: 3,
      },
    ]);
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarVendedoresUseCase(handy, catalogo);

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasVendedores).toEqual([1, 2]);
    expect(resultado).toEqual({
      nuevos: 3,
      actualizados: 0,
      desactivados: 0,
      desactivacionRetenida: null,
    });
    expect(
      catalogo.lotesVendedores.map((l) => l.map((v) => v.idHandy)),
    ).toEqual([[1, 2], [3]]);
  });

  it('mapea id, name, email, role.id y role.authority al formato local', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [
          usuarioHandy({
            id: 42,
            name: 'Ana Ruta Sur',
            email: 'ana@ruta.mx',
            enabled: false,
            role: { id: 4, authority: 'ROLE_SALES' },
          }),
        ],
        totalPaginas: 1,
        totalRegistros: 1,
      },
    ]);
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarVendedoresUseCase(handy, catalogo);

    await useCase.ejecutar();

    expect(catalogo.lotesVendedores[0][0]).toEqual({
      idHandy: 42,
      nombre: 'Ana Ruta Sur',
      email: 'ana@ruta.mx',
      rolHandyId: 4,
      rolHandyAuthority: 'ROLE_SALES',
      activo: false,
      fotoUrl: null,
    });
  });

  it('normaliza un email ausente a null', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [usuarioHandy({ id: 7, email: undefined as unknown as string })],
        totalPaginas: 1,
        totalRegistros: 1,
      },
    ]);
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarVendedoresUseCase(handy, catalogo);

    await useCase.ejecutar();

    expect(catalogo.lotesVendedores[0][0].email).toBeNull();
  });

  describe('foto de perfil', () => {
    const FOTO =
      'https://handy-prod.s3.amazonaws.com/profile-pictures/42/ana.jpg';
    const SILUETA = 'https://cdn.handy.la/web-app/sales/user-profile.png';

    async function sincronizar(usuario: UsuarioHandyDto) {
      const handy = new FakeHandyGateway([
        { items: [usuario], totalPaginas: 1, totalRegistros: 1 },
      ]);
      const catalogo = new CatalogoEnMemoria();
      await new SincronizarVendedoresUseCase(handy, catalogo).ejecutar();
      return catalogo.lotesVendedores[0][0];
    }

    it('un vendedor con foto real la guarda', async () => {
      const local = await sincronizar(usuarioHandy({ pictureUrl: FOTO }));
      expect(local.fotoUrl).toBe(FOTO);
    });

    it('con la silueta generica de Handy guarda null', async () => {
      const local = await sincronizar(
        usuarioHandy({ pictureUrl: `${SILUETA}?v=2` }),
      );
      expect(local.fotoUrl).toBeNull();
    });

    it('lee el pictureUrl de primer nivel, no el de createdBy / lastUpdatedBy', async () => {
      const usuario = {
        ...usuarioHandy({ pictureUrl: FOTO }),
        createdBy: { pictureUrl: SILUETA },
        lastUpdatedBy: { pictureUrl: 'https://otra.foto/admin.jpg' },
      } as UsuarioHandyDto;
      const local = await sincronizar(usuario);
      expect(local.fotoUrl).toBe(FOTO);
    });

    it('si Handy deja de mandar el campo, no toca la foto guardada', async () => {
      const sinCampo: Partial<UsuarioHandyDto> = usuarioHandy();
      delete sinCampo.pictureUrl;
      expect(
        (await sincronizar(sinCampo as UsuarioHandyDto)).fotoUrl,
      ).toBeUndefined();
      expect(
        (await sincronizar(usuarioHandy({ pictureUrl: null }))).fotoUrl,
      ).toBeUndefined();
    });
  });

  describe('que cambio', () => {
    const FOTO = 'https://handy-prod.s3.amazonaws.com/profile-pictures/1/uno.jpg';

    async function sincronizar(
      catalogo: CatalogoEnMemoria,
      items: UsuarioHandyDto[],
    ) {
      const handy = new FakeHandyGateway([
        { items, totalPaginas: 1, totalRegistros: items.length },
      ]);
      return new SincronizarVendedoresUseCase(handy, catalogo).ejecutar();
    }

    it('sin cambios en Handy no cuenta nada', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarVendedor({ idHandy: 1 });

      const resultado = await sincronizar(catalogo, [usuarioHandy({ id: 1 })]);

      expect(resultado).toEqual(
        expect.objectContaining({ nuevos: 0, actualizados: 0, desactivados: 0 }),
      );
    });

    it('un vendedor dado de alta en Handy cuenta como nuevo', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarVendedor({ idHandy: 1 });

      const resultado = await sincronizar(catalogo, [
        usuarioHandy({ id: 1 }),
        usuarioHandy({ id: 2, name: 'Vendedor Dos' }),
      ]);

      expect(resultado.nuevos).toBe(1);
    });

    it.each([
      ['nombre', { name: 'Vendedor Uno Renombrado' }],
      ['email', { email: 'nuevo@ruta.mx' }],
      ['foto', { pictureUrl: FOTO }],
    ])(
      'cuenta como actualizado un cambio de %s',
      async (_campo, cambio: Partial<UsuarioHandyDto>) => {
        const catalogo = new CatalogoEnMemoria();
        catalogo.sembrarVendedor({ idHandy: 1 });

        const resultado = await sincronizar(catalogo, [
          usuarioHandy({ id: 1, ...cambio }),
        ]);

        expect(resultado.actualizados).toBe(1);
      },
    );

    it('si Handy no manda la foto no cuenta como cambio', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarVendedor({ idHandy: 1, fotoUrl: FOTO });

      const resultado = await sincronizar(catalogo, [
        usuarioHandy({ id: 1, pictureUrl: null }),
      ]);

      expect(resultado.actualizados).toBe(0);
    });

    it('desactiva al vendedor que Handy ya no lista', async () => {
      const catalogo = new CatalogoEnMemoria();
      for (let id = 1; id <= 5; id += 1) catalogo.sembrarVendedor({ idHandy: id });

      const resultado = await sincronizar(
        catalogo,
        [1, 2, 3, 4].map((id) => usuarioHandy({ id })),
      );

      expect(resultado.desactivados).toBe(1);
      expect(catalogo.vendedoresDesactivados).toEqual([5]);
    });

    it('no desactiva a nadie si Handy no devolvio ningun vendedor', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarVendedor({ idHandy: 1 });

      const resultado = await sincronizar(catalogo, []);

      expect(resultado.desactivacionRetenida).toEqual(
        expect.objectContaining({ motivo: 'SIN_REGISTROS' }),
      );
      expect(catalogo.vendedoresDesactivados).toEqual([]);
    });
  });
});
