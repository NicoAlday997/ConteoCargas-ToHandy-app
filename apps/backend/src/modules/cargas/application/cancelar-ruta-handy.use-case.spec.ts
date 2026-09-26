import type { EstadoCarga } from '@prisma/client';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  type PaginaHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import {
  CancelarRutaHandyUseCase,
  type EntradaCancelarRutaHandy,
} from './cancelar-ruta-handy.use-case';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Pruebas del caso de uso "cancelar en Handy". Sin red ni base de datos: dobles
 * en memoria de `CargaRepository` y `HandyGateway`.
 *
 * Lo central: si Handy dice que no (o no responde), el evento NO cambia. Nunca
 * se marca cancelado algo que sigue vivo en Handy.
 */

const AHORA = new Date('2026-09-25T09:00:00-06:00');
const EVENTO_ID = 'ev-1';
const ID_HANDY = 'ruta-handy-777';
const SUPERVISOR_APP_ID = 'u-supervisor';

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();
  readonly cancelaciones: Array<{ eventoId: string; motivo: string | null }> = [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async cancelarEvento(
    eventoId: string,
    usuarioAppId: string,
    motivo: string | null,
    ahora: Date,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) throw new Error(`evento ${eventoId} inexistente`);
    evento.estado = 'CANCELADA';
    evento.canceladaPorId = usuarioAppId;
    evento.fechaCancelacion = ahora;
    evento.motivoCancelacion = motivo;
    this.cancelaciones.push({ eventoId, motivo });
    return { ...evento };
  }

  // --- Metodos del puerto que este caso de uso no usa. ----------------------
  crearEvento(): never {
    throw new Error('no usado en estas pruebas');
  }
  buscarCargaInicialDeFecha(): never {
    throw new Error('no usado en estas pruebas');
  }
  cambiarEstado(): never {
    throw new Error('no usado en estas pruebas');
  }
  marcarComoEnviada(): never {
    throw new Error('no usado en estas pruebas');
  }
  autorizarEvento(): never {
    throw new Error('no usado en estas pruebas');
  }
  bloquearPorCortePendiente(): never {
    throw new Error('no usado en estas pruebas');
  }
  desbloquearEvento(): never {
    throw new Error('no usado en estas pruebas');
  }
  crearSesion(): never {
    throw new Error('no usado en estas pruebas');
  }
  buscarSesionPorId(): never {
    throw new Error('no usado en estas pruebas');
  }
  guardarItems(): never {
    throw new Error('no usado en estas pruebas');
  }
  finalizarSesion(): never {
    throw new Error('no usado en estas pruebas');
  }
  listarItemsDeSesion(): never {
    throw new Error('no usado en estas pruebas');
  }
  listarCapturasDeSesion(): never {
    throw new Error('no usado en estas pruebas');
  }
  listarSesionesDeEvento(): never {
    throw new Error('no usado en estas pruebas');
  }
  guardarDiscrepancias(): never {
    throw new Error('no usado en estas pruebas');
  }
  listarDiscrepancias(): never {
    throw new Error('no usado en estas pruebas');
  }
  actualizarDiscrepancia(): never {
    throw new Error('no usado en estas pruebas');
  }
  reabrirDiscrepancia(): never {
    throw new Error('no usado en estas pruebas');
  }
}

class FakeHandyGateway extends HandyGateway {
  /** Lo que responde `cancelarRuta`, o el error que lanza. */
  respuesta: boolean | Error = true;
  readonly llamadas: string[] = [];

  async cancelarRuta(rutaId: string): Promise<boolean> {
    this.llamadas.push(rutaId);
    if (this.respuesta instanceof Error) throw this.respuesta;
    return this.respuesta;
  }

  consultarRutaAbierta(): Promise<RutaHandy | null> {
    throw new Error('no usado en estas pruebas');
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
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado: 'ENVIADA',
    fechaConteo: AHORA,
    fechaOperativa: AHORA,
    autorizadaPorId: 'u-otro-supervisor',
    fechaAutorizacion: AHORA,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    idHandy: ID_HANDY,
    canceladaPorId: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

const entrada = (
  parcial: Partial<EntradaCancelarRutaHandy> = {},
): EntradaCancelarRutaHandy => ({
  eventoId: EVENTO_ID,
  usuarioAppId: SUPERVISOR_APP_ID,
  motivo: 'Se envio la ruta equivocada',
  ...parcial,
});

describe('CancelarRutaHandyUseCase', () => {
  let cargas: FakeCargaRepository;
  let handy: FakeHandyGateway;
  let useCase: CancelarRutaHandyUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    handy = new FakeHandyGateway();
    useCase = new CancelarRutaHandyUseCase(cargas, handy);
  });

  it('Handy cancela: el evento pasa a CANCELADA con quien, cuando y motivo', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.respuesta = true;

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(handy.llamadas).toEqual([ID_HANDY]);
    expect(resultado).toEqual({
      exito: true,
      evento: expect.objectContaining({
        estado: 'CANCELADA',
        canceladaPorId: SUPERVISOR_APP_ID,
        fechaCancelacion: AHORA,
        motivoCancelacion: 'Se envio la ruta equivocada',
      }),
    });
  });

  it('Handy dice que no: HANDY_RECHAZO y el evento sigue ENVIADA', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.respuesta = false;

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'HANDY_RECHAZO' });
    expect(cargas.cancelaciones).toEqual([]);
    expect((await cargas.buscarEventoPorId(EVENTO_ID))?.estado).toBe('ENVIADA');
  });

  it.each([
    ['token invalido', new HandyTokenInvalidoError('/route/x')],
    ['5xx', new HandyErrorServidorError('/route/x', 503)],
    ['sin respuesta', new HandySinRespuestaError('/route/x', new Error('timeout'))],
  ])('Handy falla (%s): HANDY_NO_DISPONIBLE y no cambia nada', async (_, error) => {
    cargas.sembrarEvento(nuevoEvento());
    handy.respuesta = error;

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'HANDY_NO_DISPONIBLE' });
    expect(cargas.cancelaciones).toEqual([]);
  });

  it('NO_ENCONTRADA si el evento no existe, sin llamar a Handy', async () => {
    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'NO_ENCONTRADA' });
    expect(handy.llamadas).toEqual([]);
  });

  it.each<EstadoCarga>([
    'BORRADOR',
    'EN_ESPERA_AUTORIZACION',
    'LISTA_PARA_ENVIAR',
    'ERROR_ENVIO',
    'ENVIO_INCIERTO',
    'CANCELADA',
  ])('ESTADO_INVALIDO en %s (solo ENVIADA), sin llamar a Handy', async (estado) => {
    cargas.sembrarEvento(nuevoEvento({ estado }));

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(handy.llamadas).toEqual([]);
  });

  it('ESTADO_INVALIDO si esta ENVIADA pero sin idHandy, sin llamar a Handy', async () => {
    cargas.sembrarEvento(nuevoEvento({ idHandy: null }));

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(handy.llamadas).toEqual([]);
  });

  it.each([undefined, '', 'abcd'])(
    'MOTIVO_REQUERIDO con motivo %p, ANTES de tocar Handy',
    async (motivo) => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(entrada({ motivo }), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_REQUERIDO' });
      expect(handy.llamadas).toEqual([]);
      expect(cargas.cancelaciones).toEqual([]);
    },
  );
});
