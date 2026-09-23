import { ListarPermisosVigentesUseCase } from './listar-permisos-vigentes.use-case';
import {
  PermisoCargaRepository,
  type PermisoCargaSinLiquidar,
  type PermisoVigenteDetallado,
  type RutaParaPermiso,
} from './permiso-carga.repository';

const AHORA = new Date('2026-09-23T17:00:00-06:00');
const HORA = 60 * 60 * 1000;

/** Doble que aplica el mismo criterio de vigencia que el adaptador real. */
class FakePermisoCargaRepository extends PermisoCargaRepository {
  permisos: PermisoVigenteDetallado[] = [];
  readonly consultas: Date[] = [];

  async listarNoVencidos(ahora: Date): Promise<PermisoVigenteDetallado[]> {
    this.consultas.push(ahora);
    return this.permisos
      .filter((p) => p.fechaExpiracion.getTime() > ahora.getTime())
      .sort(
        (a, b) => a.fechaExpiracion.getTime() - b.fechaExpiracion.getTime(),
      );
  }

  existeRuta(): Promise<boolean> {
    throw new Error('no usado en esta prueba');
  }
  buscarVigente(): Promise<PermisoCargaSinLiquidar | null> {
    throw new Error('no usado en esta prueba');
  }
  crear(): Promise<PermisoCargaSinLiquidar> {
    throw new Error('no usado en esta prueba');
  }
  listarRutasActivas(): Promise<RutaParaPermiso[]> {
    throw new Error('no usado en esta prueba');
  }
}

function permiso(
  id: string,
  datos: Partial<PermisoVigenteDetallado> = {},
): PermisoVigenteDetallado {
  return {
    id,
    rutaId: 'ruta-7',
    rutaNombre: 'Ruta 7',
    otorgadoPorId: 'sup-1',
    otorgadoPorNombre: 'Ana Supervisora',
    motivo: 'Liquida mañana junto con hoy',
    fechaOtorgado: new Date(AHORA.getTime() - HORA),
    fechaExpiracion: new Date(AHORA.getTime() + 23 * HORA),
    usado: false,
    eventoCargaId: null,
    ...datos,
  };
}

describe('ListarPermisosVigentesUseCase', () => {
  let permisos: FakePermisoCargaRepository;
  let useCase: ListarPermisosVigentesUseCase;

  beforeEach(() => {
    permisos = new FakePermisoCargaRepository();
    useCase = new ListarPermisosVigentesUseCase(permisos);
  });

  it('consulta con el instante recibido', async () => {
    await useCase.ejecutar(AHORA);

    expect(permisos.consultas).toEqual([AHORA]);
  });

  it('devuelve los que no han vencido, usados o no, con quien los otorgo', async () => {
    permisos.permisos = [
      permiso('vigente'),
      permiso('usado', {
        usado: true,
        eventoCargaId: 'ev-1',
        fechaExpiracion: new Date(AHORA.getTime() + 24 * HORA),
      }),
      permiso('vencido', { fechaExpiracion: AHORA }),
    ];

    const resultado = await useCase.ejecutar(AHORA);

    expect(resultado.map((p) => p.id)).toEqual(['vigente', 'usado']);
    expect(resultado[1]).toMatchObject({ usado: true, eventoCargaId: 'ev-1' });
    expect(resultado[0]).toMatchObject({
      rutaNombre: 'Ruta 7',
      otorgadoPorNombre: 'Ana Supervisora',
      motivo: 'Liquida mañana junto con hoy',
    });
  });

  it('ordena del que vence antes al que vence despues', async () => {
    permisos.permisos = [
      permiso('tarde', {
        fechaExpiracion: new Date(AHORA.getTime() + 20 * HORA),
      }),
      permiso('pronto', {
        fechaExpiracion: new Date(AHORA.getTime() + 2 * HORA),
      }),
    ];

    const resultado = await useCase.ejecutar(AHORA);

    expect(resultado.map((p) => p.id)).toEqual(['pronto', 'tarde']);
  });

  it('sin permisos vigentes devuelve una lista vacia', async () => {
    expect(await useCase.ejecutar(AHORA)).toEqual([]);
  });
});
