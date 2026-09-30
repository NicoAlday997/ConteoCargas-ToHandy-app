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
import type {
  DiaNoLaborable,
  DiaNoLaborableRepository,
} from './dia-no-laborable.repository';

/**
 * Pruebas del caso de uso "cambiar fecha operativa". Sin base de datos ni red:
 * dobles en memoria de `CargaRepository` (solo lo que este caso de uso usa; no
 * tiene metodos de sesiones ni items, asi que cualquier intento de tocarlos
 * reventaria) y de `HandyGateway`.
 *
 * Cubre: permisos por rol (vendedor solo lo suyo y en BORRADOR; supervisor con
 * motivo salvo CANCELADA/ENVIO_INCIERTO, ENVIADA incluida; contador nunca), la fecha
 * nueva (no pasada, distinta), la unicidad de la INICIAL, la regla de recargas
 * contra Handy, el calendario laboral por rol, y que un rechazo no persiste
 * nada.
 *
 * Septiembre de 2026: AHORA es el viernes 25; el 26 es sabado, el 27 domingo y
 * el 28 lunes.
 */

const AHORA = new Date('2026-09-25T18:00:00-06:00');
const DIA_26 = new Date('2026-09-26T00:00:00-06:00');
const DIA_25 = new Date('2026-09-25T00:00:00-06:00');
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

/** Dias no laborables en memoria; `listarEntre` respeta el rango. */
class FakeDiasNoLaborables {
  dias: Date[] = [];

  async listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]> {
    return this.dias
      .filter((d) => d >= desde && d <= hasta)
      .map((fecha) => ({
        fecha,
        motivo: 'festivo',
        creadoPorId: null,
        creadoPorNombre: null,
        creadoEn: fecha,
      }));
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
    fechaOperativa: DIA_25,
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
    fechaOperativa: DIA_25,
    motivo: 'El camion sale hoy mismo',
    ...parcial,
  };
}

