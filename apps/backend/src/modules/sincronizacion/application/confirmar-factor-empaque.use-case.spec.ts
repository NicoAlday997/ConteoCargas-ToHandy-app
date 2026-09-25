import { ConfirmarFactorEmpaqueUseCase } from './confirmar-factor-empaque.use-case';
import type {
  DatosConfirmarFactor,
  FactorDeCatalogo,
  FactorEmpaqueRepository,
  FactorGuardado,
  FactorPendiente,
  FactorProducto,
} from './factor-empaque.repository';

/**
 * Pruebas del caso de uso de confirmacion del factor de empaque. Sin Prisma:
 * doble en memoria del puerto que registra cada confirmacion.
 */

const AHORA = new Date('2026-09-22T15:00:00.000Z');
const SUPERVISOR_ID = 'ckw0supervisor00000000001';

function factorProducto(over: Partial<FactorProducto> = {}): FactorProducto {
  return {
    code: 'P-1',
    nombre: 'PEPSI 1.5 LT C/12',
    modalidadVenta: 'POR_PIEZA',
    piezasPorPaquete: 12,
    factorConfirmado: false,
    factorConfirmadoPorId: null,
    fechaConfirmacionFactor: null,
    ...over,
  };
}

class FakeFactorEmpaqueRepository implements FactorEmpaqueRepository {
  readonly productos = new Map<string, FactorProducto>();
  readonly confirmaciones: DatosConfirmarFactor[] = [];
  /** Cargas no enviadas con conteos, por producto. */
  readonly cargasEnCurso = new Map<string, number>();

  sembrar(producto: FactorProducto): void {
    this.productos.set(producto.code, producto);
  }

  async buscarPorCode(code: string): Promise<FactorProducto | null> {
    return this.productos.get(code) ?? null;
  }

  async confirmar(datos: DatosConfirmarFactor): Promise<FactorProducto> {
    this.confirmaciones.push(datos);
    const actual = this.productos.get(datos.productoCode);
    if (actual === undefined) {
      throw new Error(`producto inexistente: ${datos.productoCode}`);
    }
    const confirmado: FactorProducto = {
      ...actual,
      modalidadVenta: datos.modalidadVenta,
      piezasPorPaquete: datos.piezasPorPaquete,
      factorConfirmado: true,
      factorConfirmadoPorId: datos.confirmadoPorId,
      fechaConfirmacionFactor: datos.fecha,
    };
    this.productos.set(datos.productoCode, confirmado);
    return confirmado;
  }

  async contarCargasEnCursoConProducto(code: string): Promise<number> {
    return this.cargasEnCurso.get(code) ?? 0;
  }

  listarTodos(): Promise<FactorDeCatalogo[]> {
    throw new Error('no usado en estas pruebas');
  }
  buscarFactores(): Promise<Map<string, FactorGuardado>> {
    throw new Error('no usado en estas pruebas');
  }
  listarPendientes(): Promise<FactorPendiente[]> {
    throw new Error('no usado en estas pruebas');
  }
  contarPendientes(): Promise<number> {
    throw new Error('no usado en estas pruebas');
  }
}

