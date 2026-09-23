import type {
  CargaRepository,
  DatosActualizarDiscrepancia,
  DatosCrearEvento,
  Discrepancia,
  DiscrepanciaAGuardar,
  EventoCarga,
  ItemAGuardar,
  ItemCapturado,
  SesionConteo,
} from './carga.repository';
import {
  ListarProductosDePlantillaUseCase,
  type ResultadoListarProductosDePlantilla,
} from './listar-productos-de-plantilla.use-case';
import type {
  FactorDeConteo,
  ProductoConteoRepository,
  ProductoDeConteo,
} from './producto-conteo.repository';

/**
 * Pruebas del caso de uso "listar productos de la plantilla" (grid de conteo).
 * Sin base de datos: dobles en memoria de ambos puertos.
 *
 * Cubre: evento inexistente, uso de la plantilla SNAPSHOT del evento,
 * catalogo completo cuando el evento no tiene plantilla, agrupacion por
 * familia (sin familia al final) y orden por nombre dentro de cada familia.
 */

const AHORA = new Date('2026-09-22T08:00:00-06:00');

function eventoDePrueba(overrides: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: 'ev-1',
    rutaId: 'ruta-1',
    plantillaId: 'pl-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado: 'EN_ESPERA_CONTADOR',
    fechaConteo: AHORA,
    fechaOperativa: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    rutaHandySinLiquidarId: null,
    liquidacionNoVerificada: false,
    creadoEn: AHORA,
    ...overrides,
  };
}

function producto(
  code: string,
  nombre: string,
  familia: string | null,
): ProductoDeConteo {
  return {
    code,
    nombre,
    unidadCode: 'PZA',
    familia,
    piezasPorPaquete: null,
    factorConfirmado: false,
  };
}

/** Doble: solo `buscarEventoPorId`; el resto lanza. */
class FakeCargaRepository implements CargaRepository {
  listarCapturasDeSesion(): never {
    throw new Error('no usado en esta prueba');
  }
  buscarCargaInicialDeFecha(): never {
    throw new Error('no usado en esta prueba');
  }
  evento: EventoCarga | null = eventoDePrueba();

  async buscarEventoPorId(): Promise<EventoCarga | null> {
    return this.evento;
  }

