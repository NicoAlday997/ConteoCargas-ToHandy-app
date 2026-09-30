import type { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  HandyGateway,
  type PaginaHandy,
  type ProductoHandy,
  type UsuarioHandyDto,
} from '../application/handy.gateway';
import { SincronizarCatalogoUseCase } from '../application/sincronizar-catalogo.use-case';
import { PrismaCatalogoRepository } from './prisma-catalogo.repository';
import { PrismaFactorEmpaqueRepository } from './prisma-factor-empaque.repository';

/**
 * INVARIANTE: la sincronizacion NUNCA modifica `modalidadVenta` ni
 * `piezasPorPaquete` de un producto con `factorConfirmado = true`.
 *
 * Corre sola a las 5:00 sin nadie mirando: si pisara una confirmacion, los
 * conteos de ese producto se convertirian mal en silencio (el doble conteo no
 * lo detecta, ambos usan el mismo factor). Por eso esta prueba no usa dobles
 * de los puertos: corre el caso de uso REAL contra los adaptadores Prisma
 * REALES, sobre una tabla `producto` en memoria que aplica los `upsert` y
 * `updateMany` como la base de datos (incluido su `where`).
 *
 * Nest 12 se publica como ESM y jest (CommonJS) no lo puede cargar: se
 * sustituyen solo el decorador `@Injectable` y la clase `PrismaService`, que
 * aqui no hacen nada. El codigo de los adaptadores que se prueba es el real.
 */
jest.mock('@nestjs/common', () => ({ Injectable: () => () => undefined }));
jest.mock('../../../shared/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

type Fila = Record<string, unknown> & { code: string };

function coincide(fila: Fila, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([campo, condicion]) => {
    if (
      condicion !== null &&
      typeof condicion === 'object' &&
      'in' in (condicion as object)
    ) {
      return (condicion as { in: unknown[] }).in.includes(fila[campo]);
    }
    return fila[campo] === condicion;
  });
}

/** Solo lo que usan los adaptadores de productos. */
class TablaProductos {
  readonly filas = new Map<string, Fila>();

  findMany = async ({ where }: { where?: Record<string, unknown> }) =>
    [...this.filas.values()].filter((f) => coincide(f, where)).map((f) => ({ ...f }));

  count = async ({ where }: { where?: Record<string, unknown> }) =>
    [...this.filas.values()].filter((f) => coincide(f, where)).length;

  upsert = async ({
    where,
    create,
    update,
  }: {
    where: { code: string };
    create: Fila;
    update: Record<string, unknown>;
  }) => {
    const actual = this.filas.get(where.code);
    const nueva = actual ? { ...actual, ...update } : { ...create };
    this.filas.set(where.code, nueva as Fila);
    return nueva;
  };