describe('CambiarFechaOperativaUseCase', () => {
  let cargas: FakeCargaRepository;
  let handy: FakeHandy;
  let noLaborables: FakeDiasNoLaborables;
  let useCase: CambiarFechaOperativaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    handy = new FakeHandy();
    noLaborables = new FakeDiasNoLaborables();
    useCase = new CambiarFechaOperativaUseCase(
      cargas as unknown as CargaRepository,
      handy as unknown as HandyGateway,
      noLaborables as unknown as DiaNoLaborableRepository,
    );
  });

  describe('vendedor', () => {
    it('mueve su carga en BORRADOR y deja el renglon en la bitacora, sin motivo', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: true,
        evento: expect.objectContaining({ id: EVENTO_ID, fechaOperativa: DIA_25 }),
      });
      expect(cargas.cambios).toEqual([
        {
          eventoId: EVENTO_ID,
          fechaAnterior: DIA_26,
          fechaNueva: DIA_25,
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
          fechaOperativa: new Date('2026-09-25T15:30:00-06:00'),
        }),
        AHORA,
      );

      expect(cargas.cambios[0].fechaNueva).toEqual(DIA_25);
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
    const EXCLUIDOS: EstadoCarga[] = ['CANCELADA', 'ENVIO_INCIERTO'];

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
            fechaNueva: DIA_25,
            cambiadaPorId: SUPERVISOR_APP_ID,
            motivo: 'El camion sale hoy mismo',
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
        nuevoEvento({ id: 'ev-otra', fechaOperativa: DIA_25, estado: 'ENVIADA' }),
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
          fechaOperativa: DIA_25,
          estado: 'CANCELADA',
        }),
      );

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
    });

    it('una RECARGA de la ruta ese dia no estorba a la INICIAL', async () => {
      cargas.sembrarEvento(nuevoEvento());
      cargas.sembrarEvento(
        nuevoEvento({ id: 'ev-recarga', tipo: 'RECARGA', fechaOperativa: DIA_25 }),
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
          nuevoEvento({ id: 'ev-carrera', fechaOperativa: DIA_25 }),
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
    function sembrarRecargaEInicialDel25(estadoInicial: EstadoCarga): void {
      cargas.sembrarEvento(nuevoEvento({ tipo: 'RECARGA' }));
      cargas.sembrarEvento(
        nuevoEvento({
          id: 'ev-inicial-25',
          fechaOperativa: DIA_25,
          estado: estadoInicial,
          idHandy: estadoInicial === 'ENVIADA' ? 'handy-25' : null,
        }),
      );
    }

    it('se mueve si el dia nuevo tiene INICIAL ENVIADA y es la ruta abierta en Handy', async () => {
      sembrarRecargaEInicialDel25('ENVIADA');
      handy.rutaAbierta = { id: 'handy-25' };

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
      sembrarRecargaEInicialDel25('EN_ESPERA_CONTADOR');

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
      expect(handy.llamadas).toEqual([]);
    });

    it('SIN_RUTA_ABIERTA_EN_HANDY si Handy no tiene ruta abierta', async () => {
      sembrarRecargaEInicialDel25('ENVIADA');
      handy.rutaAbierta = null;

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SIN_RUTA_ABIERTA_EN_HANDY',
      });
      expect(cargas.cambios).toEqual([]);
    });

    it('SIN_RUTA_ABIERTA_EN_HANDY si la ruta abierta en Handy es otra', async () => {
      sembrarRecargaEInicialDel25('ENVIADA');
      handy.rutaAbierta = { id: 'handy-otra' };

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'SIN_RUTA_ABIERTA_EN_HANDY',
      });
    });

    it('si Handy no responde, pasa con la regla local (no se bloquea por un tercero caido)', async () => {
      sembrarRecargaEInicialDel25('ENVIADA');
      handy.error = new HandySinRespuestaError('/route/current', new Error('timeout'));

      const resultado = await useCase.ejecutar(entradaVendedor(), AHORA);

      expect(resultado.exito).toBe(true);
    });
  });

  describe('calendario laboral', () => {
    const DOMINGO_27 = new Date('2026-09-27T00:00:00-06:00');
    const LUNES_28 = new Date('2026-09-28T00:00:00-06:00');
    const MARTES_29 = new Date('2026-09-29T00:00:00-06:00');
    const JUEVES_1 = new Date('2026-10-01T00:00:00-06:00');
    const SABADO = new Date('2026-09-26T17:00:00-06:00');

    it('vendedor: FECHA_NO_DISPONIBLE si elige un domingo', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({ fechaOperativa: DOMINGO_27 }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
      expect(cargas.cambios).toEqual([]);
    });

    it('vendedor: FECHA_NO_DISPONIBLE si elige un dia habil pero mas alla de la siguiente salida', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({ fechaOperativa: JUEVES_1 }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
    });

    it('vendedor en sabado: puede mover al lunes (la siguiente salida)', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaVendedor({ fechaOperativa: LUNES_28 }),
        SABADO,
      );

      expect(resultado.exito).toBe(true);
    });

    it('vendedor en sabado con el lunes festivo: el lunes no, el martes si', async () => {
      noLaborables.dias = [LUNES_28];
      cargas.sembrarEvento(nuevoEvento());

      expect(
        await useCase.ejecutar(entradaVendedor({ fechaOperativa: LUNES_28 }), SABADO),
      ).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
      expect(
        (await useCase.ejecutar(entradaVendedor({ fechaOperativa: MARTES_29 }), SABADO))
          .exito,
      ).toBe(true);
    });

    it('supervisor: puede mover a cualquier dia habil futuro', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaSupervisor({ fechaOperativa: JUEVES_1 }),
        AHORA,
      );

      expect(resultado.exito).toBe(true);
    });

    it('supervisor: FECHA_NO_DISPONIBLE en domingo', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaSupervisor({ fechaOperativa: DOMINGO_27 }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
      expect(cargas.cambios).toEqual([]);
    });

    it('supervisor: FECHA_NO_DISPONIBLE en un dia marcado, aunque este lejos', async () => {
      const lejano = new Date('2026-12-25T00:00:00-06:00');
      noLaborables.dias = [lejano];
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaSupervisor({ fechaOperativa: lejano }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
    });

    it('un dia pasado sigue siendo FECHA_OPERATIVA_INVALIDA, no FECHA_NO_DISPONIBLE', async () => {
      cargas.sembrarEvento(nuevoEvento());

      const resultado = await useCase.ejecutar(
        entradaSupervisor({ fechaOperativa: new Date('2026-09-20T00:00:00-06:00') }),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_OPERATIVA_INVALIDA' });
    });
  });
});
