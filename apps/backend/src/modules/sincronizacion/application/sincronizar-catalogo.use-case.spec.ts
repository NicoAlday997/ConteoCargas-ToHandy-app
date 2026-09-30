import { CatalogoEnMemoria } from './catalogo-en-memoria.fake-spec';
import type {
  DatosConfirmarFactor,
  FactorEmpaqueRepository,
  FactorDeCatalogo,
  FactorGuardado,
  FactorPendiente,
  FactorProducto,
} from './factor-empaque.repository';
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

/**
 * Doble de `FactorEmpaqueRepository`: sirve los factores ya guardados que se
 * le siembran y un conteo fijo de pendientes.
 */
class FakeFactorEmpaqueRepository implements FactorEmpaqueRepository {
  readonly guardados = new Map<string, FactorGuardado>();
  pendientes = 0;

  async buscarFactores(codes: string[]): Promise<Map<string, FactorGuardado>> {
    return new Map(
      codes
        .filter((c) => this.guardados.has(c))
        .map((c) => [c, this.guardados.get(c)!]),
    );
  }

  async contarPendientes(): Promise<number> {
    return this.pendientes;
  }

  listarPendientes(): Promise<FactorPendiente[]> {
    throw new Error('no usado en estas pruebas');
  }
  buscarPorCode(): Promise<FactorProducto | null> {
    throw new Error('no usado en estas pruebas');
  }
  confirmar(_datos: DatosConfirmarFactor): Promise<FactorProducto> {
    throw new Error('no usado en estas pruebas');
  }
  listarTodos(): Promise<FactorDeCatalogo[]> {
    throw new Error('no usado en estas pruebas');
  }
  contarCargasEnCursoConProducto(): Promise<number> {
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
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarCatalogoUseCase(
      handy,
      catalogo,
      new FakeFactorEmpaqueRepository(),
    );

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasProductos).toEqual([1, 2]);
    expect(resultado).toEqual({
      nuevos: 3,
      actualizados: 0,
      desactivados: 0,
      sinConfirmarEmpaque: 0,
      desactivacionRetenida: null,
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
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarCatalogoUseCase(
      handy,
      catalogo,
      new FakeFactorEmpaqueRepository(),
    );

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
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarCatalogoUseCase(
      handy,
      catalogo,
      new FakeFactorEmpaqueRepository(),
    );

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
      // "Refresco 600ml" no trae patron de empaque.
      piezasPorPaquetePropuesto: null,
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
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarCatalogoUseCase(
      handy,
      catalogo,
      new FakeFactorEmpaqueRepository(),
    );

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
    const catalogo = new CatalogoEnMemoria();
    const useCase = new SincronizarCatalogoUseCase(
      handy,
      catalogo,
      new FakeFactorEmpaqueRepository(),
    );

    const resultado = await useCase.ejecutar();

    expect(handy.paginasPedidasProductos).toEqual([1]);
    expect(resultado.nuevos).toBe(1);
  });
  describe('factor de empaque', () => {
    function unaPagina(
      ...items: ProductoHandy[]
    ): PaginaHandy<ProductoHandy>[] {
      return [{ items, totalPaginas: 1, totalRegistros: items.length }];
    }

    async function sincronizar(
      items: ProductoHandy[],
      factores = new FakeFactorEmpaqueRepository(),
    ) {
      const catalogo = new CatalogoEnMemoria();
      const useCase = new SincronizarCatalogoUseCase(
        new FakeHandyGateway(unaPagina(...items)),
        catalogo,
        factores,
      );
      const resultado = await useCase.ejecutar();
      const propuestos = new Map(
        catalogo.lotesProductos
          .flat()
          .map((p) => [p.code, p.piezasPorPaquetePropuesto]),
      );
      return { resultado, propuestos };
    }

    it('propone el factor del nombre para un producto nuevo', async () => {
      const { propuestos } = await sincronizar([
        productoHandy({ code: 'P-1', description: 'PEPSI 1.5 LT C/12' }),
        productoHandy({ code: 'P-2', description: 'CANELS. c/70' }),
      ]);

      expect(propuestos.get('P-1')).toBe(12);
      expect(propuestos.get('P-2')).toBe(70);
    });

    it('propone el factor para un producto existente sin factor guardado', async () => {
      const factores = new FakeFactorEmpaqueRepository();
      factores.guardados.set('P-1', {
        piezasPorPaquete: null,
        factorConfirmado: false,
      });

      const { propuestos } = await sincronizar(
        [
          productoHandy({
            code: 'P-1',
            description: 'BIG COLA 3.000 LT C / 6',
          }),
        ],
        factores,
      );

      expect(propuestos.get('P-1')).toBe(6);
    });

    it('no propone nada si el nombre no trae patron', async () => {
      const { propuestos } = await sincronizar([
        productoHandy({ code: 'P-1', description: 'BLUE RIVERS' }),
      ]);

      expect(propuestos.get('P-1')).toBeNull();
    });

    it('no toca un factor confirmado aunque el nombre cambie', async () => {
      const factores = new FakeFactorEmpaqueRepository();
      factores.guardados.set('P-1', {
        piezasPorPaquete: 12,
        factorConfirmado: true,
      });

      const { propuestos } = await sincronizar(
        // Handy renombro el producto a C/24: la confirmacion humana manda.
        [productoHandy({ code: 'P-1', description: 'PEPSI 1.5 LT C/24' })],
        factores,
      );

      expect(propuestos.get('P-1')).toBeNull();
    });

    it('no reemplaza una propuesta previa sin confirmar', async () => {
      const factores = new FakeFactorEmpaqueRepository();
      factores.guardados.set('P-1', {
        piezasPorPaquete: 12,
        factorConfirmado: false,
      });

      const { propuestos } = await sincronizar(
        [productoHandy({ code: 'P-1', description: 'PEPSI 1.5 LT C/24' })],
        factores,
      );

      expect(propuestos.get('P-1')).toBeNull();
    });

    it('devuelve cuantos productos activos quedaron sin empaque confirmado', async () => {
      const factores = new FakeFactorEmpaqueRepository();
      factores.pendientes = 37;

      const { resultado } = await sincronizar([productoHandy()], factores);

      expect(resultado.sinConfirmarEmpaque).toBe(37);
    });
  });

