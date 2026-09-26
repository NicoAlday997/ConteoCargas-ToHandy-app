import {
  HandyErrorServidorError,
  HandyGateway,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  type PaginaHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type {
  AsignacionRepository,
  AsignacionVigente,
} from './asignacion.repository';
import type {
  ConsultasCargaRepository,
  DiaRecargable,
} from './consultas-carga.repository';
import { ListarDiasRecargablesUseCase } from './listar-dias-recargables.use-case';

/**
 * Pruebas de "dias recargables". Sin red ni base de datos: dobles en memoria de
 * la asignacion, del puerto de lectura y de Handy. El doble de consultas aplica
 * los mismos filtros que el adaptador Prisma sobre una lista sembrada.
 *
 * Ramas: (a) siempre se le pregunta a Handy; (b) sin ruta abierta; (c) ruta
 * abierta con y sin inicial nuestra; (d) Handy caido -> criterio local.
 */

const USUARIO_HANDY_ID = 42;
const HOY = new Date('2026-09-25T00:00:00-06:00');
const AYER = new Date('2026-09-24T00:00:00-06:00');
const MANANA = new Date('2026-09-26T00:00:00-06:00');
const PASADO_MANANA = new Date('2026-09-27T00:00:00-06:00');

interface InicialSembrada {
  id: string;
  rutaId: string;
  estado: 'ENVIADA' | 'BORRADOR' | 'ERROR_ENVIO' | 'CANCELADA';
  fechaOperativa: Date;
  idHandy?: string;
}

class FakeConsultas implements ConsultasCargaRepository {
  readonly llamadas: Array<{ rutaId: string; desde: Date }> = [];
  constructor(private readonly iniciales: InicialSembrada[]) {}

  async listarInicialesEnviadasDesde(
    rutaId: string,
    desde: Date,
  ): Promise<DiaRecargable[]> {
    this.llamadas.push({ rutaId, desde });
    return this.iniciales
      .filter(
        (i) =>
          i.rutaId === rutaId &&
          i.estado === 'ENVIADA' &&
          i.fechaOperativa.getTime() >= desde.getTime(),
      )
      .sort((a, b) => a.fechaOperativa.getTime() - b.fechaOperativa.getTime())
      .map((i) => ({
        fechaOperativa: i.fechaOperativa,
        eventoInicialId: i.id,
      }));
  }
  async buscarInicialEnviadaPorIdHandy(
    rutaId: string,
    idHandy: string,
  ): Promise<DiaRecargable | null> {
    const i = this.iniciales.find(
      (x) =>
        x.rutaId === rutaId && x.estado === 'ENVIADA' && x.idHandy === idHandy,
    );
    return i ? { fechaOperativa: i.fechaOperativa, eventoInicialId: i.id } : null;
  }
  async listarPendientesVerificacion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarConflictosDeParticipante(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarDiscrepanciasDetalle(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

class FakeAsignaciones implements AsignacionRepository {
  constructor(private readonly vigente: AsignacionVigente | null) {}
  async buscarAsignacionVigente(): Promise<AsignacionVigente | null> {
    return this.vigente;
  }
}

class FakeHandyGateway extends HandyGateway {
  /** `null` = sin ruta abierta (404 verificado). */
  rutaAbierta: RutaHandy | null = null;
  /** Si se fija, `consultarRutaAbierta` lo lanza. */
  falla: Error | null = null;
  readonly consultas: number[] = [];

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.consultas.push(usuarioHandyId);
    if (this.falla) throw this.falla;
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

function crear(
  iniciales: InicialSembrada[],
  vigente: AsignacionVigente | null = { rutaId: 'ruta-7', plantillaId: 'p-1' },
) {
  const consultas = new FakeConsultas(iniciales);
  const handy = new FakeHandyGateway();
  const useCase = new ListarDiasRecargablesUseCase(
    new FakeAsignaciones(vigente),
    consultas,
    handy,
  );
  return { consultas, handy, useCase };
}

const ENTRADA = { usuarioAppId: 'v1', usuarioHandyId: USUARIO_HANDY_ID };

describe('ListarDiasRecargablesUseCase', () => {
  it('(a) le pregunta a Handy por la ruta abierta del vendedor', async () => {
    const { handy, useCase } = crear([]);

    await useCase.ejecutar(ENTRADA, HOY);

    expect(handy.consultas).toEqual([USUARIO_HANDY_ID]);
  });

  describe('(b) Handy dice que no hay ruta abierta', () => {
    it('no hay dias: SIN_RUTA_ABIERTA, verificado', async () => {
      const { useCase } = crear([
        {
          id: 'ev-1',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: HOY,
          idHandy: '2044893',
        },
      ]);

      expect(await useCase.ejecutar(ENTRADA, HOY)).toEqual({
        dias: [],
        motivo: 'SIN_RUTA_ABIERTA',
        verificadoConHandy: true,
      });
    });

    it('caso real: la inicial ENVIADA de hoy cuya ruta ya se cancelo en Handy no se ofrece', async () => {
      // cmugggtcb00194f281nxnb6m0: INICIAL, ENVIADA, 2026-09-25, idHandy 2044893.
      const { useCase } = crear([
        {
          id: 'cmugggtcb00194f281nxnb6m0',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: HOY,
          idHandy: '2044893',
        },
      ]);

      const resultado = await useCase.ejecutar(ENTRADA, HOY);

      expect(resultado.dias).toEqual([]);
    });
  });

  describe('(c) Handy tiene una ruta abierta', () => {
    it('con nuestra inicial ENVIADA de esa ruta: ese unico dia', async () => {
      const { handy, useCase } = crear([
        {
          id: 'ev-vieja',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: MANANA,
          idHandy: '111',
        },
        {
          id: 'ev-abierta',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: PASADO_MANANA,
          idHandy: '222',
        },
      ]);
      handy.rutaAbierta = { id: '222' };

      expect(await useCase.ejecutar(ENTRADA, HOY)).toEqual({
        dias: [{ fechaOperativa: PASADO_MANANA, eventoInicialId: 'ev-abierta' }],
        verificadoConHandy: true,
      });
    });

    it('manda Handy, no la fecha: se ofrece aunque la inicial sea de un dia pasado', async () => {
      const { consultas, handy, useCase } = crear([
        {
          id: 'ev-ayer',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: AYER,
          idHandy: '333',
        },
      ]);
      handy.rutaAbierta = { id: '333' };

      const resultado = await useCase.ejecutar(ENTRADA, HOY);

      expect(resultado.dias).toEqual([
        { fechaOperativa: AYER, eventoInicialId: 'ev-ayer' },
      ]);
      expect(consultas.llamadas).toHaveLength(0);
    });

    it('sin inicial nuestra con ese idHandy: RUTA_NO_RECONOCIDA', async () => {
      const { handy, useCase } = crear([
        {
          id: 'ev-1',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: HOY,
          idHandy: '111',
        },
      ]);
      handy.rutaAbierta = { id: '999' };

      expect(await useCase.ejecutar(ENTRADA, HOY)).toEqual({
        dias: [],
        motivo: 'RUTA_NO_RECONOCIDA',
        verificadoConHandy: true,
      });
    });

    it('la inicial con ese idHandy pero de otra ruta no se reconoce', async () => {
      const { handy, useCase } = crear([
        {
          id: 'ev-otra',
          rutaId: 'ruta-9',
          estado: 'ENVIADA',
          fechaOperativa: HOY,
          idHandy: '222',
        },
      ]);
      handy.rutaAbierta = { id: '222' };

      expect(await useCase.ejecutar(ENTRADA, HOY)).toMatchObject({
        dias: [],
        motivo: 'RUTA_NO_RECONOCIDA',
      });
    });
  });

  describe('(d) Handy no se puede consultar: criterio local, sin verificar', () => {
    it.each([
      ['token invalido', new HandyTokenInvalidoError('/x')],
      ['5xx', new HandyErrorServidorError('/x', 503)],
      ['sin respuesta', new HandySinRespuestaError('/x', new Error('timeout'))],
      ['estado inesperado', new HandyRespuestaNoOkError('/x', 418)],
    ])('%s: devuelve las iniciales ENVIADAS de hoy en adelante', async (_n, falla) => {
      const { handy, useCase } = crear([
        { id: 'ev-ayer', rutaId: 'ruta-7', estado: 'ENVIADA', fechaOperativa: AYER },
        { id: 'ev-hoy', rutaId: 'ruta-7', estado: 'ENVIADA', fechaOperativa: HOY },
        { id: 'ev-b', rutaId: 'ruta-7', estado: 'BORRADOR', fechaOperativa: MANANA },
        { id: 'ev-otra', rutaId: 'ruta-9', estado: 'ENVIADA', fechaOperativa: HOY },
      ]);
      handy.falla = falla;

      expect(await useCase.ejecutar(ENTRADA, HOY)).toEqual({
        dias: [{ fechaOperativa: HOY, eventoInicialId: 'ev-hoy' }],
        verificadoConHandy: false,
      });
    });

    it('consulta desde el inicio del dia de negocio en Mexico, no desde el instante ni el dia UTC', async () => {
      const { consultas, handy, useCase } = crear([]);
      handy.falla = new HandySinRespuestaError('/x', null);

      // 25 de septiembre, 22:30 en Mexico = 26, 04:30 UTC.
      await useCase.ejecutar(ENTRADA, new Date('2026-09-26T04:30:00Z'));

      expect(consultas.llamadas).toEqual([{ rutaId: 'ruta-7', desde: HOY }]);
    });

    it('un error que no es de Handy se propaga', async () => {
      const { handy, useCase } = crear([]);
      handy.falla = new TypeError('bug');

      await expect(useCase.ejecutar(ENTRADA, HOY)).rejects.toThrow(TypeError);
    });
  });

  it('sin asignacion vigente no hay dias y no se molesta a Handy', async () => {
    const { consultas, handy, useCase } = crear([], null);

    expect(await useCase.ejecutar(ENTRADA, HOY)).toEqual({
      dias: [],
      motivo: 'SIN_RUTA_ASIGNADA',
      verificadoConHandy: false,
    });
    expect(handy.consultas).toHaveLength(0);
    expect(consultas.llamadas).toHaveLength(0);
  });
});
