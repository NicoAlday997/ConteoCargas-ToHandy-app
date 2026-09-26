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
 * Pruebas de "dias recargables". Sin base de datos: dobles en memoria de la
 * asignacion y del puerto de lectura. El doble de consultas aplica el mismo
 * filtro que el adaptador Prisma (ruta, INICIAL, ENVIADA, desde) sobre una lista
 * sembrada, para probar tambien que el caso de uso le pasa el "desde" correcto.
 */

const HOY = new Date('2026-09-25T00:00:00-06:00');
const AYER = new Date('2026-09-24T00:00:00-06:00');
const MANANA = new Date('2026-09-26T00:00:00-06:00');
const PASADO_MANANA = new Date('2026-09-27T00:00:00-06:00');

interface InicialSembrada {
  id: string;
  rutaId: string;
  estado: 'ENVIADA' | 'BORRADOR' | 'ERROR_ENVIO' | 'CANCELADA';
  fechaOperativa: Date;
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

function crear(
  iniciales: InicialSembrada[],
  vigente: AsignacionVigente | null = { rutaId: 'ruta-7', plantillaId: 'p-1' },
) {
  const consultas = new FakeConsultas(iniciales);
  const useCase = new ListarDiasRecargablesUseCase(
    new FakeAsignaciones(vigente),
    consultas,
  );
  return { consultas, useCase };
}

describe('ListarDiasRecargablesUseCase', () => {
  it('devuelve la salida enviada de hoy de la ruta del vendedor', async () => {
    const { useCase } = crear([
      { id: 'ev-1', rutaId: 'ruta-7', estado: 'ENVIADA', fechaOperativa: HOY },
    ]);

    const dias = await useCase.ejecutar(
      { usuarioAppId: 'v1' },
      new Date('2026-09-25T14:00:00-06:00'),
    );

    expect(dias).toEqual([{ fechaOperativa: HOY, eventoInicialId: 'ev-1' }]);
  });

  it('consulta desde el inicio del dia de negocio en Mexico, no desde el instante ni el dia UTC', async () => {
    const { consultas, useCase } = crear([]);

    // 25 de septiembre, 22:30 en Mexico = 26, 04:30 UTC.
    await useCase.ejecutar(
      { usuarioAppId: 'v1' },
      new Date('2026-09-26T04:30:00Z'),
    );

    expect(consultas.llamadas).toEqual([{ rutaId: 'ruta-7', desde: HOY }]);
  });

  it('no incluye dias pasados', async () => {
    const { useCase } = crear([
      {
        id: 'ev-ayer',
        rutaId: 'ruta-7',
        estado: 'ENVIADA',
        fechaOperativa: AYER,
      },
      {
        id: 'ev-hoy',
        rutaId: 'ruta-7',
        estado: 'ENVIADA',
        fechaOperativa: HOY,
      },
    ]);

    const dias = await useCase.ejecutar({ usuarioAppId: 'v1' }, HOY);

    expect(dias.map((d) => d.eventoInicialId)).toEqual(['ev-hoy']);
  });

  it('solo las ENVIADAS: ignora iniciales en borrador, con error de envio o canceladas', async () => {
    const { useCase } = crear([
      { id: 'ev-b', rutaId: 'ruta-7', estado: 'BORRADOR', fechaOperativa: HOY },
      {
        id: 'ev-e',
        rutaId: 'ruta-7',
        estado: 'ERROR_ENVIO',
        fechaOperativa: MANANA,
      },
      {
        id: 'ev-c',
        rutaId: 'ruta-7',
        estado: 'CANCELADA',
        fechaOperativa: PASADO_MANANA,
      },
    ]);

    expect(await useCase.ejecutar({ usuarioAppId: 'v1' }, HOY)).toEqual([]);
  });

  it('solo la ruta asignada al vendedor', async () => {
    const { useCase } = crear([
      {
        id: 'ev-otra',
        rutaId: 'ruta-9',
        estado: 'ENVIADA',
        fechaOperativa: HOY,
      },
    ]);

    expect(await useCase.ejecutar({ usuarioAppId: 'v1' }, HOY)).toEqual([]);
  });

  it('varias salidas enviadas se devuelven en orden ascendente', async () => {
    const { useCase } = crear([
      {
        id: 'ev-pm',
        rutaId: 'ruta-7',
        estado: 'ENVIADA',
        fechaOperativa: PASADO_MANANA,
      },
      {
        id: 'ev-hoy',
        rutaId: 'ruta-7',
        estado: 'ENVIADA',
        fechaOperativa: HOY,
      },
      {
        id: 'ev-m',
        rutaId: 'ruta-7',
        estado: 'ENVIADA',
        fechaOperativa: MANANA,
      },
    ]);

    const dias = await useCase.ejecutar({ usuarioAppId: 'v1' }, HOY);

    expect(dias).toEqual([
      { fechaOperativa: HOY, eventoInicialId: 'ev-hoy' },
      { fechaOperativa: MANANA, eventoInicialId: 'ev-m' },
      { fechaOperativa: PASADO_MANANA, eventoInicialId: 'ev-pm' },
    ]);
  });

  it('sin asignacion vigente devuelve la lista vacia sin consultar cargas', async () => {
    const { consultas, useCase } = crear(
      [
        {
          id: 'ev-1',
          rutaId: 'ruta-7',
          estado: 'ENVIADA',
          fechaOperativa: HOY,
        },
      ],
      null,
    );

    expect(await useCase.ejecutar({ usuarioAppId: 'v1' }, HOY)).toEqual([]);
    expect(consultas.llamadas).toHaveLength(0);
  });
});
