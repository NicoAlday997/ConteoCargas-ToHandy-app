import type {
  CapturaGuardada,
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
  GuardarItemsUseCase,
  type ResultadoGuardarItems,
} from './guardar-items.use-case';
import type {
  FactorDeConteo,
  ProductoConteoRepository,
  ProductoDeConteo,
} from './producto-conteo.repository';

/**
 * Pruebas del caso de uso "guardar items" (conteo por paquetes). Sin base de
 * datos: dobles en memoria de `CargaRepository` y `ProductoConteoRepository`.
 *
 * Cubre: sesion inexistente/de otro evento/ajena, producto inexistente,
 * paquetes de un producto con factor sin confirmar (rechazo sin persistir),
 * conversion a piezas con factor confirmado, piezas sueltas de un producto sin
 * factor confirmado, la bandera de sueltas que exceden el paquete, y la
 * trazabilidad sin conexion (`capturadoEn` del dispositivo, `recibidoEn` que
 * no se mueve en reenvios identicos).
 */

const AHORA = new Date('2026-09-22T08:00:00-06:00');

function sesionDePrueba(overrides: Partial<SesionConteo> = {}): SesionConteo {
  return {
    id: 'se-1',
    eventoCargaId: 'ev-1',
    tipo: 'CONTADOR',
    usuarioAppId: 'c1',
    dispositivoId: null,
    ubicacion: null,
    estado: 'ABIERTA',
    iniciadaEn: AHORA,
    finalizadaEn: null,
    ...overrides,
  };
}

/**
 * Doble del repositorio de cargas: solo implementa lo que este caso de uso usa
 * (`buscarSesionPorId`, `listarCapturasDeSesion`, `guardarItems`). El resto
 * lanza.
 */
class FakeCargaRepository implements CargaRepository {
  sesion: SesionConteo | null = sesionDePrueba();
  /** Lo que ya estaba guardado en la sesion antes del PATCH. */
  previos: CapturaGuardada[] = [];
  readonly guardados: Array<{ sesionId: string; items: ItemAGuardar[] }> = [];

  async listarCapturasDeSesion(): Promise<CapturaGuardada[]> {
    return this.previos.map((c) => ({ ...c }));
  }

  async buscarSesionPorId(): Promise<SesionConteo | null> {
    return this.sesion;
  }

  async guardarItems(sesionId: string, items: ItemAGuardar[]): Promise<void> {
    this.guardados.push({ sesionId, items: items.map((i) => ({ ...i })) });
  }