  updateMany = async ({
    where,
    data,
  }: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => {
    let count = 0;
    for (const [code, fila] of this.filas) {
      if (coincide(fila, where)) {
        this.filas.set(code, { ...fila, ...data });
        count += 1;
      }
    }
    return { count };
  };
}

function prismaEnMemoria(productos: TablaProductos): PrismaService {
  return {
    producto: productos,
    $transaction: (operaciones: Promise<unknown>[]) => Promise.all(operaciones),
  } as unknown as PrismaService;
}

class HandyConProductos extends HandyGateway {
  constructor(private readonly productos: ProductoHandy[]) {
    super();
  }
  async listarProductos(): Promise<PaginaHandy<ProductoHandy>> {
    return {
      items: this.productos,
      totalPaginas: 1,
      totalRegistros: this.productos.length,
    };
  }
  listarVendedores(): Promise<PaginaHandy<UsuarioHandyDto>> {
    throw new Error('no usado');
  }
  consultarRutaAbierta(): Promise<never> {
    throw new Error('no usado');
  }
  crearRuta(): Promise<never> {
    throw new Error('no usado');
  }
  recargarRuta(): Promise<never> {
    throw new Error('no usado');
  }
  cancelarRuta(): Promise<never> {
    throw new Error('no usado');
  }
}

function productoHandy(code: string, over: Partial<ProductoHandy> = {}): ProductoHandy {
  return {
    code,
    description: `Producto ${code}`,
    price: 10,
    unit: { code: 'PZA', description: 'Pieza' },
    family: { description: 'Abarrotes' },
    enabled: true,
    lastUpdated: '2026-09-01T10:00:00.000Z',
    ...over,
  };
}

function filaProducto(code: string, over: Partial<Fila> = {}): Fila {
  return {
    code,
    nombre: `Producto ${code}`,
    precioCentavos: 1000,
    unidadCode: 'PZA',
    unidadDescripcion: 'Pieza',
    familia: 'Abarrotes',
    activo: true,
    modalidadVenta: 'POR_PIEZA',
    piezasPorPaquete: null,
    factorConfirmado: false,
    ...over,
  };
}

const FACTOR = ['modalidadVenta', 'piezasPorPaquete', 'factorConfirmado'] as const;
const factorDe = (fila: Fila | undefined) =>
  Object.fromEntries(FACTOR.map((c) => [c, fila?.[c]]));

describe('Sincronizacion y empaque confirmado (invariante)', () => {
  let tabla: TablaProductos;
  let sincronizar: (productos: ProductoHandy[]) => Promise<unknown>;

  beforeEach(() => {
    tabla = new TablaProductos();
    const prisma = prismaEnMemoria(tabla);
    sincronizar = (productos) =>
      new SincronizarCatalogoUseCase(
        new HandyConProductos(productos),
        new PrismaCatalogoRepository(prisma),
        new PrismaFactorEmpaqueRepository(prisma),
      ).ejecutar();

    // Confirmado por pieza: 12 por paquete.
    tabla.filas.set(
      'PEPSI',
      filaProducto('PEPSI', {
        nombre: 'PEPSI 1.5 LT C/12',
        piezasPorPaquete: 12,
        factorConfirmado: true,
      }),
    );
    // Confirmado como completo: el "c/70" del nombre no es factor.
    tabla.filas.set(
      'CANELS',
      filaProducto('CANELS', {
        nombre: 'CANELS. c/70',
        modalidadVenta: 'COMPLETO',
        piezasPorPaquete: null,
        factorConfirmado: true,
      }),
    );
    // Relleno para que desactivar uno no dispare el candado del 30 %.
    for (let i = 1; i <= 8; i += 1) {
      tabla.filas.set(`X-${i}`, filaProducto(`X-${i}`));
    }
  });

  it('Handy cambia nombre, precio, unidad y familia: el factor confirmado no se mueve', async () => {
    const antes = { PEPSI: factorDe(tabla.filas.get('PEPSI')), CANELS: factorDe(tabla.filas.get('CANELS')) };

    const handy = [
      // El nombre ahora dice C/24 y ya no tiene factor: la confirmacion manda.
      productoHandy('PEPSI', {
        description: 'PEPSI 1.5 LT C/24',
        price: 250,
        unit: { code: 'CJA', description: 'Caja' },
        family: { description: 'Bebidas' },
      }),
      productoHandy('CANELS', { description: 'CANELS. c/100', price: 99 }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => productoHandy(`X-${i}`)),
    ];
    // Dos corridas seguidas, como el automatico de un dia y el del siguiente.
    await sincronizar(handy);
    await sincronizar(handy);

    expect(factorDe(tabla.filas.get('PEPSI'))).toEqual(antes.PEPSI);
    expect(factorDe(tabla.filas.get('CANELS'))).toEqual(antes.CANELS);
    // Lo demas si se actualizo: la prueba no pasa por no haber escrito nada.
    expect(tabla.filas.get('PEPSI')?.nombre).toBe('PEPSI 1.5 LT C/24');
    expect(tabla.filas.get('PEPSI')?.precioCentavos).toBe(25000);
  });

  it('un confirmado que Handy deja de listar se desactiva sin tocar su factor', async () => {
    const antes = factorDe(tabla.filas.get('PEPSI'));

    await sincronizar([
      productoHandy('CANELS', { description: 'CANELS. c/70' }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => productoHandy(`X-${i}`)),
    ]);

    expect(tabla.filas.get('PEPSI')?.activo).toBe(false);
    expect(factorDe(tabla.filas.get('PEPSI'))).toEqual(antes);
  });

  it('un confirmado que Handy reporta deshabilitado conserva su factor', async () => {
    const antes = factorDe(tabla.filas.get('CANELS'));

    await sincronizar([
      productoHandy('PEPSI', { description: 'PEPSI 1.5 LT C/12' }),
      productoHandy('CANELS', { description: 'CANELS. c/70', enabled: false }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => productoHandy(`X-${i}`)),
    ]);

    expect(tabla.filas.get('CANELS')?.activo).toBe(false);
    expect(factorDe(tabla.filas.get('CANELS'))).toEqual(antes);
  });

  it('la propuesta del nombre solo cae en productos sin factor ni confirmacion', async () => {
    tabla.filas.set('NUEVO-SIN-FACTOR', filaProducto('NUEVO-SIN-FACTOR'));

    await sincronizar([
      productoHandy('PEPSI', { description: 'PEPSI 1.5 LT C/24' }),
      productoHandy('CANELS', { description: 'CANELS. c/70' }),
      productoHandy('NUEVO-SIN-FACTOR', { description: 'BIG COLA C/6' }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => productoHandy(`X-${i}`)),
    ]);

    expect(tabla.filas.get('NUEVO-SIN-FACTOR')).toEqual(
      expect.objectContaining({ piezasPorPaquete: 6, factorConfirmado: false }),
    );
    expect(tabla.filas.get('PEPSI')?.piezasPorPaquete).toBe(12);
    expect(tabla.filas.get('CANELS')?.piezasPorPaquete).toBeNull();
  });
});
