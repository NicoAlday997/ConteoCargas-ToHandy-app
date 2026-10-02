import { RolApp } from '@prisma/client';

import type {
  AdminUsuarioRepository,
  DatosActualizarUsuario,
  DatosCrearUsuario,
  PaginaAccesos,
  RegistroDesbloqueo,
  RegistroRestablecimientoPin,
  UsuarioAdmin,
} from './admin-usuario.repository';
import { DesbloquearUsuarioUseCase } from './desbloquear-usuario.use-case';

/**
 * Pruebas del desbloqueo manual por un supervisor (RF-03). Sin base de datos:
 * doble en memoria del puerto `AdminUsuarioRepository`.
 */

const AHORA = new Date('2026-10-01T06:00:00-06:00');
const EN_12_MIN = new Date('2026-10-01T06:12:00-06:00');

class FakeAdminUsuarioRepository implements AdminUsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAdmin>();
  readonly desbloqueos: RegistroDesbloqueo[] = [];

  sembrar(usuario: UsuarioAdmin): void {
    this.usuarios.set(usuario.id, usuario);
  }

  async listarTodos(): Promise<UsuarioAdmin[]> {
    return [...this.usuarios.values()];
  }

  crear(_datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  // El caso de uso no debe actualizar por separado: desbloqueo y traza van
  // en una sola llamada (una transaccion en el repositorio real).
  actualizar(
    _id: string,
    _datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    throw new Error('el desbloqueo debe ir por desbloquear()');
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | null> {
    return this.usuarios.get(id) ?? null;
  }

  restablecerPin(
    _registro: RegistroRestablecimientoPin,
    _pinHash: string,
  ): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  async desbloquear(registro: RegistroDesbloqueo): Promise<UsuarioAdmin> {
    this.desbloqueos.push(registro);
    const actual = this.usuarios.get(registro.usuarioAppId);
    if (actual === undefined) {
      throw new Error(`usuario inexistente: ${registro.usuarioAppId}`);
    }
    const actualizado: UsuarioAdmin = { ...actual, bloqueadoHasta: null };
    this.usuarios.set(actual.id, actualizado);
    return actualizado;
  }

  listarAccesos(): Promise<PaginaAccesos> {
    throw new Error('no usado en estas pruebas');
  }

  contarSupervisoresActivos(): Promise<number> {
    throw new Error('no usado en estas pruebas');
  }

  buscarActivoConCuentaHandy(): Promise<null> {
    throw new Error('no usado en estas pruebas');
  }

  nombreCuentaHandy(): Promise<string | null> {
    throw new Error('no usado en estas pruebas');
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
    bloqueadoHasta: EN_12_MIN,
    creadoEn: new Date('2026-07-01T12:00:00-06:00'),
    actualizadoEn: new Date('2026-08-01T12:00:00-06:00'),
    ...overrides,
  };
}

describe('DesbloquearUsuarioUseCase', () => {
  let repo: FakeAdminUsuarioRepository;
  let useCase: DesbloquearUsuarioUseCase;

  beforeEach(() => {
    repo = new FakeAdminUsuarioRepository();
    useCase = new DesbloquearUsuarioUseCase(repo);
  });

  it('quita el bloqueo y devuelve al usuario ya desbloqueado', async () => {
    repo.sembrar(crearUsuario());

    const resultado = await useCase.ejecutar('u-1', 'sup-1', AHORA);

    expect(resultado.exito).toBe(true);
    if (resultado.exito) expect(resultado.usuario.bloqueadoHasta).toBeNull();
    expect(repo.usuarios.get('u-1')?.bloqueadoHasta).toBeNull();
  });

  it('desbloqueo y traza en una sola llamada al repositorio (atomica): quien, a quien y cuanto le faltaba', async () => {
    repo.sembrar(crearUsuario());

    await useCase.ejecutar('u-1', 'sup-1', AHORA);

    expect(repo.desbloqueos).toEqual([
      {
        usuarioAppId: 'u-1',
        desbloqueadoPor: 'sup-1',
        bloqueadoHasta: EN_12_MIN,
      },
    ]);
  });

  it('USUARIO_NO_ENCONTRADO si el id no existe, sin escribir nada', async () => {
    const resultado = await useCase.ejecutar('nadie', 'sup-1', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'USUARIO_NO_ENCONTRADO',
    });
    expect(repo.desbloqueos).toHaveLength(0);
  });

  it('AUTODESBLOQUEO_PROHIBIDO si quien llama es el mismo usuario, aunque este bloqueado', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1', rolApp: RolApp.SUPERVISOR }));

    const resultado = await useCase.ejecutar('sup-1', 'sup-1', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'AUTODESBLOQUEO_PROHIBIDO',
    });
    expect(repo.desbloqueos).toHaveLength(0);
  });

  it('NO_BLOQUEADO si nunca se bloqueo, sin escribir nada', async () => {
    repo.sembrar(crearUsuario({ bloqueadoHasta: null }));

    const resultado = await useCase.ejecutar('u-1', 'sup-1', AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'NO_BLOQUEADO' });
    expect(repo.desbloqueos).toHaveLength(0);
  });

  it('NO_BLOQUEADO si el bloqueo ya vencio mientras tanto', async () => {
    repo.sembrar(
      crearUsuario({ bloqueadoHasta: new Date('2026-10-01T05:59:00-06:00') }),
    );

    const resultado = await useCase.ejecutar('u-1', 'sup-1', AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'NO_BLOQUEADO' });
    expect(repo.desbloqueos).toHaveLength(0);
  });
});
