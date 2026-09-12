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
  ModificarCantidadSupervisorUseCase,
  type ResultadoModificarCantidadSupervisor,
} from './modificar-cantidad-supervisor.use-case';

/**
 * Pruebas del caso de uso "modificar cantidad" del supervisor (CLAUDE.md:
 * "Nadie, ni el supervisor, cambia una cantidad sin que dos personas lo
 * respalden"). Sin base de datos: doble en memoria del puerto
 * `CargaRepository`.
 *
 * LA prueba que da sentido a este archivo: la discrepancia queda CAPTURADA por
 * el supervisor pero jamas CONFIRMADA por este caso de uso — `confirmadaPor`
 * siempre sale en `null`. Ademas: estado invalido, cantidad negativa o
 * decimal, y producto que no pertenece a la carga.
 */

const AHORA = new Date('2026-09-12T11:00:00-06:00');
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
  resultado: ResultadoModificarCantidadSupervisor,
): Extract<ResultadoModificarCantidadSupervisor, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('ModificarCantidadSupervisorUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: ModificarCantidadSupervisorUseCase;

  const base = {
    eventoId: EVENTO_ID,
    productoCode: 'P1',
    usuarioAppId: 'supervisor-1',
    motivo: 'hay que cargar mas para la ruta',
  };

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new ModificarCantidadSupervisorUseCase(repo);
    repo.sembrarEvento(nuevoEvento());
    repo.sembrarSesiones(EVENTO_ID, [
      sesionCerrada('se-v', 'VENDEDOR', 'vendedor-1'),
      sesionCerrada('se-c', 'CONTADOR', 'contador-1'),
    ]);
    repo.sembrarItems('se-v', [{ productoCode: 'P1', cantidad: 14 }]);
    repo.sembrarItems('se-c', [{ productoCode: 'P1', cantidad: 14 }]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no esta en EN_ESPERA_AUTORIZACION', async () => {
    repo.sembrarEvento(nuevoEvento({ estado: 'CONFLICTOS_PENDIENTES' }));

    const resultado = await useCase.ejecutar(
      { ...base, cantidadNueva: 16 },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(
      { ...base, eventoId: 'ev-fantasma', cantidadNueva: 16 },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.reaperturas).toEqual([]);
  });

  it('rechaza CANTIDAD_INVALIDA y NO persiste si la cantidad es negativa o decimal', async () => {
    const negativa = await useCase.ejecutar(
      { ...base, cantidadNueva: -1 },
      AHORA,
    );
    expect(negativa).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });

    const decimal = await useCase.ejecutar(
      { ...base, cantidadNueva: 16.5 },
      AHORA,
    );
    expect(decimal).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });

    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza PRODUCTO_NO_ENCONTRADO si el producto no pertenece a la carga', async () => {
    const resultado = await useCase.ejecutar(
      { ...base, productoCode: 'FANTASMA', cantidadNueva: 16 },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PRODUCTO_NO_ENCONTRADO',
    });
    expect(repo.reaperturas).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('modifica la cantidad: crea la discrepancia CAPTURADA por el supervisor pero SIN confirmar, y deja el evento en CONFLICTOS_PENDIENTES', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar({ ...base, cantidadNueva: 16 }, AHORA),
    );

    expect(resultado.evento.estado).toBe('CONFLICTOS_PENDIENTES');
    expect(resultado.discrepancia).toEqual({
      productoCode: 'P1',
      cantidadVendedorOriginal: 14,
      cantidadContadorOriginal: 14,
      cantidadFinal: 16,
      capturadaPor: 'supervisor-1',
      fechaCaptura: AHORA,
      confirmadaPor: null,
      fechaConfirmacion: null,
    });
    expect(repo.reaperturas).toEqual([
      {
        eventoId: EVENTO_ID,
        datos: {
          productoCode: 'P1',
          cantidadVendedorOriginal: 14,
          cantidadContadorOriginal: 14,
          cantidadFinal: 16,
          capturadaPor: 'supervisor-1',
          fechaCaptura: AHORA,
        },
      },
    ]);
    expect(repo.cambiosDeEstado).toEqual([
      { eventoId: EVENTO_ID, estado: 'CONFLICTOS_PENDIENTES' },
    ]);
    // El supervisor no puede confirmar su propia modificacion: queda pendiente
    // de que otra persona la confirme via ConfirmarCantidadFinalUseCase, cuya
    // regla de autoconfirmacion sigue aplicando igual.
    const [discrepancia] = await repo.listarDiscrepancias(EVENTO_ID);
    expect(discrepancia.confirmadaPor).toBeNull();
  });
});