  describe('que cambio', () => {
    /** Handy lista estos productos (una pagina, todos habilitados). */
    async function sincronizar(
      catalogo: CatalogoEnMemoria,
      items: ProductoHandy[],
      totalRegistros = items.length,
    ) {
      const useCase = new SincronizarCatalogoUseCase(
        new FakeHandyGateway([{ items, totalPaginas: 1, totalRegistros }]),
        catalogo,
        new FakeFactorEmpaqueRepository(),
      );
      return useCase.ejecutar();
    }

    it('una segunda sincronizacion sin cambios en Handy no cuenta nada', async () => {
      const catalogo = new CatalogoEnMemoria();
      const items = [
        productoHandy({ code: 'P-1' }),
        productoHandy({ code: 'P-2' }),
      ];
      await sincronizar(catalogo, items);

      const resultado = await sincronizar(catalogo, items);

      expect(resultado).toEqual(
        expect.objectContaining({ nuevos: 0, actualizados: 0, desactivados: 0 }),
      );
    });

    it('cuenta como nuevo lo que no estaba en el cache', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1', nombre: 'Producto 1' });

      const resultado = await sincronizar(catalogo, [
        productoHandy({ code: 'P-1' }),
        productoHandy({ code: 'P-2' }),
        productoHandy({ code: 'P-3' }),
      ]);

      expect(resultado.nuevos).toBe(2);
      expect(resultado.actualizados).toBe(0);
    });

    it.each([
      ['nombre', { description: 'Producto 1 NUEVO' }],
      ['precio', { price: 80 }],
      ['familia', { family: { description: 'Bebidas' } }],
      ['unidad', { unit: { code: 'CJA', description: 'Caja' } }],
    ])(
      'cuenta como actualizado un cambio de %s',
      async (_campo, cambio: Partial<ProductoHandy>) => {
        const catalogo = new CatalogoEnMemoria();
        catalogo.sembrarProducto({ code: 'P-1' });

        const resultado = await sincronizar(catalogo, [
          productoHandy({ code: 'P-1', ...cambio }),
        ]);

        expect(resultado).toEqual(
          expect.objectContaining({ nuevos: 0, actualizados: 1 }),
        );
      },
    );

    it('solo cambiar lastUpdated en Handy no cuenta como actualizado', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1' });

      const resultado = await sincronizar(catalogo, [
        productoHandy({ code: 'P-1', lastUpdated: '2026-09-29T10:00:00.000Z' }),
      ]);

      expect(resultado.actualizados).toBe(0);
    });

