import type { EstadoCarga } from '@prisma/client';

import type {
  CargaRepository,
  DatosActualizarDiscrepancia,
  Discrepancia,
  EventoCarga,
} from './carga.repository';
import {
  CapturarCantidadFinalUseCase,
  type ResultadoCapturarCantidadFinal,
} from './capturar-cantidad-final.use-case';

/**
 * Pruebas del caso de uso "capturar cantidad final" (RF-15, paso 1). Sin base de
 * datos: doble en memoria del puerto `CargaRepository` con solo lo que este caso
 * de uso toca.
 *
 * Cubre: captura sobre un evento que no esta en CONFLICTOS_PENDIENTES (rechazada
 * y sin persistir), discrepancia inexistente, cantidad invalida (sin persistir),
 * recaptura sobre algo ya confirmado (sin persistir), y la bandera
 * `generarAlertaMedia` cuando la cantidad final es atipica.
 */

const AHORA = new Date('2026-09-08T10:00:00-06:00');

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
    creadoEn: AHORA,
    ...parcial,
  };
}

function nuevaDiscrepancia(parcial: Partial<Discrepancia> = {}): Discrepancia {
  return {
    productoCode: 'P1',
    cantidadVendedorOriginal: 10,
    cantidadContadorOriginal: 12,
    cantidadFinal: null,
    capturadaPor: null,
    fechaCaptura: null,
    confirmadaPor: null,
    fechaConfirmacion: null,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoCapturarCantidadFinal,
): Extract<ResultadoCapturarCantidadFinal, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('CapturarCantidadFinalUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: CapturarCantidadFinalUseCase;

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new CapturarCantidadFinalUseCase(repo);
    repo.sembrarEvento(nuevoEvento());
    repo.sembrarDiscrepancias('ev-1', [nuevaDiscrepancia()]);
  });

  it('captura una cantidad valida: persiste cantidadFinal, capturadaPor y fechaCaptura', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: 'ev-1',
          productoCode: 'P1',
          cantidadFinal: 10,
          usuarioAppId: 'vendedor-1',
        },
        AHORA,
      ),
    );

    expect(resultado.discrepancia.cantidadFinal).toBe(10);
    expect(resultado.discrepancia.capturadaPor).toBe('vendedor-1');
    expect(resultado.discrepancia.fechaCaptura).toEqual(AHORA);
    // 10 coincide con el conteo del vendedor: no es atipica.
    expect(resultado.generarAlertaMedia).toBe(false);
    expect(repo.actualizaciones).toEqual([
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        datos: {
          cantidadFinal: 10,
          capturadaPor: 'vendedor-1',
          fechaCaptura: AHORA,
        },
      },
    ]);
  });

  it('cantidad atipica (no coincide con ninguno de los dos conteos): devuelve generarAlertaMedia', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: 'ev-1',
          productoCode: 'P1',
          cantidadFinal: 15,
          usuarioAppId: 'contador-1',
        },
        AHORA,
      ),
    );

    expect(resultado.discrepancia.cantidadFinal).toBe(15);
    expect(resultado.generarAlertaMedia).toBe(true);
  });

  it('rechaza ESTADO_INVALIDO y NO persiste si el evento no esta en CONFLICTOS_PENDIENTES', async () => {
    repo.sembrarEvento(nuevoEvento({ estado: 'EN_COMPARACION' }));

    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        cantidadFinal: 11,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.actualizaciones).toEqual([]);
    expect(repo.cambiosDeEstado).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-fantasma',
        productoCode: 'P1',
        cantidadFinal: 11,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.actualizaciones).toEqual([]);
  });

  it('rechaza DISCREPANCIA_NO_ENCONTRADA si el producto no tiene discrepancia en el evento', async () => {
    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        productoCode: 'PRODUCTO-INEXISTENTE',
        cantidadFinal: 11,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'DISCREPANCIA_NO_ENCONTRADA',
    });
    expect(repo.actualizaciones).toEqual([]);
  });

  it('rechaza CANTIDAD_INVALIDA y NO persiste si la cantidad no es un entero >= 0', async () => {
    const decimal = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        cantidadFinal: 11.5,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );
    expect(decimal).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });

    const negativa = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        cantidadFinal: -1,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );
    expect(negativa).toEqual({ exito: false, motivo: 'CANTIDAD_INVALIDA' });

    expect(repo.actualizaciones).toEqual([]);
  });

  it('rechaza YA_CONFIRMADA y NO persiste si la discrepancia ya quedo confirmada', async () => {
    repo.sembrarDiscrepancias('ev-1', [
      nuevaDiscrepancia({
        cantidadFinal: 11,
        capturadaPor: 'vendedor-1',
        confirmadaPor: 'contador-1',
      }),
    ]);

    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        productoCode: 'P1',
        cantidadFinal: 99,
        usuarioAppId: 'vendedor-1',
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'YA_CONFIRMADA' });
    expect(repo.actualizaciones).toEqual([]);
  });
});
