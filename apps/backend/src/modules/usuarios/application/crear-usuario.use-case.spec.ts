import { RolApp } from '@prisma/client';

import { HasherPort } from '../../auth/application/hasher.port';
import {
  CuentaHandyYaAsignadaError,
  type AdminUsuarioRepository,
  type DatosActualizarUsuario,
  type DatosCrearUsuario,
  type OcupanteCuentaHandy,
  type RegistroDesbloqueo,
  type RegistroRestablecimientoPin,
  type UsuarioAdmin,
} from './admin-usuario.repository';
import {
  CrearUsuarioUseCase,
  type ResultadoCrearUsuario,
} from './crear-usuario.use-case';

/**
 * Pruebas del caso de uso de alta de usuario (RF-07).
 * Sin base de datos ni argon2 reales: se usan dobles en memoria de los puertos.
 */

/**
 * Repositorio falso: guarda cada llamada a `crear` (con sus datos crudos, para
 * poder inspeccionar el `pinHash`) y devuelve un `UsuarioAdmin` coherente.
 */
class FakeAdminUsuarioRepository implements AdminUsuarioRepository {
  readonly creados: Array<{ datos: DatosCrearUsuario; usuario: UsuarioAdmin }> =
    [];
  /** Usuarios que ya existian antes del alta (para la cuenta de Handy). */
  readonly previos: UsuarioAdmin[] = [];
  /** Nombres del cache de Handy, por id. */
  readonly cuentasHandy = new Map<number, string>();
  /** Simula que otra peticion gano la carrera: `crear` choca con el indice. */
  chocaConIndice = false;
  private secuencia = 0;

  async listarTodos(): Promise<UsuarioAdmin[]> {
    return this.creados.map((c) => c.usuario);
  }

  async crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    if (this.chocaConIndice) {
      this.previos.push(
        usuarioPrevio({ id: 'carrera', nombreCompleto: 'Gana Carrera' }),
      );
      throw new CuentaHandyYaAsignadaError(datos.usuarioHandyId);
    }
    this.secuencia += 1;
    const ahora = new Date('2026-09-03T10:00:00-06:00');
    const usuario: UsuarioAdmin = {
      id: `u-${this.secuencia}`,
      nombreCompleto: datos.nombreCompleto,
      rolApp: datos.rolApp,
      usuarioHandyId: datos.usuarioHandyId,
      // Invariantes de alta que el adaptador real fija en la BD.
      activo: true,
      debeCambiarPin: true,
      fechaUltimoCambioPin: null,
      bloqueadoHasta: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    this.creados.push({ datos, usuario });
    return usuario;
  }

  actualizar(
    _id: string,
    _datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  buscarPorId(_id: string): Promise<UsuarioAdmin | null> {
    throw new Error('no usado en estas pruebas');
  }

  registrarRestablecimientoPin(
    _datos: RegistroRestablecimientoPin,
  ): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  registrarDesbloqueo(_datos: RegistroDesbloqueo): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  contarSupervisoresActivos(): Promise<number> {
    throw new Error('no usado en estas pruebas');
  }

  async buscarActivoConCuentaHandy(
    usuarioHandyId: number,
    excluirId?: string,
  ): Promise<OcupanteCuentaHandy | null> {
    const todos = [...this.previos, ...this.creados.map((c) => c.usuario)];
    const ocupante = todos.find(
      (u) =>
        u.activo && u.usuarioHandyId === usuarioHandyId && u.id !== excluirId,
    );
    return ocupante
      ? { id: ocupante.id, nombreCompleto: ocupante.nombreCompleto }
      : null;
  }

  async nombreCuentaHandy(usuarioHandyId: number): Promise<string | null> {
    return this.cuentasHandy.get(usuarioHandyId) ?? null;
  }
}

/** Un usuario que ya estaba dado de alta: por omision, vendedor activo de la cuenta 42. */
function usuarioPrevio(overrides: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  const fecha = new Date('2026-08-01T10:00:00-06:00');
  return {
    id: 'previo-1',
    nombreCompleto: 'Carlos Ruiz',
    rolApp: RolApp.VENDEDOR,
    usuarioHandyId: 42,
    activo: true,
    debeCambiarPin: false,
    fechaUltimoCambioPin: null,
    bloqueadoHasta: null,
    creadoEn: fecha,
    actualizadoEn: fecha,
    ...overrides,
  };
}

/**
 * Hasher falso: el "hash" de un valor plano `x` es la cadena `HASH:x`.
 */
class FakeHasher implements HasherPort {
  hashInvocaciones: string[] = [];

  async hash(valorPlano: string): Promise<string> {
    this.hashInvocaciones.push(valorPlano);
    return `HASH:${valorPlano}`;
  }

