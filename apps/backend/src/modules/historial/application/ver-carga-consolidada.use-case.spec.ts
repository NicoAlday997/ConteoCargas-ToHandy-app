import type { SolicitanteHistorial } from './consultar-historial.use-case';
import type {
  CargaConsolidada,
  EventoConsolidado,
  HistorialRepository,
  ProductoConsolidado,
} from './historial.repository';
import { VerCargaConsolidadaUseCase } from './ver-carga-consolidada.use-case';

/**
 * Pruebas del caso de uso "ver carga consolidada" (RF-23). Sin base de datos:
 * doble en memoria del puerto `HistorialRepository`. Cubre: evento inexistente,
 * agrupacion por familia, orden alfabetico de familias y de productos dentro
 * de cada una, y el grupo "Sin familia" para productos sin familia en el
 * catalogo.
 */

/** Hoy es 23 de septiembre por la tarde (hora de Mexico). */
const AHORA = new Date('2026-09-23T18:00:00-06:00');

const SUPERVISOR: SolicitanteHistorial = { usuarioAppId: 's1', rolApp: 'SUPERVISOR' };
const CONTADOR: SolicitanteHistorial = { usuarioAppId: 'c1', rolApp: 'CONTADOR' };
const VENDEDOR: SolicitanteHistorial = { usuarioAppId: 'v1', rolApp: 'VENDEDOR' };

const EVENTO_BASE: EventoConsolidado = {
  id: 'ev-1',
  rutaNombre: 'Ruta 3',
  tipo: 'INICIAL',
  estado: 'EN_ESPERA_AUTORIZACION',
  fechaOperativa: new Date('2026-09-20T00:00:00-06:00'),
  fechaConteo: new Date('2026-09-19T17:00:00-06:00'),
  vendedorNombre: 'Juan Perez',
  contadorNombre: 'Ana Lopez',
  autorizada: false,
  autorizadaPorNombre: null,
  canceladaPorNombre: null,
  fechaCancelacion: null,
  motivoCancelacion: null,
};

function producto(
  overrides: Partial<ProductoConsolidado> & Pick<ProductoConsolidado, 'productoCode' | 'nombre'>,
): ProductoConsolidado {
  return {
    unidadCode: 'PZA',
    unidadDescripcion: 'Pieza',
    familia: null,
    modalidadVenta: 'POR_PIEZA',
    piezasPorPaquete: null,
    factorConfirmado: false,
    cantidadFinal: 10,
    tuvoDiscrepancia: false,
    cantidadVendedor: null,
    cantidadContador: null,
    capturadaPorNombre: null,
    confirmadaPorNombre: null,
    ...overrides,
  };
}

class FakeHistorialRepository implements HistorialRepository {
  constructor(private readonly consolidada: CargaConsolidada | null) {}

  async listarCargas(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }

  async obtenerCargaConsolidada(): Promise<CargaConsolidada | null> {
    return this.consolidada;
  }
}