describe('ConfirmarFactorEmpaqueUseCase', () => {
  let repo: FakeFactorEmpaqueRepository;
  let useCase: ConfirmarFactorEmpaqueUseCase;

  beforeEach(() => {
    repo = new FakeFactorEmpaqueRepository();
    useCase = new ConfirmarFactorEmpaqueUseCase(repo);
  });

  it('confirma el factor propuesto y guarda quien y cuando', async () => {
    repo.sembrar(factorProducto({ piezasPorPaquete: 12 }));

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 12,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado).toEqual({
      exito: true,
      producto: factorProducto({
        piezasPorPaquete: 12,
        factorConfirmado: true,
        factorConfirmadoPorId: SUPERVISOR_ID,
        fechaConfirmacionFactor: AHORA,
      }),
      cargasEnCurso: 0,
    });
    expect(repo.confirmaciones).toEqual([
      {
        productoCode: 'P-1',
        modalidadVenta: 'POR_PIEZA',
        piezasPorPaquete: 12,
        confirmadoPorId: SUPERVISOR_ID,
        fecha: AHORA,
        anterior: {
          modalidadVenta: 'POR_PIEZA',
          piezasPorPaquete: 12,
          factorConfirmado: false,
        },
        cargasEnCurso: 0,
      },
    ]);
  });

  it('corrige un factor propuesto equivocado', async () => {
    repo.sembrar(factorProducto({ piezasPorPaquete: 12 }));

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 24,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado.exito).toBe(true);
    expect(repo.productos.get('P-1')?.piezasPorPaquete).toBe(24);
    expect(repo.productos.get('P-1')?.factorConfirmado).toBe(true);
  });

  it('captura el factor de un producto sin propuesta (nombre sin patron)', async () => {
    repo.sembrar(
      factorProducto({ nombre: 'BLUE RIVERS', piezasPorPaquete: null }),
    );

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 6,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado.exito).toBe(true);
    expect(repo.productos.get('P-1')?.piezasPorPaquete).toBe(6);
  });

  it('permite corregir un factor ya confirmado y actualiza la traza', async () => {
    const OTRO_SUPERVISOR = 'ckw0supervisor00000000002';
    repo.sembrar(
      factorProducto({
        piezasPorPaquete: 12,
        factorConfirmado: true,
        factorConfirmadoPorId: OTRO_SUPERVISOR,
        fechaConfirmacionFactor: new Date('2026-09-01T10:00:00.000Z'),
      }),
    );

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 8,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado).toEqual({
      exito: true,
      producto: expect.objectContaining({
        piezasPorPaquete: 8,
        factorConfirmadoPorId: SUPERVISOR_ID,
        fechaConfirmacionFactor: AHORA,
      }),
      cargasEnCurso: 0,
    });
  });

  it('registra la confirmacion previa como valor anterior al corregirla', async () => {
    repo.sembrar(
      factorProducto({
        nombre: 'CANELS. c/70',
        piezasPorPaquete: 70,
        factorConfirmado: true,
        factorConfirmadoPorId: 'ckw0supervisor00000000002',
        fechaConfirmacionFactor: new Date('2026-09-01T10:00:00.000Z'),
      }),
    );

    await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'COMPLETO',
      piezasPorPaquete: null,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(repo.confirmaciones).toEqual([
      expect.objectContaining({
        modalidadVenta: 'COMPLETO',
        piezasPorPaquete: null,
        confirmadoPorId: SUPERVISOR_ID,
        fecha: AHORA,
        anterior: {
          modalidadVenta: 'POR_PIEZA',
          piezasPorPaquete: 70,
          factorConfirmado: true,
        },
      }),
    ]);
  });

  it('informa las cargas en curso con conteos del producto sin bloquear el cambio', async () => {
    repo.sembrar(factorProducto({ factorConfirmado: true }));
    repo.cargasEnCurso.set('P-1', 3);

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 6,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado).toEqual(
      expect.objectContaining({ exito: true, cargasEnCurso: 3 }),
    );
    expect(repo.productos.get('P-1')?.piezasPorPaquete).toBe(6);
    expect(repo.confirmaciones[0].cargasEnCurso).toBe(3);
  });

  it('acepta los extremos del rango (1 y 500)', async () => {
    repo.sembrar(factorProducto());

    for (const piezasPorPaquete of [1, 500]) {
      const resultado = await useCase.ejecutar({
        productoCode: 'P-1',
        modalidadVenta: 'POR_PIEZA',
        piezasPorPaquete,
        usuarioAppId: SUPERVISOR_ID,
        ahora: AHORA,
      });
      expect(resultado.exito).toBe(true);
    }
  });

  it.each([0, -3, 501, 12.5, NaN])(
    'rechaza %p piezas por paquete sin tocar el repositorio',
    async (piezasPorPaquete) => {
      repo.sembrar(factorProducto());

      const resultado = await useCase.ejecutar({
        productoCode: 'P-1',
        modalidadVenta: 'POR_PIEZA',
        piezasPorPaquete,
        usuarioAppId: SUPERVISOR_ID,
        ahora: AHORA,
      });

      expect(resultado).toEqual({ exito: false, motivo: 'FACTOR_INVALIDO' });
      expect(repo.confirmaciones).toEqual([]);
      expect(repo.productos.get('P-1')?.factorConfirmado).toBe(false);
    },
  );

  it('confirma un dulce como COMPLETO y descarta el "c/70" del nombre', async () => {
    repo.sembrar(
      factorProducto({ nombre: 'CANELS. c/70', piezasPorPaquete: 70 }),
    );

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'COMPLETO',
      piezasPorPaquete: 70,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado.exito).toBe(true);
    expect(repo.confirmaciones).toEqual([
      expect.objectContaining({
        productoCode: 'P-1',
        modalidadVenta: 'COMPLETO',
        piezasPorPaquete: null,
        confirmadoPorId: SUPERVISOR_ID,
        fecha: AHORA,
      }),
    ]);
    expect(repo.productos.get('P-1')).toEqual(
      expect.objectContaining({
        modalidadVenta: 'COMPLETO',
        piezasPorPaquete: null,
        factorConfirmado: true,
      }),
    );
  });

  it('corrige un producto confirmado por pieza a COMPLETO', async () => {
    repo.sembrar(
      factorProducto({
        nombre: 'CANELS. c/70',
        piezasPorPaquete: 70,
        factorConfirmado: true,
      }),
    );

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'COMPLETO',
      piezasPorPaquete: null,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado.exito).toBe(true);
    expect(repo.productos.get('P-1')?.modalidadVenta).toBe('COMPLETO');
    expect(repo.productos.get('P-1')?.piezasPorPaquete).toBeNull();
  });

  it('rechaza POR_PIEZA sin piezas por paquete', async () => {
    repo.sembrar(factorProducto());

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: null,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado).toEqual({ exito: false, motivo: 'FACTOR_INVALIDO' });
    expect(repo.confirmaciones).toEqual([]);
  });

  it('responde PRODUCTO_NO_ENCONTRADO si el code no existe', async () => {
    const resultado = await useCase.ejecutar({
      productoCode: 'NO-EXISTE',
      modalidadVenta: 'POR_PIEZA',
      piezasPorPaquete: 12,
      usuarioAppId: SUPERVISOR_ID,
      ahora: AHORA,
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PRODUCTO_NO_ENCONTRADO',
    });
    expect(repo.confirmaciones).toEqual([]);
  });
});
