import { RolApp } from '@prisma/client';

import { HasherPort } from '../../auth/application/hasher.port';
import type {
  AdminUsuarioRepository,
  DatosActualizarUsuario,
  DatosCrearUsuario,
  RegistroRestablecimientoPin,
  UsuarioAdmin,
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
  private secuencia = 0;

  async listarTodos(): Promise<UsuarioAdmin[]> {
    return this.creados.map((c) => c.usuario);
  }

  async crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
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
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    this.creados.push({ datos, usuario });
    return usuario;
  }

  actualizar(_id: string, _datos: DatosActualizarUsuario): Promise<UsuarioAdmin> {
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
});