  crearEvento(_datos: DatosCrearEvento): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  buscarEventoPorId(): Promise<EventoCarga | null> {
    throw new Error('no usado en esta prueba');
  }
  buscarCargaInicialDeFecha(): Promise<EventoCarga | null> {
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

class FakeProductoConteoRepository implements ProductoConteoRepository {
  readonly factores = new Map<string, FactorDeConteo>([
    // Factor confirmado por supervisor.
    ['PEPSI-C12', { piezasPorPaquete: 12, factorConfirmado: true }],
    // Factor propuesto por la sincronizacion, sin confirmar.
    ['BIGCOLA-C6', { piezasPorPaquete: 6, factorConfirmado: false }],
    // Producto que no trae paquete en el nombre.
    ['CHICLE', { piezasPorPaquete: null, factorConfirmado: false }],
  ]);

  async buscarFactores(codes: string[]): Promise<Map<string, FactorDeConteo>> {
    const resultado = new Map<string, FactorDeConteo>();
    for (const code of codes) {
      const factor = this.factores.get(code);
      if (factor !== undefined) resultado.set(code, { ...factor });
    }
    return resultado;
  }

  listarActivos(): Promise<ProductoDeConteo[]> {
    throw new Error('no usado en esta prueba');
  }
}

function exigirExito(
  resultado: ResultadoGuardarItems,
): Extract<ResultadoGuardarItems, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('GuardarItemsUseCase', () => {
  let cargas: FakeCargaRepository;
  let productos: FakeProductoConteoRepository;
  let useCase: GuardarItemsUseCase;

  const LLEGADA = new Date('2026-09-22T09:30:00-06:00');
  const base = {
    eventoId: 'ev-1',
    sesionId: 'se-1',
    usuarioAppId: 'c1',
    recibidoEn: LLEGADA,
  };

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    productos = new FakeProductoConteoRepository();
    useCase = new GuardarItemsUseCase(cargas, productos);
  });

  describe('guardarrailes de sesion', () => {
    it('SESION_NO_ENCONTRADA si la sesion no existe', async () => {
      cargas.sesion = null;

      const resultado = await useCase.ejecutar({ ...base, items: [] });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SESION_NO_ENCONTRADA',
      });
      expect(cargas.guardados).toHaveLength(0);
    });

    it('SESION_NO_ENCONTRADA si la sesion es de otro evento', async () => {
      cargas.sesion = sesionDePrueba({ eventoCargaId: 'ev-otro' });

      const resultado = await useCase.ejecutar({ ...base, items: [] });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SESION_NO_ENCONTRADA',
      });
      expect(cargas.guardados).toHaveLength(0);
    });

    it('SESION_AJENA si la sesion es de otro usuario', async () => {
      const resultado = await useCase.ejecutar({
        ...base,
        usuarioAppId: 'otro',
        items: [{ productoCode: 'PEPSI-C12', paquetes: 1, sueltas: 0 }],
      });

      expect(resultado).toEqual({ exito: false, motivo: 'SESION_AJENA' });
      expect(cargas.guardados).toHaveLength(0);
    });
  });

  it('PRODUCTO_NO_ENCONTRADO si algun codigo no existe, sin persistir nada', async () => {
    const resultado = await useCase.ejecutar({
      ...base,
      items: [
        { productoCode: 'PEPSI-C12', paquetes: 1, sueltas: 0 },
        { productoCode: 'NO-EXISTE', paquetes: 0, sueltas: 3 },
      ],
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PRODUCTO_NO_ENCONTRADO',
      productos: ['NO-EXISTE'],
    });
    expect(cargas.guardados).toHaveLength(0);
  });

  describe('factor sin confirmar', () => {
    it('rechaza FACTOR_NO_CONFIRMADO si vienen paquetes, sin persistir nada', async () => {
      const resultado = await useCase.ejecutar({
        ...base,
        items: [
          { productoCode: 'PEPSI-C12', paquetes: 5, sueltas: 3 },
          { productoCode: 'BIGCOLA-C6', paquetes: 2, sueltas: 0 },
        ],
      });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'FACTOR_NO_CONFIRMADO',
        productos: ['BIGCOLA-C6'],
      });
      expect(cargas.guardados).toHaveLength(0);
    });

    it('rechaza FACTOR_NO_CONFIRMADO si el producto no tiene factor y vienen paquetes', async () => {
      const resultado = await useCase.ejecutar({
        ...base,
        items: [{ productoCode: 'CHICLE', paquetes: 1, sueltas: 0 }],
      });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'FACTOR_NO_CONFIRMADO',
        productos: ['CHICLE'],
      });
    });

    it('acepta solo sueltas y no usa el factor propuesto (ni para el aviso)', async () => {
      const { items } = exigirExito(
        await useCase.ejecutar({
          ...base,
          items: [{ productoCode: 'BIGCOLA-C6', paquetes: 0, sueltas: 8 }],
        }),
      );

      expect(items).toEqual([
        {
          productoCode: 'BIGCOLA-C6',
          paquetes: 0,
          sueltas: 8,
          cantidad: 8,
          capturadoEn: null,
          recibidoEn: LLEGADA,
          sueltasExcedenPaquete: false,
        },
      ]);
    });
  });

  it('calcula las piezas con el factor confirmado y guarda los tres valores', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar({
        ...base,
        items: [
          { productoCode: 'PEPSI-C12', paquetes: 5, sueltas: 3 },
          { productoCode: 'CHICLE', paquetes: 0, sueltas: 7 },
        ],
      }),
    );

    expect(resultado.sesion.id).toBe('se-1');
    expect(resultado.items).toEqual([
      {
        productoCode: 'PEPSI-C12',
        paquetes: 5,
        sueltas: 3,
        cantidad: 63,
        capturadoEn: null,
        recibidoEn: LLEGADA,
        sueltasExcedenPaquete: false,
      },
      {
        productoCode: 'CHICLE',
        paquetes: 0,
        sueltas: 7,
        cantidad: 7,
        capturadoEn: null,
        recibidoEn: LLEGADA,
        sueltasExcedenPaquete: false,
      },
    ]);
    // Al puerto solo llegan los valores persistibles, sin la bandera.
    expect(cargas.guardados).toEqual([
      {
        sesionId: 'se-1',
        items: [
          {
            productoCode: 'PEPSI-C12',
            paquetes: 5,
            sueltas: 3,
            cantidad: 63,
            capturadoEn: null,
            recibidoEn: LLEGADA,
          },
          {
            productoCode: 'CHICLE',
            paquetes: 0,
            sueltas: 7,
            cantidad: 7,
            capturadoEn: null,
            recibidoEn: LLEGADA,
          },
        ],
      },
    ]);
  });

  it('marca sueltasExcedenPaquete cuando las sueltas completan un paquete, sin rechazar', async () => {
    const { items } = exigirExito(
      await useCase.ejecutar({
        ...base,
        items: [{ productoCode: 'PEPSI-C12', paquetes: 2, sueltas: 12 }],
      }),
    );

    expect(items[0]).toMatchObject({
      cantidad: 36,
      sueltasExcedenPaquete: true,
    });
    expect(cargas.guardados).toHaveLength(1);
  });

  describe('trazabilidad sin conexion', () => {
    const CAPTURA = new Date('2026-09-22T08:15:00-06:00');
    const LLEGADA_ANTERIOR = new Date('2026-09-22T08:16:00-06:00');

    it('guarda capturadoEn del dispositivo junto con la hora de llegada', async () => {
      exigirExito(
        await useCase.ejecutar({
          ...base,
          items: [
            {
              productoCode: 'CHICLE',
              paquetes: 0,
              sueltas: 7,
              capturadoEn: CAPTURA,
            },
          ],
        }),
      );

      expect(cargas.guardados[0].items[0]).toMatchObject({
        capturadoEn: CAPTURA,
        recibidoEn: LLEGADA,
      });
    });

    it('un reenvio identico conserva la hora de su primera llegada', async () => {
      cargas.previos = [
        {
          productoCode: 'CHICLE',
          paquetes: 0,
          sueltas: 7,
          cantidad: 7,
          capturadoEn: CAPTURA,
          recibidoEn: LLEGADA_ANTERIOR,
        },
      ];

      exigirExito(
        await useCase.ejecutar({
          ...base,
          items: [
            {
              productoCode: 'CHICLE',
              paquetes: 0,
              sueltas: 7,
              capturadoEn: new Date(CAPTURA.getTime()),
            },
          ],
        }),
      );

      expect(cargas.guardados[0].items[0].recibidoEn).toEqual(LLEGADA_ANTERIOR);
    });

    it.each([
      ['otra cantidad', { sueltas: 8, capturadoEn: CAPTURA }],
      [
        'misma cantidad recapturada',
        { sueltas: 7, capturadoEn: new Date('2026-09-22T08:40:00-06:00') },
      ],
      ['sin capturadoEn', { sueltas: 7, capturadoEn: undefined }],
    ])('si cambia (%s) sella la llegada nueva', async (_caso, cambio) => {
      cargas.previos = [
        {
          productoCode: 'CHICLE',
          paquetes: 0,
          sueltas: 7,
          cantidad: 7,
          capturadoEn: CAPTURA,
          recibidoEn: LLEGADA_ANTERIOR,
        },
      ];

      exigirExito(
        await useCase.ejecutar({
          ...base,
          items: [{ productoCode: 'CHICLE', paquetes: 0, ...cambio }],
        }),
      );

      expect(cargas.guardados[0].items[0].recibidoEn).toEqual(LLEGADA);
    });

    it('un item previo sin recibidoEn (anterior al campo) recibe la llegada actual', async () => {
      cargas.previos = [
        {
          productoCode: 'CHICLE',
          paquetes: 0,
          sueltas: 7,
          cantidad: 7,
          capturadoEn: null,
          recibidoEn: null,
        },
      ];

      exigirExito(
        await useCase.ejecutar({
          ...base,
          items: [{ productoCode: 'CHICLE', paquetes: 0, sueltas: 7 }],
        }),
      );

      expect(cargas.guardados[0].items[0].recibidoEn).toEqual(LLEGADA);
    });
  });

  it('items vacio deja la sesion sin productos (reemplazo total)', async () => {
    exigirExito(await useCase.ejecutar({ ...base, items: [] }));

    expect(cargas.guardados).toEqual([{ sesionId: 'se-1', items: [] }]);
  });
});
