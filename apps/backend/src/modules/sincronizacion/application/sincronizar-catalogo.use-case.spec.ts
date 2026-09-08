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
import { SincronizarCatalogoUseCase } from './sincronizar-catalogo.use-case';

/**
 * Pruebas del caso de uso de sincronizacion de catalogo. Sin HTTP ni Prisma:
 * dobles en memoria de los puertos. El doble de `HandyGateway` simula DOS
 * paginas para verificar que el caso de uso las recorre ambas.
 */

function productoHandy(over: Partial<ProductoHandy> = {}): ProductoHandy {
  return {
    code: 'P-1',
    description: 'Producto 1',
    price: 77.5,
    unit: { code: 'PZA', description: 'Pieza' },
    family: { description: 'Abarrotes' },
    enabled: true,
    lastUpdated: '2026-09-01T10:00:00.000Z',
    ...over,
  };
}

/** Doble de `HandyGateway`: sirve las paginas que se le configuran y anota cada pagina pedida. */
class FakeHandyGateway extends HandyGateway {
  readonly paginasPedidasProductos: number[] = [];

  constructor(private readonly paginasProductos: PaginaHandy<ProductoHandy>[]) {
    super();
  }

  async listarProductos(pagina: number): Promise<PaginaHandy<ProductoHandy>> {
    this.paginasPedidasProductos.push(pagina);
    const indice = pagina - 1;
    return (
      this.paginasProductos[indice] ?? {
        items: [],
        totalPaginas: this.paginasProductos.length,
        totalRegistros: 0,
      }
    );
  }

  listarVendedores(): Promise<PaginaHandy<UsuarioHandyDto>> {
    throw new Error('no usado en estas pruebas');
  }
}

/** Doble de `CatalogoRepository`: acumula todo lo que recibe cada upsert. */
class FakeCatalogoRepository implements CatalogoRepository {
  readonly lotesProductos: ProductoLocal[][] = [];

  async upsertProductos(productos: ProductoLocal[]): Promise<void> {
    this.lotesProductos.push(productos);
  }

  async upsertVendedores(_vendedores: VendedorHandyLocal[]): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
}

describe('SincronizarCatalogoUseCase', () => {
  it('recorre las dos paginas y sincroniza todos los productos', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [
          productoHandy({ code: 'P-1', price: 77.5 }),
          productoHandy({ code: 'P-2', price: 16.25 }),
        ],
        totalPaginas: 2,
        totalRegistros: 3,
      },
      {
        items: [productoHandy({ code: 'P-3', price: 200 })],
        totalPaginas: 2,
        totalRegistros: 3,
      },
    ]);
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarCatalogoUseCase(handy, catalogo);

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasProductos).toEqual([1, 2]);
    expect(resultado).toEqual({
      productosSincronizados: 3,
      paginasProcesadas: 2,
    });
    // Un upsert por pagina, con los productos de esa pagina.
    expect(catalogo.lotesProductos.map((l) => l.map((p) => p.code))).toEqual([
      ['P-1', 'P-2'],
      ['P-3'],
    ]);
  });

  it('convierte price decimal a centavos enteros', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [
          productoHandy({ code: 'P-1', price: 77.5 }),
          productoHandy({ code: 'P-2', price: 16.25 }),
        ],
        totalPaginas: 2,
        totalRegistros: 3,
      },
      {
        items: [productoHandy({ code: 'P-3', price: 0.1 + 0.2 })],
        totalPaginas: 2,
        totalRegistros: 3,
      },
    ]);
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarCatalogoUseCase(handy, catalogo);

    await useCase.ejecutar();

    const porCodigo = new Map(
      catalogo.lotesProductos.flat().map((p) => [p.code, p.precioCentavos]),
    );
    expect(porCodigo.get('P-1')).toBe(7750);
    expect(porCodigo.get('P-2')).toBe(1625);
    // Sin arrastrar el error de punto flotante de 0.1 + 0.2.
    expect(porCodigo.get('P-3')).toBe(30);
  });

  it('mapea unit, family, enabled y lastUpdated al formato local', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [
          productoHandy({
            code: 'P-9',
            description: 'Refresco 600ml',
            unit: { code: 'BOT', description: 'Botella' },
            family: { description: 'Bebidas' },
            enabled: false,
            lastUpdated: '2026-08-20T12:30:00.000Z',
          }),
        ],
        totalPaginas: 1,
        totalRegistros: 1,
      },
    ]);
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarCatalogoUseCase(handy, catalogo);

    await useCase.ejecutar();

    const producto = catalogo.lotesProductos[0][0];
    expect(producto).toEqual({
      code: 'P-9',
      nombre: 'Refresco 600ml',
      precioCentavos: 7750,
      unidadCode: 'BOT',
      unidadDescripcion: 'Botella',
      familia: 'Bebidas',
      activo: false, // enabled: false => activo: false, sin eliminar
      lastUpdatedHandy: new Date('2026-08-20T12:30:00.000Z'),
    });
  });

  it('usa unit.code como respaldo cuando unit.description viene null', async () => {
    // Caso verificado: producto MARUCHAN codigo 805 llega con
    // `unit: { code: 'PIEZA', description: null }`. Sin respaldo, el upsert de
    // Prisma fallaba con "Argument unidadDescripcion is missing".
    const handy = new FakeHandyGateway([
      {
        items: [
          productoHandy({
            code: '805',
            description: 'MARUCHAN',
            unit: { code: 'PIEZA', description: null },
          }),
        ],
        totalPaginas: 1,
        totalRegistros: 1,
      },
    ]);
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarCatalogoUseCase(handy, catalogo);

    await useCase.ejecutar();

    const producto = catalogo.lotesProductos[0][0];
    expect(producto.unidadCode).toBe('PIEZA');
    expect(producto.unidadDescripcion).toBe('PIEZA');
    expect(producto.unidadDescripcion).not.toBeUndefined();
  });

  it('para una sola pagina hace una unica lectura', async () => {
    const handy = new FakeHandyGateway([
      {
        items: [productoHandy()],
        totalPaginas: 1,
        totalRegistros: 1,
      },
    ]);
    const catalogo = new FakeCatalogoRepository();
    const useCase = new SincronizarCatalogoUseCase(handy, catalogo);

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasProductos).toEqual([1]);
    expect(resultado).toEqual({
      productosSincronizados: 1,
      paginasProcesadas: 1,
    });
  });
});
