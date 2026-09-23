import {
  OtorgarPermisoCargaUseCase,
  VIGENCIA_PERMISO_MS,
} from './otorgar-permiso-carga.use-case';
import {
  PermisoCargaRepository,
  type DatosCrearPermiso,
  type PermisoCargaSinLiquidar,
  type PermisoVigenteDetallado,
} from './permiso-carga.repository';

/**
 * Pruebas del permiso del supervisor para cargar con la ruta anterior sin
 * liquidar. Sin base de datos: doble en memoria de `PermisoCargaRepository`.
 */

const AHORA = new Date('2026-09-23T17:00:00-06:00');

class FakePermisoCargaRepository extends PermisoCargaRepository {
  rutas = new Set<string>(['ruta-7', 'ruta-9']);
  readonly permisos: PermisoCargaSinLiquidar[] = [];
  readonly creados: DatosCrearPermiso[] = [];
  private secuencia = 0;

  async existeRuta(rutaId: string): Promise<boolean> {
    return this.rutas.has(rutaId);
  }

  async buscarVigente(
    rutaId: string,
    ahora: Date,
  ): Promise<PermisoCargaSinLiquidar | null> {
    return (
      this.permisos.find(
        (p) =>
          p.rutaId === rutaId &&
          !p.usado &&
          p.fechaExpiracion.getTime() > ahora.getTime(),
      ) ?? null
    );
  }

  async crear(datos: DatosCrearPermiso): Promise<PermisoCargaSinLiquidar> {
    this.secuencia += 1;
    this.creados.push(datos);
    const permiso = {
      id: `permiso-${this.secuencia}`,
      ...datos,
      usado: false,
      eventoCargaId: null,
    };
    this.permisos.push(permiso);
    return permiso;
  }

  listarVigentes(): Promise<PermisoVigenteDetallado[]> {
    throw new Error('no usado en esta prueba');
  }
}

describe('OtorgarPermisoCargaUseCase', () => {
  let permisos: FakePermisoCargaRepository;
  let useCase: OtorgarPermisoCargaUseCase;
  const entrada = {
    rutaId: 'ruta-7',
    motivo: 'Liquida mañana junto con hoy',
    usuarioAppId: 'sup-1',
  };

  beforeEach(() => {
    permisos = new FakePermisoCargaRepository();
    useCase = new OtorgarPermisoCargaUseCase(permisos);
  });

  it('crea el permiso sin usar, con vigencia de 24 horas desde ahora', async () => {
    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado).toMatchObject({ exito: true });
    expect(permisos.creados).toEqual([
      {
        rutaId: 'ruta-7',
        otorgadoPorId: 'sup-1',
        motivo: 'Liquida mañana junto con hoy',
        fechaOtorgado: AHORA,
        fechaExpiracion: new Date('2026-09-24T17:00:00-06:00'),
      },
    ]);
    expect(VIGENCIA_PERMISO_MS).toBe(24 * 60 * 60 * 1000);
    if (resultado.exito) {
      expect(resultado.permiso.usado).toBe(false);
      expect(resultado.permiso.eventoCargaId).toBeNull();
    }
  });

  it('guarda el motivo sin espacios sobrantes', async () => {
    await useCase.ejecutar(
      { ...entrada, motivo: '   Camion ya salio   ' },
      AHORA,
    );

    expect(permisos.creados[0].motivo).toBe('Camion ya salio');
  });

  it.each(['', 'ok', 'si  ', '    abcd    '])(
    'rechaza un motivo de menos de 5 caracteres (%j)',
    async (motivo) => {
      const resultado = await useCase.ejecutar({ ...entrada, motivo }, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_INVALIDO' });
      expect(permisos.creados).toHaveLength(0);
    },
  );

  it('acepta un motivo de exactamente 5 caracteres', async () => {
    const resultado = await useCase.ejecutar(
      { ...entrada, motivo: 'abcde' },
      AHORA,
    );

    expect(resultado.exito).toBe(true);
  });

  it('rechaza una ruta que no existe', async () => {
    const resultado = await useCase.ejecutar(
      { ...entrada, rutaId: 'ruta-x' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'RUTA_NO_ENCONTRADA' });
    expect(permisos.creados).toHaveLength(0);
  });

  it('rechaza si la ruta ya tiene un permiso vigente sin usar, y devuelve su id', async () => {
    await useCase.ejecutar(entrada, AHORA);

    const segundo = await useCase.ejecutar(
      { ...entrada, usuarioAppId: 'sup-2' },
      new Date(AHORA.getTime() + 60 * 60 * 1000),
    );

    expect(segundo).toEqual({
      exito: false,
      motivo: 'YA_EXISTE_PERMISO_VIGENTE',
      permisoId: 'permiso-1',
    });
    expect(permisos.creados).toHaveLength(1);
  });

  it('permite otro permiso cuando el anterior ya se uso', async () => {
    await useCase.ejecutar(entrada, AHORA);
    permisos.permisos[0].usado = true;

    const segundo = await useCase.ejecutar(entrada, AHORA);

    expect(segundo.exito).toBe(true);
  });

  it('permite otro permiso cuando el anterior ya vencio', async () => {
    await useCase.ejecutar(entrada, AHORA);

    const segundo = await useCase.ejecutar(
      entrada,
      new Date(AHORA.getTime() + VIGENCIA_PERMISO_MS),
    );

    expect(segundo.exito).toBe(true);
  });

  it('un permiso vigente de otra ruta no impide otorgar', async () => {
    await useCase.ejecutar({ ...entrada, rutaId: 'ruta-9' }, AHORA);

    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado.exito).toBe(true);
  });
});