  async verificar(hash: string, valorPlano: string): Promise<boolean> {
    return hash === `HASH:${valorPlano}`;
  }
}

/** Estrecha el resultado a la variante exitosa o falla la prueba. */
function exigirExito(
  resultado: ResultadoCrearUsuario,
): Extract<ResultadoCrearUsuario, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('CrearUsuarioUseCase', () => {
  let repo: FakeAdminUsuarioRepository;
  let hasher: FakeHasher;
  let useCase: CrearUsuarioUseCase;

  beforeEach(() => {
    repo = new FakeAdminUsuarioRepository();
    hasher = new FakeHasher();
    useCase = new CrearUsuarioUseCase(repo, hasher);
  });

  it('1. rechaza un VENDEDOR sin usuarioHandyId y no crea nada', async () => {
    const resultado = await useCase.ejecutar({
      nombreCompleto: 'Ana Vendedora',
      rolApp: RolApp.VENDEDOR,
      usuarioHandyId: null,
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'VENDEDOR_REQUIERE_HANDY',
    });
    expect(repo.creados).toHaveLength(0);
    expect(hasher.hashInvocaciones).toHaveLength(0);
  });

  it('2. rechaza un rol distinto de VENDEDOR que trae usuarioHandyId', async () => {
    const resultado = await useCase.ejecutar({
      nombreCompleto: 'Beto Contador',
      rolApp: RolApp.CONTADOR,
      usuarioHandyId: 42,
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'NO_VENDEDOR_CON_HANDY',
    });
    expect(repo.creados).toHaveLength(0);
  });

  it('3. crea un VENDEDOR con su usuarioHandyId y devuelve un PIN temporal de 4 digitos', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar({
        nombreCompleto: 'Ana Vendedora',
        rolApp: RolApp.VENDEDOR,
        usuarioHandyId: 42,
      }),
    );

    expect(resultado.pinTemporal).toMatch(/^\d{4}$/);
    expect(resultado.usuario.rolApp).toBe(RolApp.VENDEDOR);
    expect(resultado.usuario.usuarioHandyId).toBe(42);
    // Alta: nace activo y obligado a cambiar el PIN en el primer login (RF-08).
    expect(resultado.usuario.activo).toBe(true);
    expect(resultado.usuario.debeCambiarPin).toBe(true);
  });

  it('4. crea un CONTADOR sin vinculo de Handy (usuarioHandyId null)', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar({
        nombreCompleto: 'Beto Contador',
        rolApp: RolApp.CONTADOR,
        usuarioHandyId: null,
      }),
    );

    expect(resultado.usuario.usuarioHandyId).toBeNull();
    expect(repo.creados[0].datos.usuarioHandyId).toBeNull();
  });

  it('5. persiste solo el hash del PIN temporal, nunca el PIN en claro', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar({
        nombreCompleto: 'Ana Vendedora',
        rolApp: RolApp.VENDEDOR,
        usuarioHandyId: 7,
      }),
    );

    expect(hasher.hashInvocaciones).toEqual([resultado.pinTemporal]);
    expect(repo.creados[0].datos.pinHash).toBe(`HASH:${resultado.pinTemporal}`);
  });

  describe('una cuenta de Handy, un solo usuario activo', () => {
    it('6. rechaza el alta con una cuenta que ya tiene otro usuario activo, diciendo quien', async () => {
      repo.previos.push(usuarioPrevio());
      repo.cuentasHandy.set(42, 'Ruta 3 - Carlos Ruiz');

      const resultado = await useCase.ejecutar({
        nombreCompleto: 'Ana Vendedora',
        rolApp: RolApp.VENDEDOR,
        usuarioHandyId: 42,
      });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'CUENTA_HANDY_YA_ASIGNADA',
        cuentaHandy: { id: 42, nombre: 'Ruta 3 - Carlos Ruiz' },
        asignadaA: { id: 'previo-1', nombreCompleto: 'Carlos Ruiz' },
      });
      expect(repo.creados).toHaveLength(0);
      expect(hasher.hashInvocaciones).toHaveLength(0);
    });

    it('7. si quien la tenia esta INACTIVO, la cuenta esta libre', async () => {
      repo.previos.push(usuarioPrevio({ activo: false }));

      const resultado = await useCase.ejecutar({
        nombreCompleto: 'Ana Vendedora',
        rolApp: RolApp.VENDEDOR,
        usuarioHandyId: 42,
      });

      expect(resultado.exito).toBe(true);
    });

    it('8. un usuario sin cuenta no choca con nada', async () => {
      repo.previos.push(
        usuarioPrevio(),
        usuarioPrevio({
          id: 'previo-2',
          rolApp: RolApp.CONTADOR,
          usuarioHandyId: null,
        }),
      );

      const resultado = await useCase.ejecutar({
        nombreCompleto: 'Beto Contador',
        rolApp: RolApp.CONTADOR,
        usuarioHandyId: null,
      });

      expect(resultado.exito).toBe(true);
    });

    it('9. si otra peticion gana la carrera, el indice de la BD da el mismo rechazo', async () => {
      repo.chocaConIndice = true;

      const resultado = await useCase.ejecutar({
        nombreCompleto: 'Ana Vendedora',
        rolApp: RolApp.VENDEDOR,
        usuarioHandyId: 42,
      });

      expect(resultado).toMatchObject({
        exito: false,
        motivo: 'CUENTA_HANDY_YA_ASIGNADA',
        cuentaHandy: { id: 42, nombre: null },
        asignadaA: { id: 'carrera', nombreCompleto: 'Gana Carrera' },
      });
    });
  });
});