    it('un producto que vuelve a estar habilitado cuenta como actualizado', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1', activo: false });

      const resultado = await sincronizar(catalogo, [
        productoHandy({ code: 'P-1' }),
      ]);

      expect(resultado.actualizados).toBe(1);
      expect(catalogo.productos.get('P-1')?.activo).toBe(true);
    });

    it('cuenta como desactivado lo que Handy reporta deshabilitado', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1' });

      const resultado = await sincronizar(catalogo, [
        productoHandy({ code: 'P-1', enabled: false }),
      ]);

      expect(resultado).toEqual(
        expect.objectContaining({ actualizados: 0, desactivados: 1 }),
      );
    });

    it('desactiva lo activo que Handy ya no lista, sin borrarlo', async () => {
      const catalogo = new CatalogoEnMemoria();
      for (let i = 1; i <= 10; i += 1) {
        catalogo.sembrarProducto({ code: `P-${i}` });
      }
      // Un inactivo que tampoco viene: ya estaba desactivado, no cuenta.
      catalogo.sembrarProducto({ code: 'VIEJO', activo: false });

      const resultado = await sincronizar(
        catalogo,
        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => productoHandy({ code: `P-${i}` })),
      );

      expect(resultado.desactivados).toBe(2);
      expect(resultado.desactivacionRetenida).toBeNull();
      expect(catalogo.productosDesactivados).toEqual(['P-9', 'P-10']);
      expect(catalogo.productos.get('P-9')).toEqual(
        expect.objectContaining({ activo: false }),
      );
    });

    it('no desactiva nada si Handy no devolvio ningun producto', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1' });

      const resultado = await sincronizar(catalogo, [], 0);

      expect(resultado.desactivados).toBe(0);
      expect(resultado.desactivacionRetenida).toEqual({
        motivo: 'SIN_REGISTROS',
        faltantes: 1,
        activos: 1,
      });
      expect(catalogo.productosDesactivados).toEqual([]);
    });

    it('no desactiva nada si desaparece mas del 30 % de golpe', async () => {
      const catalogo = new CatalogoEnMemoria();
      for (let i = 1; i <= 10; i += 1) {
        catalogo.sembrarProducto({ code: `P-${i}` });
      }

      const resultado = await sincronizar(
        catalogo,
        [1, 2, 3, 4, 5, 6].map((i) => productoHandy({ code: `P-${i}` })),
      );

      expect(resultado.desactivados).toBe(0);
      expect(resultado.desactivacionRetenida).toEqual(
        expect.objectContaining({ motivo: 'DEMASIADOS_FALTANTES', faltantes: 4 }),
      );
      expect(catalogo.productosDesactivados).toEqual([]);
    });

    it('no desactiva nada si llegaron menos productos de los que Handy reporto', async () => {
      const catalogo = new CatalogoEnMemoria();
      for (let i = 1; i <= 10; i += 1) {
        catalogo.sembrarProducto({ code: `P-${i}` });
      }

      const resultado = await sincronizar(
        catalogo,
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => productoHandy({ code: `P-${i}` })),
        10,
      );

      expect(resultado.desactivacionRetenida).toEqual(
        expect.objectContaining({ motivo: 'PAGINACION_INCOMPLETA' }),
      );
      expect(catalogo.productosDesactivados).toEqual([]);
    });

    it('si una pagina falla no desactiva nada: el error se propaga', async () => {
      const catalogo = new CatalogoEnMemoria();
      catalogo.sembrarProducto({ code: 'P-1' });
      catalogo.sembrarProducto({ code: 'P-2' });
      class HandyQueFallaEnLaSegunda extends FakeHandyGateway {
        async listarProductos(pagina: number) {
          if (pagina === 2) throw new Error('Handy respondio 503');
          return super.listarProductos(pagina);
        }
      }
      const useCase = new SincronizarCatalogoUseCase(
        new HandyQueFallaEnLaSegunda([
          {
            items: [productoHandy({ code: 'P-1' })],
            totalPaginas: 2,
            totalRegistros: 2,
          },
        ]),
        catalogo,
        new FakeFactorEmpaqueRepository(),
      );

      await expect(useCase.ejecutar()).rejects.toThrow('503');
      expect(catalogo.productosDesactivados).toEqual([]);
      expect(catalogo.productos.get('P-2')?.activo).toBe(true);
    });
  });
});
