import type { EstadoCarga, TipoSesion } from '@prisma/client';

import type {
  CargaRepository,
  DatosReabrirDiscrepancia,
  Discrepancia,
  EventoCarga,
  ItemCapturado,
  SesionConteo,
} from './carga.repository';
import {
  RechazarProductosUseCase,
  type ResultadoRechazarProductos,
} from './rechazar-productos.use-case';

/**
 * Pruebas del caso de uso "rechazar productos" (CLAUDE.md: el supervisor
 * rechaza SOLO los productos con error, nunca la carga completa). Sin base de
 * datos: doble en memoria del puerto `CargaRepository`.
 *
 * Cubre: estado invalido, arreglo vacio (SIN_PRODUCTOS), producto que no
 * pertenece a la carga (PRODUCTO_NO_ENCONTRADO, sin persistir nada del
 * arreglo), rechazo exitoso que reabre la discrepancia y deja el evento en
 * CONFLICTOS_PENDIENTES, y la reapertura de una discrepancia que YA estaba
 * capturada y confirmada (debe limpiar la resolucion previa).
 */

const AHORA = new Date('2026-09-12T10:00:00-06:00');
const INICIADA_EN = new Date('2026-09-12T08:00:00-06:00');
const EVENTO_ID = 'ev-1';

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();
  private readonly sesionesPorEvento = new Map<string, SesionConteo[]>();
  private readonly itemsPorSesion = new Map<string, ItemCapturado[]>();
  private readonly discrepanciasPorEvento = new Map<string, Discrepancia[]>();

  readonly reaperturas: Array<{
    eventoId: string;
    datos: DatosReabrirDiscrepancia;
  }> = [];
  readonly cambiosDeEstado: Array<{ eventoId: string; estado: EstadoCarga }> =
    [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  sembrarSesiones(eventoId: string, sesiones: SesionConteo[]): void {
    this.sesionesPorEvento.set(
      eventoId,
      sesiones.map((s) => ({ ...s })),
    );
  }

  sembrarItems(sesionId: string, items: ItemCapturado[]): void {
    this.itemsPorSesion.set(
      sesionId,
      items.map((i) => ({ ...i })),
    );
  }

  sembrarDiscrepancias(eventoId: string, discrepancias: Discrepancia[]): void {
    this.discrepanciasPorEvento.set(
      eventoId,
      discrepancias.map((d) => ({ ...d })),
    );
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async cambiarEstado(
    eventoId: string,
    nuevoEstado: EstadoCarga,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.estado = nuevoEstado;
    this.cambiosDeEstado.push({ eventoId, estado: nuevoEstado });
    return { ...evento };
  }

  async listarSesionesDeEvento(eventoId: string): Promise<SesionConteo[]> {
    return (this.sesionesPorEvento.get(eventoId) ?? []).map((s) => ({ ...s }));
  }

  async listarItemsDeSesion(sesionId: string): Promise<ItemCapturado[]> {
    return (this.itemsPorSesion.get(sesionId) ?? []).map((i) => ({ ...i }));
  }

  async listarDiscrepancias(eventoId: string): Promise<Discrepancia[]> {
    return (this.discrepanciasPorEvento.get(eventoId) ?? []).map((d) => ({
      ...d,
    }));
  }

  async reabrirDiscrepancia(
    eventoId: string,
    datos: DatosReabrirDiscrepancia,
  ): Promise<Discrepancia> {
    this.reaperturas.push({ eventoId, datos: { ...datos } });
    const lista = this.discrepanciasPorEvento.get(eventoId) ?? [];
    const nueva: Discrepancia = {
      productoCode: datos.productoCode,
      cantidadVendedorOriginal: datos.cantidadVendedorOriginal,
      cantidadContadorOriginal: datos.cantidadContadorOriginal,
      cantidadFinal: datos.cantidadFinal ?? null,
      capturadaPor: datos.capturadaPor ?? null,
      fechaCaptura: datos.fechaCaptura ?? null,
      confirmadaPor: null,
      fechaConfirmacion: null,
    };
    const existente = lista.find((d) => d.productoCode === datos.productoCode);
    if (existente) {
      Object.assign(existente, nueva);
    } else {
      lista.push(nueva);
    }
    this.discrepanciasPorEvento.set(eventoId, lista);
    return { ...nueva };
  }

  // --- Metodos del puerto que este caso de uso no usa. ----------------------
  async crearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async crearSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async buscarSesionPorId(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async guardarItems(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async finalizarSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async guardarDiscrepancias(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async actualizarDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

function sesionCerrada(
  id: string,
  tipo: TipoSesion,
  usuarioAppId: string,
): SesionConteo {
  return {
    id,
    eventoCargaId: EVENTO_ID,
    tipo,
    usuarioAppId,
    dispositivoId: null,
    ubicacion: null,
    estado: 'CERRADA',
    iniciadaEn: INICIADA_EN,
    finalizadaEn: INICIADA_EN,
  };
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado: 'EN_ESPERA_AUTORIZACION',
    fechaConteo: INICIADA_EN,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    creadoEn: INICIADA_EN,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoRechazarProductos,
): Extract<ResultadoRechazarProductos, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('RechazarProductosUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: RechazarProductosUseCase;

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new RechazarProductosUseCase(repo);
    repo.sembrarEvento(nuevoEvento());
    repo.sembrarSesiones(EVENTO_ID, [
      sesionCerrada('se-v', 'VENDEDOR', 'vendedor-1'),
      sesionCerrada('se-c', 'CONTADOR', 'contador-1'),
    ]);
    repo.sembrarItems('se-v', [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ]);
    repo.sembrarItems('se-c', [
      { productoCode: 'P1', cantidad: 10 },
      { productoCode: 'P2', cantidad: 5 },
    ]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no esta en EN_ESPERA_AUTORIZACION', async () => {
    repo.sembrarEvento(nuevoEvento({ estado: 'CONFLICTOS_PENDIENTES' }));

    const resultado = await useCase.ejecutar(
      {
        eventoId: EVENTO_ID,
        usuarioAppId: 'supervisor-1',
        productosRechazados: [{ productoCode: 'P1', motivo: 'mal contado' }],
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-fantasma',
        usuarioAppId: 'supervisor-1',
        productosRechazados: [{ productoCode: 'P1', motivo: 'mal contado' }],
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
  });

  it('rechaza SIN_PRODUCTOS si el arreglo viene vacio', async () => {
    const resultado = await useCase.ejecutar(
      {
        eventoId: EVENTO_ID,
        usuarioAppId: 'supervisor-1',
        productosRechazados: [],
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'SIN_PRODUCTOS' });
    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza PRODUCTO_NO_ENCONTRADO si algun productoCode no pertenece a la carga, y NO reabre ninguno', async () => {
    const resultado = await useCase.ejecutar(
      {
        eventoId: EVENTO_ID,
        usuarioAppId: 'supervisor-1',
        productosRechazados: [
          { productoCode: 'P1', motivo: 'mal contado' },
          { productoCode: 'FANTASMA', motivo: 'no existe' },
        ],
      },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PRODUCTO_NO_ENCONTRADO',
    });
    // Ni siquiera P1 (valido) se reabre: se valida todo el arreglo antes de
    // aplicar cualquier rechazo.
    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza un producto: reabre su discrepancia con la cantidad actual en ambos lados y deja el evento en CONFLICTOS_PENDIENTES', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: EVENTO_ID,
          usuarioAppId: 'supervisor-1',
          productosRechazados: [
            { productoCode: 'P2', motivo: 'cantidad rara' },
          ],
        },
        AHORA,
      ),
    );

    expect(resultado.evento.estado).toBe('CONFLICTOS_PENDIENTES');
    expect(resultado.productosPendientes).toBe(1);
    expect(repo.reaperturas).toEqual([
      {
        eventoId: EVENTO_ID,
        datos: {
          productoCode: 'P2',
          cantidadVendedorOriginal: 5,
          cantidadContadorOriginal: 5,
        },
      },
    ]);
    expect(repo.cambiosDeEstado).toEqual([
      { eventoId: EVENTO_ID, estado: 'CONFLICTOS_PENDIENTES' },
    ]);
    const [discrepancia] = await repo.listarDiscrepancias(EVENTO_ID);
    expect(discrepancia.cantidadFinal).toBeNull();
    expect(discrepancia.capturadaPor).toBeNull();
    expect(discrepancia.confirmadaPor).toBeNull();
  });

  it('reabre una discrepancia YA capturada y confirmada: limpia cantidadFinal/capturadaPor/confirmadaPor', async () => {
    repo.sembrarDiscrepancias(EVENTO_ID, [
      {
        productoCode: 'P2',
        cantidadVendedorOriginal: 5,
        cantidadContadorOriginal: 8,
        cantidadFinal: 6,
        capturadaPor: 'vendedor-1',
        fechaCaptura: INICIADA_EN,
        confirmadaPor: 'contador-1',
        fechaConfirmacion: INICIADA_EN,
      },
    ]);

    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: EVENTO_ID,
          usuarioAppId: 'supervisor-1',
          productosRechazados: [
            { productoCode: 'P2', motivo: 'revisar de nuevo' },
          ],
        },
        AHORA,
      ),
    );

    expect(resultado.productosPendientes).toBe(1);
    // La cantidad "actual" para reabrir es la ultima cantidadFinal acordada
    // (6), no las cantidades originales del primer conteo.
    expect(repo.reaperturas).toEqual([
      {
        eventoId: EVENTO_ID,
        datos: {
          productoCode: 'P2',
          cantidadVendedorOriginal: 6,
          cantidadContadorOriginal: 6,
        },
      },
    ]);
    const [discrepancia] = await repo.listarDiscrepancias(EVENTO_ID);
    expect(discrepancia.cantidadFinal).toBeNull();
    expect(discrepancia.capturadaPor).toBeNull();
    expect(discrepancia.confirmadaPor).toBeNull();
  });
});
