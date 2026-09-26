import type {
  CargaPendienteVerificacion,
  ConsultasCargaRepository,
} from './consultas-carga.repository';
import { ListarPendientesVerificacionUseCase } from './listar-pendientes-verificacion.use-case';

/**
 * Pruebas de la cola del contador. Sin base de datos: doble en memoria del
 * puerto de lectura.
 */

const FECHA = new Date('2026-09-22T07:00:00-06:00');

class FakeConsultas implements ConsultasCargaRepository {
  constructor(private readonly cargas: CargaPendienteVerificacion[]) {}
  async listarPendientesVerificacion() {
    return this.cargas.map((c) => ({ ...c }));
  }
  async listarConflictosDeParticipante(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarDiscrepanciasDetalle(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }  async listarInicialesEnviadasDesde(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

function carga(
  parcial: Partial<CargaPendienteVerificacion> = {},
): CargaPendienteVerificacion {
  return {
    id: 'ev-1',
    rutaNombre: 'Ruta 1',
    vendedorNombre: 'Vendedor Uno',
    tipo: 'INICIAL',
    fechaConteo: FECHA,
    totalProductos: 40,
    bloqueadaPorCorte: false,
    fechaBloqueoCortePendiente: null,
    sesionContador: null,
    ...parcial,
  };
}

async function listar(
  cargas: CargaPendienteVerificacion[],
  usuarioAppId = 'contador-1',
) {
  return new ListarPendientesVerificacionUseCase(
    new FakeConsultas(cargas),
  ).ejecutar({
    usuarioAppId,
  });
}

describe('ListarPendientesVerificacionUseCase', () => {
  it('una carga sin segundo conteo iniciado queda LISTA', async () => {
    const [c] = await listar([carga()]);
    expect(c.estadoVerificacion).toBe('LISTA');
    expect(c.miSesionId).toBeNull();
    expect(c.verificandoPor).toBeNull();
  });

  it('una carga bloqueada por corte pendiente se marca asi aunque ya tenga sesion propia', async () => {
    const [c] = await listar([
      carga({
        bloqueadaPorCorte: true,
        sesionContador: {
          id: 's-1',
          usuarioAppId: 'contador-1',
          usuarioNombre: 'Yo',
          estado: 'ABIERTA',
        },
      }),
    ]);
    expect(c.estadoVerificacion).toBe('BLOQUEADA_CORTE_PENDIENTE');
  });

  it('con sesion propia devuelve su id para continuar', async () => {
    const [c] = await listar([
      carga({
        sesionContador: {
          id: 's-1',
          usuarioAppId: 'contador-1',
          usuarioNombre: 'Yo',
          estado: 'ABIERTA',
        },
      }),
    ]);
    expect(c.estadoVerificacion).toBe('EN_CURSO_PROPIA');
    expect(c.miSesionId).toBe('s-1');
    expect(c.verificandoPor).toBeNull();
  });

  it('con sesion de otra persona dice quien, sin exponer su sesion', async () => {
    const [c] = await listar([
      carga({
        sesionContador: {
          id: 's-9',
          usuarioAppId: 'contador-2',
          usuarioNombre: 'Otra Persona',
          estado: 'ABIERTA',
        },
      }),
    ]);
    expect(c.estadoVerificacion).toBe('EN_CURSO_OTRO');
    expect(c.miSesionId).toBeNull();
    expect(c.verificandoPor).toBe('Otra Persona');
    expect(c).not.toHaveProperty('sesionContador');
  });
});
