import type {
  CatalogoRepository,
  ProductoLocal,
  VendedorHandyLocal,
} from './catalogo.repository';
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

class FakeCatalogoRepository implements CatalogoRepository {
  readonly lotesVendedores: VendedorHandyLocal[][] = [];

  async upsertProductos(_productos: ProductoLocal[]): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  async upsertVendedores(vendedores: VendedorHandyLocal[]): Promise<void> {
    this.lotesVendedores.push(vendedores);
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
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarVendedoresUseCase(handy, catalogo);

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasVendedores).toEqual([1, 2]);
    expect(resultado).toEqual({
      vendedoresSincronizados: 3,
      paginasProcesadas: 2,
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
    const catalogo = new FakeCatalogoRepository();
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
    const catalogo = new FakeCatalogoRepository();
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
      const catalogo = new FakeCatalogoRepository();
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
});
