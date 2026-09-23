import { ConfirmarFactorEmpaqueUseCase } from './confirmar-factor-empaque.use-case';
import type {
  DatosConfirmarFactor,
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
      piezasPorPaquete: datos.piezasPorPaquete,
      factorConfirmado: true,
      factorConfirmadoPorId: datos.confirmadoPorId,
      fechaConfirmacionFactor: datos.fecha,
    };
    this.productos.set(datos.productoCode, confirmado);
    return confirmado;
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
    });
    expect(repo.confirmaciones).toEqual([
      {
        productoCode: 'P-1',
        piezasPorPaquete: 12,
        confirmadoPorId: SUPERVISOR_ID,
        fecha: AHORA,
      },
    ]);
  });

  it('corrige un factor propuesto equivocado', async () => {
    repo.sembrar(factorProducto({ piezasPorPaquete: 12 }));

    const resultado = await useCase.ejecutar({
      productoCode: 'P-1',
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
    });
  });

  it('acepta los extremos del rango (1 y 500)', async () => {
    repo.sembrar(factorProducto());

    for (const piezasPorPaquete of [1, 500]) {
      const resultado = await useCase.ejecutar({
        productoCode: 'P-1',
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
        piezasPorPaquete,
        usuarioAppId: SUPERVISOR_ID,
        ahora: AHORA,
      });

      expect(resultado).toEqual({ exito: false, motivo: 'FACTOR_INVALIDO' });
      expect(repo.confirmaciones).toEqual([]);
      expect(repo.productos.get('P-1')?.factorConfirmado).toBe(false);
    },
  );

  it('responde PRODUCTO_NO_ENCONTRADO si el code no existe', async () => {
    const resultado = await useCase.ejecutar({
      productoCode: 'NO-EXISTE',
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
