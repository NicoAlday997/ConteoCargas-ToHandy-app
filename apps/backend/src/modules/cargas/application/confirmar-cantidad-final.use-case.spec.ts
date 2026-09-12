import type { EstadoCarga } from '@prisma/client';

import type {
  CargaRepository,
  DatosActualizarDiscrepancia,
  Discrepancia,
  EventoCarga,
} from './carga.repository';
import {
  ConfirmarCantidadFinalUseCase,
  type ResultadoConfirmarCantidadFinal,
} from './confirmar-cantidad-final.use-case';

/**
 * Pruebas del caso de uso "confirmar cantidad final" (RF-15, paso 2). Sin base
 * de datos: doble en memoria del puerto `CargaRepository`.
 *
 * LA prueba que da sentido a este archivo: la autoconfirmacion (mismo usuario
 * que capturo) SIEMPRE se rechaza y NO persiste absolutamente nada. Ademas:
 * confirmar sin captura previa, estado invalido del evento, y la transicion a
 * EN_ESPERA_AUTORIZACION solo cuando se resolvio la ultima discrepancia
 * pendiente (nunca directo a LISTA_PARA_ENVIAR: falta la autorizacion del
 * supervisor).
 */

const AHORA = new Date('2026-09-08T11:00:00-06:00');
const CAPTURADA_EN = new Date('2026-09-08T10:30:00-06:00');

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();
  private readonly discrepanciasPorEvento = new Map<string, Discrepancia[]>();

  /** Bitacora de escrituras, para verificar que un rechazo no persiste nada. */
  readonly actualizaciones: Array<{
    eventoId: string;
    productoCode: string;
    datos: DatosActualizarDiscrepancia;
  }> = [];
  readonly cambiosDeEstado: Array<{ eventoId: string; estado: EstadoCarga }> =
    [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
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

  async listarDiscrepancias(eventoId: string): Promise<Discrepancia[]> {
    return (this.discrepanciasPorEvento.get(eventoId) ?? []).map((d) => ({
      ...d,
    }));
  }

  async actualizarDiscrepancia(
    eventoId: string,
    productoCode: string,
    datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    this.actualizaciones.push({ eventoId, productoCode, datos: { ...datos } });
    const lista = this.discrepanciasPorEvento.get(eventoId) ?? [];
    const discrepancia = lista.find((d) => d.productoCode === productoCode);
    if (!discrepancia) {
      throw new Error(`discrepancia ${productoCode} inexistente`);
    }
    if (datos.cantidadFinal !== undefined) {
      discrepancia.cantidadFinal = datos.cantidadFinal;
    }
    if (datos.capturadaPor !== undefined) {
      discrepancia.capturadaPor = datos.capturadaPor;
    }
    if (datos.fechaCaptura !== undefined) {
      discrepancia.fechaCaptura = datos.fechaCaptura;
    }
    if (datos.confirmadaPor !== undefined) {
      discrepancia.confirmadaPor = datos.confirmadaPor;
    }
    if (datos.fechaConfirmacion !== undefined) {
      discrepancia.fechaConfirmacion = datos.fechaConfirmacion;
    }
    return { ...discrepancia };
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
  async listarItemsDeSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarSesionesDeEvento(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async guardarDiscrepancias(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async reabrirDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: 'ev-1',
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado: 'CONFLICTOS_PENDIENTES',
    fechaConteo: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

/** Discrepancia con la cantidad final ya capturada por `vendedor-1`, sin confirmar. */
function capturadaPorVendedor(
  parcial: Partial<Discrepancia> = {},
): Discrepancia {
  return {
    productoCode: 'P1',
    cantidadVendedorOriginal: 10,
    cantidadContadorOriginal: 12,
    cantidadFinal: 11,
    capturadaPor: 'vendedor-1',
    fechaCaptura: CAPTURADA_EN,
    confirmadaPor: null,
    fechaConfirmacion: null,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoConfirmarCantidadFinal,
): Extract<ResultadoConfirmarCantidadFinal, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('ConfirmarCantidadFinalUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: ConfirmarCantidadFinalUseCase;

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new ConfirmarCantidadFinalUseCase(repo);
    repo.sembrarEvento(nuevoEvento());
  });

  it('RECHAZA la autoconfirmacion del mismo usuario que capturo y NO persiste nada', async () => {
    repo.sembrarDiscrepancias('ev-1', [capturadaPorVendedor()]);

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'vendedor-1' },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'AUTOCONFIRMACION_PROHIBIDA',
    });
    // Ni la discrepancia ni el estado del evento se tocaron.
    expect(repo.actualizaciones).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
    const [d] = await repo.listarDiscrepancias('ev-1');
    expect(d.confirmadaPor).toBeNull();
    expect(d.fechaConfirmacion).toBeNull();
  });

  it('rechaza NO_HAY_CAPTURA_PREVIA y NO persiste si nadie capturo todavia', async () => {
    repo.sembrarDiscrepancias('ev-1', [
      capturadaPorVendedor({
        cantidadFinal: null,
        capturadaPor: null,
        fechaCaptura: null,
      }),
    ]);

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'contador-1' },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'NO_HAY_CAPTURA_PREVIA',
    });
    expect(repo.actualizaciones).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no esta en CONFLICTOS_PENDIENTES', async () => {
    repo.sembrarEvento(nuevoEvento({ estado: 'LISTA_PARA_ENVIAR' }));
    repo.sembrarDiscrepancias('ev-1', [capturadaPorVendedor()]);

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'contador-1' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.actualizaciones).toEqual([]);
  });

  it('rechaza DISCREPANCIA_NO_ENCONTRADA si el producto no tiene discrepancia', async () => {
    repo.sembrarDiscrepancias('ev-1', [capturadaPorVendedor()]);

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', productoCode: 'OTRO', usuarioAppId: 'contador-1' },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'DISCREPANCIA_NO_ENCONTRADA',
    });
    expect(repo.actualizaciones).toEqual([]);
  });

  it('rechaza YA_CONFIRMADA si la discrepancia ya estaba confirmada por otra persona', async () => {
    repo.sembrarDiscrepancias('ev-1', [
      capturadaPorVendedor({
        confirmadaPor: 'contador-1',
        fechaConfirmacion: CAPTURADA_EN,
      }),
    ]);

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'contador-2' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'YA_CONFIRMADA' });
    expect(repo.actualizaciones).toEqual([]);
  });

  it('confirmar la ULTIMA discrepancia pendiente: persiste y transiciona el evento a EN_ESPERA_AUTORIZACION', async () => {
    repo.sembrarDiscrepancias('ev-1', [capturadaPorVendedor()]);

    const resultado = exigirExito(
      await useCase.ejecutar(
        { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'contador-1' },
        AHORA,
      ),
    );

    expect(resultado.discrepancia.confirmadaPor).toBe('contador-1');
    expect(resultado.discrepancia.fechaConfirmacion).toEqual(AHORA);
    // Ni siquiera resuelta la ultima discrepancia se va directo a
    // LISTA_PARA_ENVIAR: falta la autorizacion del supervisor.
    expect(resultado.enEsperaAutorizacion).toBe(true);
    expect(repo.actualizaciones).toEqual([
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        datos: { confirmadaPor: 'contador-1', fechaConfirmacion: AHORA },
      },
    ]);
    expect(repo.cambiosDeEstado).toEqual([
      { eventoId: 'ev-1', estado: 'EN_ESPERA_AUTORIZACION' },
    ]);
    const evento = await repo.buscarEventoPorId('ev-1');
    expect(evento?.estado).toBe('EN_ESPERA_AUTORIZACION');
  });

  it('confirmar UNA de varias discrepancias: el evento sigue en CONFLICTOS_PENDIENTES', async () => {
    repo.sembrarDiscrepancias('ev-1', [
      capturadaPorVendedor({ productoCode: 'P1' }),
      capturadaPorVendedor({ productoCode: 'P2' }),
    ]);

    const resultado = exigirExito(
      await useCase.ejecutar(
        { eventoId: 'ev-1', productoCode: 'P1', usuarioAppId: 'contador-1' },
        AHORA,
      ),
    );

    expect(resultado.discrepancia.confirmadaPor).toBe('contador-1');
    expect(resultado.enEsperaAutorizacion).toBe(false);
    expect(repo.cambiosDeEstado).toEqual([]);
    const evento = await repo.buscarEventoPorId('ev-1');
    expect(evento?.estado).toBe('CONFLICTOS_PENDIENTES');
  });
});
