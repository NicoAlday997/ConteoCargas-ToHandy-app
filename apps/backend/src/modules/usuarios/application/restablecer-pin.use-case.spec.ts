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
  RestablecerPinUseCase,
  type ResultadoRestablecerPin,
} from './restablecer-pin.use-case';

/**
 * Pruebas del caso de uso de restablecimiento de PIN (RF-09 / RF-10).
 * Sin base de datos ni argon2 reales: se usan dobles en memoria de los puertos.
 */

/**
 * Repositorio falso: guarda los usuarios en un Map y registra cada llamada a
 * `actualizar` y a `registrarRestablecimientoPin` para poder verificarlas.
 */
class FakeAdminUsuarioRepository implements AdminUsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAdmin>();
  readonly actualizaciones: Array<{
    id: string;
    datos: DatosActualizarUsuario;
  }> = [];
  readonly restablecimientos: RegistroRestablecimientoPin[] = [];

  sembrar(usuario: UsuarioAdmin): void {
    this.usuarios.set(usuario.id, usuario);
  }

  async listarTodos(): Promise<UsuarioAdmin[]> {
    return [...this.usuarios.values()];
  }

  crear(_datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  async actualizar(
    id: string,
    datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    this.actualizaciones.push({ id, datos });
    const actual = this.usuarios.get(id);
    if (actual === undefined) {
      throw new Error(`usuario inexistente: ${id}`);
    }
    const actualizado: UsuarioAdmin = {
      ...actual,
      ...(datos.debeCambiarPin !== undefined
        ? { debeCambiarPin: datos.debeCambiarPin }
        : {}),
      ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
    };
    this.usuarios.set(id, actualizado);
    return actualizado;
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | null> {
    return this.usuarios.get(id) ?? null;
  }

  async registrarRestablecimientoPin(
    datos: RegistroRestablecimientoPin,
  ): Promise<void> {
    this.restablecimientos.push(datos);
  }
}

/** Hasher falso: el "hash" de un valor plano `x` es la cadena `HASH:x`. */
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

function crearUsuario(overrides: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  return {
    id: 'u-1',
    nombreCompleto: 'Ana Vendedora',
    rolApp: RolApp.VENDEDOR,
    usuarioHandyId: 42,
    activo: true,
    debeCambiarPin: false,
    fechaUltimoCambioPin: new Date('2026-08-01T12:00:00-06:00'),
    creadoEn: new Date('2026-07-01T12:00:00-06:00'),
    actualizadoEn: new Date('2026-08-01T12:00:00-06:00'),
    ...overrides,
  };
}

/** Estrecha el resultado a la variante exitosa o falla la prueba. */
function exigirExito(
  resultado: ResultadoRestablecerPin,
): Extract<ResultadoRestablecerPin, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('RestablecerPinUseCase', () => {
  let repo: FakeAdminUsuarioRepository;
  let hasher: FakeHasher;
  let useCase: RestablecerPinUseCase;

  beforeEach(() => {
    repo = new FakeAdminUsuarioRepository();
    hasher = new FakeHasher();
    useCase = new RestablecerPinUseCase(repo, hasher);
  });

  it('1. devuelve USUARIO_NO_ENCONTRADO si el usuario no existe y no toca nada', async () => {
    const resultado = await useCase.ejecutar('desconocido', 'admin-1');

    expect(resultado).toEqual({
      exito: false,
      motivo: 'USUARIO_NO_ENCONTRADO',
    });
    expect(repo.actualizaciones).toHaveLength(0);
    expect(repo.restablecimientos).toHaveLength(0);
    expect(hasher.hashInvocaciones).toHaveLength(0);
  });

  it('2. en un restablecimiento exitoso devuelve un PIN temporal de 4 digitos', async () => {
    repo.sembrar(crearUsuario());

    const resultado = exigirExito(await useCase.ejecutar('u-1', 'admin-1'));

    expect(resultado.pinTemporal).toMatch(/^\d{4}$/);
  });

  it('3. persiste solo el hash del PIN nuevo y fuerza debeCambiarPin en true', async () => {
    repo.sembrar(crearUsuario({ debeCambiarPin: false }));

    const resultado = exigirExito(await useCase.ejecutar('u-1', 'admin-1'));

    expect(hasher.hashInvocaciones).toEqual([resultado.pinTemporal]);
    expect(repo.actualizaciones).toEqual([
      {
        id: 'u-1',
        datos: {
          pinHash: `HASH:${resultado.pinTemporal}`,
          debeCambiarPin: true,
        },
      },
    ]);
    expect(repo.usuarios.get('u-1')?.debeCambiarPin).toBe(true);
  });

  it('4. deja traza del restablecimiento con el usuario afectado y quien lo ejecuto (RF-10)', async () => {
    repo.sembrar(crearUsuario());

    await useCase.ejecutar('u-1', 'admin-99');

    expect(repo.restablecimientos).toEqual([
      { usuarioAppId: 'u-1', restablecidoPor: 'admin-99' },
    ]);
  });
});
