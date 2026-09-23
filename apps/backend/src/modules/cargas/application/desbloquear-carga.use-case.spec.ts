import type { EstadoCarga } from '@prisma/client';

import {
  HandyGateway,
  type PaginaHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type { CargaRepository, EventoCarga } from './carga.repository';
import {
  DesbloquearCargaUseCase,
  type ResultadoDesbloquearCarga,
} from './desbloquear-carga.use-case';

/**
 * Pruebas del caso de uso "desbloquear carga por corte de venta pendiente"
 * (RF-13, docs/01 seccion 6 regla 2). Sin red ni base de datos: dobles en
 * memoria de `CargaRepository` y `HandyGateway`.
 *
 * Cubre: ruta ya cerrada (desbloquea y vuelve a EN_ESPERA_CONTADOR), ruta
 * todavia abierta (sigueBloqueado sin tocar nada), y estado invalido (evento
 * inexistente o fuera de BLOQUEADA_CORTE_PENDIENTE) que no consulta Handy.
 */

const AHORA = new Date('2026-09-17T12:00:00-06:00');
const USUARIO_HANDY_ID = 42;
const EVENTO_ID = 'ev-1';

class FakeCargaRepository implements CargaRepository {
  listarCapturasDeSesion(): never {
    throw new Error('no usado en esta prueba');
  }
  private readonly eventos = new Map<string, EventoCarga>();

  readonly desbloqueos: Array<{ eventoId: string; ahora: Date }> = [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async desbloquearEvento(eventoId: string, ahora: Date): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.fechaDesbloqueo = ahora;
    evento.estado = 'EN_ESPERA_CONTADOR';
    this.desbloqueos.push({ eventoId, ahora });
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
  async autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async bloquearPorCortePendiente(): Promise<EventoCarga> {
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

class FakeHandyGateway extends HandyGateway {
  /** `null` = sin ruta abierta (404 verificado): la ruta anterior ya se cerro. */
  rutaAbierta: RutaHandy | null = null;

  readonly llamadas: { consultarRutaAbierta: number[] } = {
    consultarRutaAbierta: [],
  };

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.llamadas.consultarRutaAbierta.push(usuarioHandyId);
    return this.rutaAbierta;
  }

  listarProductos(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
  listarVendedores(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
  crearRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en estas pruebas');
  }
  recargarRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en estas pruebas');
  }
  cancelarRuta(): Promise<boolean> {
    throw new Error('no usado en estas pruebas');
  }
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: USUARIO_HANDY_ID,
    estado: 'BLOQUEADA_CORTE_PENDIENTE',
    fechaConteo: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: AHORA,
    fechaDesbloqueo: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoDesbloquearCarga,
): Extract<ResultadoDesbloquearCarga, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('DesbloquearCargaUseCase', () => {
  let cargas: FakeCargaRepository;
  let handy: FakeHandyGateway;
  let useCase: DesbloquearCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    handy = new FakeHandyGateway();
    useCase = new DesbloquearCargaUseCase(cargas, handy);
  });

  it('ruta ya cerrada: desbloquea, persiste fechaDesbloqueo y vuelve a EN_ESPERA_CONTADOR', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = null;

    const resultado = exigirExito(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado).toEqual({
      exito: true,
      sigueBloqueado: false,
      evento: expect.objectContaining({ estado: 'EN_ESPERA_CONTADOR' }),
    });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([USUARIO_HANDY_ID]);
    expect(cargas.desbloqueos).toEqual([{ eventoId: EVENTO_ID, ahora: AHORA }]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('EN_ESPERA_CONTADOR');
    expect(evento?.fechaDesbloqueo).toEqual(AHORA);
  });

  it('ruta todavia abierta: no cambia nada y devuelve sigueBloqueado=true', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = { id: 'ruta-anterior-99' };

    const resultado = await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA);

    expect(resultado).toEqual({ exito: true, sigueBloqueado: true });
    expect(cargas.desbloqueos).toEqual([]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('BLOQUEADA_CORTE_PENDIENTE');
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe y no consulta Handy', async () => {
    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-fantasma' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
  });

  it.each<EstadoCarga>([
    'BORRADOR',
    'EN_ESPERA_CONTADOR',
    'EN_COMPARACION',
    'CONFLICTOS_PENDIENTES',
    'EN_ESPERA_AUTORIZACION',
    'LISTA_PARA_ENVIAR',
    'ENVIADA',
  ])(
    'rechaza ESTADO_INVALIDO si el evento esta en %s (no BLOQUEADA_CORTE_PENDIENTE) y no consulta Handy',
    async (estado) => {
      cargas.sembrarEvento(nuevoEvento({ estado }));

      const resultado = await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
      expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
      expect(cargas.desbloqueos).toEqual([]);
    },
  );
});