  crearEvento(_datos: DatosCrearEvento): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  cambiarEstado(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  bloquearPorCortePendiente(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  desbloquearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  crearSesion(): Promise<SesionConteo> {
    throw new Error('no usado en esta prueba');
  }
  buscarSesionPorId(): Promise<SesionConteo | null> {
    throw new Error('no usado en esta prueba');
  }
  guardarItems(_sesionId: string, _items: ItemAGuardar[]): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  finalizarSesion(): Promise<SesionConteo> {
    throw new Error('no usado en esta prueba');
  }
  listarItemsDeSesion(): Promise<ItemCapturado[]> {
    throw new Error('no usado en esta prueba');
  }
  listarSesionesDeEvento(): Promise<SesionConteo[]> {
    throw new Error('no usado en esta prueba');
  }
  guardarDiscrepancias(
    _eventoId: string,
    _discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  listarDiscrepancias(): Promise<Discrepancia[]> {
    throw new Error('no usado en esta prueba');
  }
  actualizarDiscrepancia(
    _eventoId: string,
    _productoCode: string,
    _datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
  reabrirDiscrepancia(): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
}

/**
 * Doble del catalogo: `porPlantilla` simula los productos activos de cada
 * plantilla y `catalogo` todo el catalogo activo. Registra con que plantilla
 * se le consulto.
 */
class FakeProductoConteoRepository implements ProductoConteoRepository {
  porPlantilla = new Map<string, ProductoDeConteo[]>();
  catalogo: ProductoDeConteo[] = [];
  readonly consultas: Array<string | null> = [];

  async listarActivos(plantillaId: string | null): Promise<ProductoDeConteo[]> {
    this.consultas.push(plantillaId);
    const lista =
      plantillaId === null
        ? this.catalogo
        : (this.porPlantilla.get(plantillaId) ?? []);
    return lista.map((p) => ({ ...p }));
  }

  buscarFactores(): Promise<Map<string, FactorDeConteo>> {
    throw new Error('no usado en esta prueba');
  }
}

function exigirExito(
  resultado: ResultadoListarProductosDePlantilla,
): Extract<ResultadoListarProductosDePlantilla, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

/** Vista compacta para comparar: familia -> nombres en orden. */
function resumen(
  resultado: Extract<ResultadoListarProductosDePlantilla, { exito: true }>,
): Array<[string | null, string[]]> {
  return resultado.familias.map((g) => [
    g.familia,
    g.productos.map((p) => p.nombre),
  ]);
}

describe('ListarProductosDePlantillaUseCase', () => {
  let cargas: FakeCargaRepository;
  let productos: FakeProductoConteoRepository;
  let useCase: ListarProductosDePlantillaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    productos = new FakeProductoConteoRepository();
    useCase = new ListarProductosDePlantillaUseCase(cargas, productos);
  });

  it('EVENTO_NO_ENCONTRADO si el evento no existe', async () => {
    cargas.evento = null;

    const resultado = await useCase.ejecutar({ eventoId: 'ev-x' });

    expect(resultado).toEqual({ exito: false, motivo: 'EVENTO_NO_ENCONTRADO' });
    expect(productos.consultas).toHaveLength(0);
  });

  it('usa la plantilla snapshot del evento', async () => {
    productos.porPlantilla.set('pl-1', [
      producto('P1', 'PEPSI 1.5 LT C/12', 'REFRESCOS'),
    ]);
    productos.catalogo = [producto('X', 'OTRO', 'REFRESCOS')];

    const resultado = exigirExito(await useCase.ejecutar({ eventoId: 'ev-1' }));

    expect(productos.consultas).toEqual(['pl-1']);
    expect(resultado.plantillaId).toBe('pl-1');
    expect(resumen(resultado)).toEqual([['REFRESCOS', ['PEPSI 1.5 LT C/12']]]);
  });

  it('sin plantilla devuelve el catalogo activo completo', async () => {
    cargas.evento = eventoDePrueba({ plantillaId: null });
    productos.catalogo = [
      producto('A', 'AGUA 1 LT', 'AGUAS'),
      producto('B', 'PEPSI 2 LT', 'REFRESCOS'),
    ];

    const resultado = exigirExito(await useCase.ejecutar({ eventoId: 'ev-1' }));

    expect(productos.consultas).toEqual([null]);
    expect(resultado.plantillaId).toBeNull();
    expect(resumen(resultado)).toEqual([
      ['AGUAS', ['AGUA 1 LT']],
      ['REFRESCOS', ['PEPSI 2 LT']],
    ]);
  });

  it('agrupa por familia en orden alfabetico, sin familia al final, y ordena por nombre dentro', async () => {
    productos.porPlantilla.set('pl-1', [
      producto('1', 'PEPSI 1.5 LT C/12', 'REFRESCOS'),
      producto('2', 'CHICLE MENTA', null),
      producto('3', 'BIG COLA 3L', 'REFRESCOS'),
      producto('4', 'AGUA 1 LT', 'AGUAS'),
      producto('5', 'BIG COLA 1.5L', 'REFRESCOS'),
      producto('6', 'BIG COLA 2L', 'REFRESCOS'),
      producto('7', 'CACAHUATE', 'BOTANAS'),
    ]);

    const resultado = exigirExito(await useCase.ejecutar({ eventoId: 'ev-1' }));

    expect(resumen(resultado)).toEqual([
      ['AGUAS', ['AGUA 1 LT']],
      ['BOTANAS', ['CACAHUATE']],
      [
        'REFRESCOS',
        ['BIG COLA 1.5L', 'BIG COLA 2L', 'BIG COLA 3L', 'PEPSI 1.5 LT C/12'],
      ],
      [null, ['CHICLE MENTA']],
    ]);
  });

  it('las presentaciones de una marca quedan en orden de tamano (10L despues de 3L)', async () => {
    productos.porPlantilla.set('pl-1', [
      producto('1', 'BIG COLA 10L', 'REFRESCOS'),
      producto('2', 'BIG COLA 3L', 'REFRESCOS'),
    ]);

    const resultado = exigirExito(await useCase.ejecutar({ eventoId: 'ev-1' }));

    expect(resumen(resultado)).toEqual([
      ['REFRESCOS', ['BIG COLA 3L', 'BIG COLA 10L']],
    ]);
  });

  it('devuelve los datos que la app necesita por producto', async () => {
    productos.porPlantilla.set('pl-1', [
      {
        code: 'P1',
        nombre: 'PEPSI 1.5 LT C/12',
        unidadCode: 'PZA',
        familia: 'REFRESCOS',
        piezasPorPaquete: 12,
        factorConfirmado: true,
      },
    ]);

    const resultado = exigirExito(await useCase.ejecutar({ eventoId: 'ev-1' }));

    expect(resultado.familias[0].productos[0]).toEqual({
      code: 'P1',
      nombre: 'PEPSI 1.5 LT C/12',
      unidadCode: 'PZA',
      familia: 'REFRESCOS',
      piezasPorPaquete: 12,
      factorConfirmado: true,
    });
  });
});