describe('VerCargaConsolidadaUseCase', () => {
  it('devuelve CARGA_NO_ENCONTRADA si el puerto responde null', async () => {
    const useCase = new VerCargaConsolidadaUseCase(
      new FakeHistorialRepository(null),
    );

    const resultado = await useCase.ejecutar('ev-fantasma', SUPERVISOR, AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'CARGA_NO_ENCONTRADA',
    });
  });

  it('agrupa los productos por familia, familias en orden alfabetico', async () => {
    const productos: ProductoConsolidado[] = [
      producto({ productoCode: 'B1', nombre: 'Cerveza', familia: 'Bebidas' }),
      producto({ productoCode: 'D1', nombre: 'Chicle', familia: 'Dulces' }),
      producto({ productoCode: 'C1', nombre: 'Cigarro A', familia: 'Cigarros' }),
    ];
    const useCase = new VerCargaConsolidadaUseCase(
      new FakeHistorialRepository({ evento: EVENTO_BASE, vendedorUsuarioAppId: 'v1', productos }),
    );

    const resultado = await useCase.ejecutar('ev-1', SUPERVISOR, AHORA);

    expect(resultado.exito).toBe(true);
    if (!resultado.exito) throw new Error('se esperaba exito');
    expect(resultado.evento).toEqual(EVENTO_BASE);
    expect(resultado.familias.map((f) => f.familia)).toEqual([
      'Bebidas',
      'Cigarros',
      'Dulces',
    ]);
  });

  it('dentro de cada familia ordena los productos por nombre', async () => {
    const productos: ProductoConsolidado[] = [
      producto({ productoCode: 'D2', nombre: 'Paleta', familia: 'Dulces' }),
      producto({ productoCode: 'D1', nombre: 'Chicle', familia: 'Dulces' }),
      producto({ productoCode: 'D3', nombre: 'Mazapan', familia: 'Dulces' }),
    ];
    const useCase = new VerCargaConsolidadaUseCase(
      new FakeHistorialRepository({ evento: EVENTO_BASE, vendedorUsuarioAppId: 'v1', productos }),
    );

    const resultado = await useCase.ejecutar('ev-1', SUPERVISOR, AHORA);

    if (!resultado.exito) throw new Error('se esperaba exito');
    expect(resultado.familias).toHaveLength(1);
    expect(resultado.familias[0]!.productos.map((p) => p.nombre)).toEqual([
      'Chicle',
      'Mazapan',
      'Paleta',
    ]);
  });

  it('agrupa los productos sin familia asignada bajo "Sin familia"', async () => {
    const productos: ProductoConsolidado[] = [
      producto({ productoCode: 'X1', nombre: 'Producto suelto', familia: null }),
      producto({ productoCode: 'B1', nombre: 'Cerveza', familia: 'Bebidas' }),
    ];
    const useCase = new VerCargaConsolidadaUseCase(
      new FakeHistorialRepository({ evento: EVENTO_BASE, vendedorUsuarioAppId: 'v1', productos }),
    );

    const resultado = await useCase.ejecutar('ev-1', SUPERVISOR, AHORA);

    if (!resultado.exito) throw new Error('se esperaba exito');
    expect(resultado.familias.map((f) => f.familia)).toEqual([
      'Bebidas',
      'Sin familia',
    ]);
  });

  it('conserva los datos de discrepancia de cada producto sin alterarlos', async () => {
    const productoConDiscrepancia = producto({
      productoCode: 'B1',
      nombre: 'Cerveza',
      familia: 'Bebidas',
      cantidadFinal: 12,
      tuvoDiscrepancia: true,
      cantidadVendedor: 10,
      cantidadContador: 12,
      capturadaPorNombre: 'Ana Lopez',
      confirmadaPorNombre: 'Juan Perez',
    });
    const useCase = new VerCargaConsolidadaUseCase(
      new FakeHistorialRepository({
        evento: EVENTO_BASE, vendedorUsuarioAppId: 'v1',
        productos: [productoConDiscrepancia],
      }),
    );

    const resultado = await useCase.ejecutar('ev-1', SUPERVISOR, AHORA);

    if (!resultado.exito) throw new Error('se esperaba exito');
    expect(resultado.familias[0]!.productos[0]).toEqual(productoConDiscrepancia);
  });

  describe('alcance por rol', () => {
    function useCaseCon(
      vendedorUsuarioAppId: string | null,
      fechaOperativa: Date,
    ): VerCargaConsolidadaUseCase {
      return new VerCargaConsolidadaUseCase(
        new FakeHistorialRepository({
          evento: { ...EVENTO_BASE, fechaOperativa },
          productos: [],
          vendedorUsuarioAppId,
        }),
      );
    }
    const reciente = new Date('2026-09-20T00:00:00-06:00');
    const vieja = new Date('2026-09-01T00:00:00-06:00');

    it('el vendedor ve el detalle de su propia carga reciente', async () => {
      const resultado = await useCaseCon('v1', reciente).ejecutar('ev-1', VENDEDOR, AHORA);

      expect(resultado.exito).toBe(true);
    });

    it('el vendedor NO ve el detalle de una carga ajena: FUERA_DE_ALCANCE', async () => {
      const resultado = await useCaseCon('v2', reciente).ejecutar('ev-1', VENDEDOR, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'FUERA_DE_ALCANCE' });
    });

    it('el vendedor NO ve su propia carga de hace mas de 2 semanas', async () => {
      const resultado = await useCaseCon('v1', vieja).ejecutar('ev-1', VENDEDOR, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'FUERA_DE_ALCANCE' });
    });

    it('el contador ve cargas de otros vendedores, pero no de hace mas de 2 semanas', async () => {
      expect(
        (await useCaseCon('v2', reciente).ejecutar('ev-1', CONTADOR, AHORA)).exito,
      ).toBe(true);
      expect(
        await useCaseCon('v2', vieja).ejecutar('ev-1', CONTADOR, AHORA),
      ).toEqual({ exito: false, motivo: 'FUERA_DE_ALCANCE' });
    });

    it('el supervisor ve cualquier carga, sin limite de fecha', async () => {
      const resultado = await useCaseCon('v2', vieja).ejecutar('ev-1', SUPERVISOR, AHORA);

      expect(resultado.exito).toBe(true);
    });

    it('la respuesta no expone el id del vendedor', async () => {
      const resultado = await useCaseCon('v1', reciente).ejecutar('ev-1', VENDEDOR, AHORA);

      expect(resultado).not.toHaveProperty('vendedorUsuarioAppId');
    });
  });
});
