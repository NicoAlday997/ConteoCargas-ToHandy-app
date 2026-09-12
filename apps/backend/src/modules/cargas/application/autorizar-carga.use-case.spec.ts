import type { CargaRepository, EventoCarga } from './carga.repository';
import {
  AutorizarCargaUseCase,
  type ResultadoAutorizarCarga,
} from './autorizar-carga.use-case';

/**
 * Pruebas del caso de uso "autorizar carga" (CLAUDE.md: "ninguna carga va a
 * Handy sin autorizacion de un supervisor"). Sin base de datos: doble en
 * memoria del puerto `CargaRepository` con solo lo que este caso de uso toca.
 *
 * Cubre: estado invalido (evento inexistente o fuera de
 * EN_ESPERA_AUTORIZACION) rechazado sin persistir, y la autorizacion exitosa
 * que deja el evento en LISTA_PARA_ENVIAR con autorizadaPorId/fechaAutorizacion.
 */

const AHORA = new Date('2026-09-12T09:00:00-06:00');

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();

  /** Bitacora de autorizaciones aplicadas, para verificar que un rechazo no persiste nada. */
  readonly autorizaciones: Array<{
    eventoId: string;
    autorizadaPorId: string;
    ahora: Date;
  }> = [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async autorizarEvento(
    eventoId: string,
    autorizadaPorId: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.autorizadaPorId = autorizadaPorId;
    evento.fechaAutorizacion = ahora;
    evento.estado = 'LISTA_PARA_ENVIAR';
    this.autorizaciones.push({ eventoId, autorizadaPorId, ahora });
    return { ...evento };
  }

  // --- Metodos del puerto que este caso de uso no usa. ----------------------
  async crearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async cambiarEstado(): Promise<EventoCarga> {
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
  async listarDiscrepancias(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async actualizarDiscrepancia(): Promise<never> {
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
    estado: 'EN_ESPERA_AUTORIZACION',
    fechaConteo: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoAutorizarCarga,
): Extract<ResultadoAutorizarCarga, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('AutorizarCargaUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: AutorizarCargaUseCase;

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new AutorizarCargaUseCase(repo);
  });

  it('autoriza desde EN_ESPERA_AUTORIZACION: persiste autorizadaPorId/fechaAutorizacion y deja el evento en LISTA_PARA_ENVIAR', async () => {
    repo.sembrarEvento(nuevoEvento());

    const resultado = exigirExito(
      await useCase.ejecutar(
        { eventoId: 'ev-1', usuarioAppId: 'supervisor-1' },
        AHORA,
      ),
    );

    expect(resultado.evento.estado).toBe('LISTA_PARA_ENVIAR');
    expect(resultado.evento.autorizadaPorId).toBe('supervisor-1');
    expect(resultado.evento.fechaAutorizacion).toEqual(AHORA);
    expect(repo.autorizaciones).toEqual([
      { eventoId: 'ev-1', autorizadaPorId: 'supervisor-1', ahora: AHORA },
    ]);
  });

  it('rechaza ESTADO_INVALIDO y NO autoriza nada si el evento no esta en EN_ESPERA_AUTORIZACION', async () => {
    repo.sembrarEvento(nuevoEvento({ estado: 'CONFLICTOS_PENDIENTES' }));

    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-1', usuarioAppId: 'supervisor-1' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.autorizaciones).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-fantasma', usuarioAppId: 'supervisor-1' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(repo.autorizaciones).toEqual([]);
  });
});
