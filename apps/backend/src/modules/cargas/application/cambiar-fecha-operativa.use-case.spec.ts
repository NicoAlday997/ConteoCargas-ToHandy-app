import type { EstadoCarga, RolApp } from '@prisma/client';

import {
  HandySinRespuestaError,
  type HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import { TODOS_LOS_ESTADOS } from '../domain/estados-carga';
import {
  CambiarFechaOperativaUseCase,
  type EntradaCambiarFechaOperativa,
} from './cambiar-fecha-operativa.use-case';
import {
  CargaInicialDuplicadaError,
  type CargaRepository,
  type DatosCambiarFechaOperativa,
  type EventoCarga,
} from './carga.repository';

/**
 * Pruebas del caso de uso "cambiar fecha operativa". Sin base de datos ni red:
 * dobles en memoria de `CargaRepository` (solo lo que este caso de uso usa; no
 * tiene metodos de sesiones ni items, asi que cualquier intento de tocarlos
 * reventaria) y de `HandyGateway`.
 *
 * Cubre: permisos por rol (vendedor solo lo suyo y en BORRADOR; supervisor con
 * motivo salvo ENVIADA/CANCELADA/ENVIO_INCIERTO; contador nunca), la fecha
 * nueva (no pasada, distinta), la unicidad de la INICIAL, la regla de recargas
 * contra Handy, y que un rechazo no persiste nada.
 */

const AHORA = new Date('2026-09-25T18:00:00-06:00');
const DIA_26 = new Date('2026-09-26T00:00:00-06:00');
const DIA_27 = new Date('2026-09-27T00:00:00-06:00');
const EVENTO_ID = 'ev-1';
const RUTA_ID = 'ruta-1';
const VENDEDOR_APP_ID = 'u-vendedor';
const VENDEDOR_HANDY_ID = 42;
const SUPERVISOR_APP_ID = 'u-supervisor';

class FakeCargaRepository {
  readonly eventos = new Map<string, EventoCarga>();
  readonly cambios: DatosCambiarFechaOperativa[] = [];
  /** Si se fija, `cambiarFechaOperativa` lanza este error (carrera). */
  errorAlCambiar: Error | null = null;

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async buscarCargaInicialDeFecha(
    rutaId: string,
    fechaOperativa: Date,
  ): Promise<EventoCarga | null> {
    for (const evento of this.eventos.values()) {
      if (
        evento.rutaId === rutaId &&
        evento.tipo === 'INICIAL' &&
        evento.estado !== 'CANCELADA' &&
        evento.fechaOperativa.getTime() === fechaOperativa.getTime()
      ) {
        return { ...evento };
      }
    }
    return null;
  }

  async cambiarFechaOperativa(
    datos: DatosCambiarFechaOperativa,
  ): Promise<EventoCarga> {
    if (this.errorAlCambiar !== null) {
      const error = this.errorAlCambiar;
      this.errorAlCambiar = null;
      throw error;
    }
    const evento = this.eventos.get(datos.eventoId);
    if (!evento) throw new Error(`evento ${datos.eventoId} inexistente`);
    evento.fechaOperativa = datos.fechaNueva;
    this.cambios.push(datos);
    return { ...evento };
  }
}

class FakeHandy implements Pick<HandyGateway, 'consultarRutaAbierta'> {
  rutaAbierta: RutaHandy | null = null;
  error: Error | null = null;
  readonly llamadas: number[] = [];

  async consultarRutaAbierta(usuarioHandyId: number): Promise<RutaHandy | null> {
    this.llamadas.push(usuarioHandyId);
    if (this.error !== null) throw this.error;
    return this.rutaAbierta;
  }
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: RUTA_ID,
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: VENDEDOR_HANDY_ID,
    estado: 'BORRADOR',
    fechaConteo: AHORA,
    fechaOperativa: DIA_26,
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

function entradaVendedor(
  parcial: Partial<EntradaCambiarFechaOperativa> = {},
): EntradaCambiarFechaOperativa {
  return {
    eventoId: EVENTO_ID,
    usuarioAppId: VENDEDOR_APP_ID,
    rolApp: 'VENDEDOR',
    usuarioHandyId: VENDEDOR_HANDY_ID,
    fechaOperativa: DIA_27,
    ...parcial,
  };
}

function entradaSupervisor(
  parcial: Partial<EntradaCambiarFechaOperativa> = {},
): EntradaCambiarFechaOperativa {
  return {
    eventoId: EVENTO_ID,
    usuarioAppId: SUPERVISOR_APP_ID,
    rolApp: 'SUPERVISOR',
    usuarioHandyId: null,
    fechaOperativa: DIA_27,
    motivo: 'El camion sale el domingo',
    ...parcial,
  };
}

describe('CambiarFechaOperativaUseCase', () => {
  let cargas: FakeCargaRepository;
  let handy: FakeHandy;
  let useCase: CambiarFechaOperativaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    handy = new FakeHandy();
    useCase = new CambiarFechaOperativaUseCase(
      cargas as unknown as CargaRepository,
      handy as unknown as HandyGateway,
    );
  });

  describe('vendedor', () => {
    it('mueve su carga en BORRADOR y deja el renglon en la bitacora, sin motivo', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: true,
        evento: expect.objectContaining({ id: EVENTO_ID, fechaOperativa: DIA_27 }),
      });
      expect(cargas.cambios).toEqual([
        {
          eventoId: EVENTO_ID,
          fechaAnterior: DIA_26,
          fechaNueva: DIA_27,
          cambiadaPorId: VENDEDOR_APP_ID,
          motivo: null,
        },
      ]);
    });

    it('guarda el motivo opcional sin espacios sobrantes', async () => {
      cargas.sembrarEvento(nuevoEvento());

      await useCase.ejecutar(
        entradaVendedor({ motivo: '  me equivoque de dia  ' }),
        AHORA,
      );

      expect(cargas.cambios[0].motivo).toBe('me equivoque de dia');
    });

    it('normaliza la fecha nueva al inicio del dia en Mexico', async () => {
      cargas.sembrarEvento(nuevoEvento());

      await useCase.ejecutar(
        entradaVendedor({
          fechaOperativa: new Date('2026-09-27T15:30:00-06:00'),
        }),
        AHORA,
      );

      expect(cargas.cambios[0].fechaNueva).toEqual(DIA_27);
    });

    it('NO_PERMITIDO sobre la carga de otro vendedor', async () => {
      cargas.sembrarEvento(nuevoEvento({ usuarioHandyId: 99 }));

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
      expect(cargas.cambios).toEqual([]);
    });

    it('NO_PERMITIDO si su usuario no esta vinculado a Handy', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({ usuarioHandyId: null }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
    });

    it.each(TODOS_LOS_ESTADOS.filter((e) => e !== 'BORRADOR'))(
      'ESTADO_INVALIDO en %s: despues de BORRADOR el contador puede haber contado',
      async (estado) => {
        cargas.sembrarEvento(nuevoEvento({ estado }));

        const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

        expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
        expect(cargas.cambios).toEqual([]);
      },
    );
  });

  describe('supervisor', () => {
    const EXCLUIDOS: EstadoCarga[] = ['ENVIADA', 'CANCELADA', 'ENVIO_INCIERTO'];

    it.each(TODOS_LOS_ESTADOS.filter((e) => !EXCLUIDOS.includes(e)))(
      'mueve una carga en %s con motivo',
      async (estado) => {
        cargas.sembrarEvento(nuevoEvento({ estado }));

        const resultado = await useCase.ejecutar(entradaSupervisor(), AHORA);

        expect(resultado.exito).toBe(true);
        expect(cargas.cambios).toEqual([
          {
            eventoId: EVENTO_ID,
            fechaAnterior: DIA_26,
            fechaNueva: DIA_27,
            cambiadaPorId: SUPERVISOR_APP_ID,
            motivo: 'El camion sale el domingo',
          },
        ]);
      },
    );

    it.each(EXCLUIDOS)('ESTADO_INVALIDO en %s', async (estado) => {
      cargas.sembrarEvento(nuevoEvento({ estado }));

      const resultado = await useCase.ejecutar(entradaSupervisor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
      expect(cargas.cambios).toEqual([]);
    });

    it.each([undefined, '', '    ', 'abcd', '  ab  '])(
      'MOTIVO_REQUERIDO con motivo %p',
      async (motivo) => {
        cargas.sembrarEvento(nuevoEvento());

        const resultado = await useCase.ejecutar(
          entradaSupervisor({ motivo }),
          AHORA,
        );

        expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_REQUERIDO' });
        expect(cargas.cambios).toEqual([]);
      },
    );

    it('puede mover la carga de cualquier vendedor', async () => {
      cargas.sembrarEvento(nuevoEvento({ usuarioHandyId: 99 }));

      const resultado = await useCase.ejecutar(entradaSupervisor(), AHORA);

      expect(resultado.exito).toBe(true);
    });
  });

  it('el CONTADOR nunca cambia la fecha', async () => {
    cargas.sembrarEvento(nuevoEvento());

    const resultado = await useCase.ejecutar(
      entradaSupervisor({ rolApp: 'CONTADOR' as RolApp }),
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'NO_PERMITIDO' });
    expect(cargas.cambios).toEqual([]);
  });

  it('NO_ENCONTRADA si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'NO_ENCONTRADA' });
  });

  describe('fecha nueva', () => {
    it('FECHA_OPERATIVA_INVALIDA si es un dia pasado', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({
          fechaOperativa: new Date('2026-09-24T00:00:00-06:00'),
        }),
        AHORA,
      );

      expect(resultado).toEqual({
        exito: false,
        motivo: 'FECHA_OPERATIVA_INVALIDA',
      });
      expect(cargas.cambios).toEqual([]);
    });

    it('acepta hoy (camion descompuesto: se cuenta y sale el mismo dia)', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({
          fechaOperativa: new Date('2026-09-25T00:00:00-06:00'),
        }),
        AHORA,
      );

      expect(resultado.exito).toBe(true);
    });

    it('MISMA_FECHA si cae en el mismo dia que ya tiene, aunque sea otra hora', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({
          fechaOperativa: new Date('2026-09-26T13:00:00-06:00'),
        }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'MISMA_FECHA' });
      expect(cargas.cambios).toEqual([]);
    });
  });

  describe('INICIAL', () => {
    it('YA_TIENE_CARGA_ABIERTA si la ruta ya tiene otra INICIAL ese dia', async () => {
      cargas.sembrarEvento(nuevoEvento());
      cargas.sembrarEvento(
        nuevoEvento({ id: 'ev-otra', fechaOperativa: DIA_27, estado: 'ENVIADA' }),
      );

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: 'ev-otra',
      });
      expect(cargas.cambios).toEqual([]);
    });

    it('una INICIAL CANCELADA ese dia no estorba', async () => {
      cargas.sembrarEvento(nuevoEvento());
      cargas.sembrarEvento(
        nuevoEvento({
          id: 'ev-cancelada',
          fechaOperativa: DIA_27,
          estado: 'CANCELADA',
        }),
      );

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
    });

    it('una RECARGA de la ruta ese dia no estorba a la INICIAL', async () => {
      cargas.sembrarEvento(nuevoEvento());
      cargas.sembrarEvento(
        nuevoEvento({ id: 'ev-recarga', tipo: 'RECARGA', fechaOperativa: DIA_27 }),
      );

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
    });

    it('carrera: si la base rechaza el cambio por el indice parcial, responde YA_TIENE_CARGA_ABIERTA', async () => {
      cargas.sembrarEvento(nuevoEvento());
      cargas.errorAlCambiar = new CargaInicialDuplicadaError();
      // La otra INICIAL "aparece" justo cuando se intenta el cambio.
      const original = cargas.cambiarFechaOperativa.bind(cargas);
      cargas.cambiarFechaOperativa = async (datos) => {
        cargas.sembrarEvento(
          nuevoEvento({ id: 'ev-carrera', fechaOperativa: DIA_27 }),
        );
        return original(datos);
      };

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: 'ev-carrera',
      });
    });

    it('no le pregunta a Handy', async () => {
      cargas.sembrarEvento(nuevoEvento());

      await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(handy.llamadas).toEqual([]);
    });
  });

  describe('RECARGA', () => {
    function sembrarRecargaEInicialDel27(estadoInicial: EstadoCarga): void {
      cargas.sembrarEvento(nuevoEvento({ tipo: 'RECARGA' }));
      cargas.sembrarEvento(
        nuevoEvento({
          id: 'ev-inicial-27',
          fechaOperativa: DIA_27,
          estado: estadoInicial,
          idHandy: estadoInicial === 'ENVIADA' ? 'handy-27' : null,
        }),
      );
    }

    it('se mueve si el dia nuevo tiene INICIAL ENVIADA y es la ruta abierta en Handy', async () => {
      sembrarRecargaEInicialDel27('ENVIADA');
      handy.rutaAbierta = { id: 'handy-27' };

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
      expect(handy.llamadas).toEqual([VENDEDOR_HANDY_ID]);
    });

    it('SIN_SALIDA_ENVIADA si el dia nuevo no tiene INICIAL', async () => {
      cargas.sembrarEvento(nuevoEvento({ tipo: 'RECARGA' }));

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
      expect(cargas.cambios).toEqual([]);
    });

    it('SIN_SALIDA_ENVIADA si la INICIAL del dia nuevo aun no se envia', async () => {
      sembrarRecargaEInicialDel27('EN_ESPERA_CONTADOR');

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
      expect(handy.llamadas).toEqual([]);
    });

    it('SIN_RUTA_ABIERTA_EN_HANDY si Handy no tiene ruta abierta', async () => {
      sembrarRecargaEInicialDel27('ENVIADA');
      handy.rutaAbierta = null;

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SIN_RUTA_ABIERTA_EN_HANDY',
      });
      expect(cargas.cambios).toEqual([]);
    });

    it('SIN_RUTA_ABIERTA_EN_HANDY si la ruta abierta en Handy es otra', async () => {
      sembrarRecargaEInicialDel27('ENVIADA');
      handy.rutaAbierta = { id: 'handy-otra' };

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SIN_RUTA_ABIERTA_EN_HANDY',
      });
    });

    it('si Handy no responde, pasa con la regla local (no se bloquea por un tercero caido)', async () => {
      sembrarRecargaEInicialDel27('ENVIADA');
      handy.error = new HandySinRespuestaError('/route/current', new Error('timeout'));

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
    });
  });
});
