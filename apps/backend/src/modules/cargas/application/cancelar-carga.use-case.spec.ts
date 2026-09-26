import type { EstadoCarga, RolApp } from '@prisma/client';

import { TODOS_LOS_ESTADOS } from '../domain/estados-carga';
import {
  CancelarCargaUseCase,
  type EntradaCancelarCarga,
} from './cancelar-carga.use-case';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Pruebas del caso de uso "cancelar carga". Sin base de datos: doble en
 * memoria de `CargaRepository` que registra cada `cancelarEvento`.
 *
 * Cubre: el vendedor solo cancela lo suyo y solo en BORRADOR; el supervisor
 * cancela cualquier carga no enviada con motivo obligatorio; el contador
 * nunca; y que un rechazo no persiste nada.
 */

const AHORA = new Date('2026-09-25T09:00:00-06:00');
const EVENTO_ID = 'ev-1';
const VENDEDOR_APP_ID = 'u-vendedor';
const VENDEDOR_HANDY_ID = 42;
const SUPERVISOR_APP_ID = 'u-supervisor';

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();

  readonly cancelaciones: Array<{
    eventoId: string;
    usuarioAppId: string;
    motivo: string | null;
    ahora: Date;
  }> = [];

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
    this.cancelaciones.push({ eventoId, usuarioAppId, motivo, ahora });
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

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: VENDEDOR_HANDY_ID,
    estado: 'BORRADOR',
    fechaConteo: AHORA,
    fechaOperativa: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    idHandy: null,
    canceladaPorId: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

const comoVendedor = (
  parcial: Partial<EntradaCancelarCarga> = {},
): EntradaCancelarCarga => ({
  eventoId: EVENTO_ID,
  usuarioAppId: VENDEDOR_APP_ID,
  rolApp: 'VENDEDOR',
  usuarioHandyId: VENDEDOR_HANDY_ID,
  ...parcial,
});

const comoSupervisor = (
  parcial: Partial<EntradaCancelarCarga> = {},
): EntradaCancelarCarga => ({
  eventoId: EVENTO_ID,
  usuarioAppId: SUPERVISOR_APP_ID,
  rolApp: 'SUPERVISOR',
  usuarioHandyId: null,
  motivo: 'Ruta equivocada, se abrio por error',
  ...parcial,
});

describe('CancelarCargaUseCase', () => {
  let cargas: FakeCargaRepository;
  let useCase: CancelarCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    useCase = new CancelarCargaUseCase(cargas);
  });

  it('NO_ENCONTRADA si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(comoSupervisor(), AHORA);
    expect(resultado).toEqual({ exito: false, motivo: 'NO_ENCONTRADA' });
    expect(cargas.cancelaciones).toEqual([]);
  });

  describe('VENDEDOR', () => {
    it('cancela su propia carga en BORRADOR, sin motivo', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(comoVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: true,
        evento: expect.objectContaining({
          estado: 'CANCELADA',
          canceladaPorId: VENDEDOR_APP_ID,
          fechaCancelacion: AHORA,
          motivoCancelacion: null,
        }),
      });
      expect(cargas.cancelaciones).toEqual([
        { eventoId: EVENTO_ID, usuarioAppId: VENDEDOR_APP_ID, motivo: null, ahora: AHORA },
      ]);
    });

    it('guarda el motivo si lo da, sin espacios sobrantes', async () => {
      cargas.sembrarEvento(nuevoEvento());

      await useCase.ejecutar(comoVendedor({ motivo: '  fecha equivocada ' }), AHORA);

      expect(cargas.cancelaciones[0].motivo).toBe('fecha equivocada');
    });

    it('un motivo solo con espacios se guarda como null', async () => {
      cargas.sembrarEvento(nuevoEvento());

      await useCase.ejecutar(comoVendedor({ motivo: '   ' }), AHORA);

      expect(cargas.cancelaciones[0].motivo).toBeNull();
    });

    it('NO_PERMITIDO sobre la carga de otro vendedor', async () => {
      cargas.sembrarEvento(nuevoEvento({ usuarioHandyId: 99 }));

      const resultado = await useCase.ejecutar(comoVendedor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
      expect(cargas.cancelaciones).toEqual([]);
    });

    it('NO_PERMITIDO si su usuario no esta vinculado a Handy', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        comoVendedor({ usuarioHandyId: null }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
    });

    it.each<EstadoCarga>(TODOS_LOS_ESTADOS.filter((e) => e !== 'BORRADOR'))(
      'ESTADO_INVALIDO en %s: despues de BORRADOR el vendedor ya no cancela',
      async (estado) => {
        cargas.sembrarEvento(nuevoEvento({ estado }));

        const resultado = await useCase.ejecutar(comoVendedor(), AHORA);

        expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
        expect(cargas.cancelaciones).toEqual([]);
      },
    );
  });

  describe('SUPERVISOR', () => {
    it.each<EstadoCarga>([
      'BORRADOR',
      'EN_ESPERA_CONTADOR',
      'BLOQUEADA_CORTE_PENDIENTE',
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
      'EN_ESPERA_AUTORIZACION',
      'LISTA_PARA_ENVIAR',
      'ERROR_ENVIO',
    ])('cancela una carga ajena en %s con motivo', async (estado) => {
      cargas.sembrarEvento(nuevoEvento({ estado }));

      const resultado = await useCase.ejecutar(comoSupervisor(), AHORA);

      expect(resultado).toEqual({
        exito: true,
        evento: expect.objectContaining({
          estado: 'CANCELADA',
          canceladaPorId: SUPERVISOR_APP_ID,
          motivoCancelacion: 'Ruta equivocada, se abrio por error',
        }),
      });
    });

    it.each<EstadoCarga>(['ENVIADA', 'CANCELADA', 'ENVIO_INCIERTO'])(
      'ESTADO_INVALIDO en %s',
      async (estado) => {
        cargas.sembrarEvento(nuevoEvento({ estado }));

        const resultado = await useCase.ejecutar(comoSupervisor(), AHORA);

        expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
        expect(cargas.cancelaciones).toEqual([]);
      },
    );

    it.each([undefined, '', '    ', 'abcd', '  ab  '])(
      'MOTIVO_REQUERIDO con motivo %p (minimo 5 caracteres)',
      async (motivo) => {
        cargas.sembrarEvento(nuevoEvento({ estado: 'EN_ESPERA_AUTORIZACION' }));

        const resultado = await useCase.ejecutar(comoSupervisor({ motivo }), AHORA);

        expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_REQUERIDO' });
        expect(cargas.cancelaciones).toEqual([]);
      },
    );

    it('acepta un motivo de exactamente 5 caracteres', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(comoSupervisor({ motivo: 'abcde' }), AHORA);

      expect(resultado.exito).toBe(true);
    });
  });

  describe('CONTADOR', () => {
    it.each<EstadoCarga>(TODOS_LOS_ESTADOS)(
      'NO_PERMITIDO siempre (estado %s)',
      async (estado) => {
        cargas.sembrarEvento(nuevoEvento({ estado }));

        const resultado = await useCase.ejecutar(
          {
            eventoId: EVENTO_ID,
            usuarioAppId: 'u-contador',
            rolApp: 'CONTADOR' as RolApp,
            usuarioHandyId: null,
            motivo: 'motivo suficientemente largo',
          },
          AHORA,
        );

        expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
        expect(cargas.cancelaciones).toEqual([]);
      },
    );
  });
});
