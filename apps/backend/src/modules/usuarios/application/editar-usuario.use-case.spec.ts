import { RolApp } from '@prisma/client';

import {
  SinSupervisorActivoError,
  type AdminUsuarioRepository,
  type DatosActualizarUsuario,
  type DatosCrearUsuario,
  type OcupanteCuentaHandy,
  type PaginaAccesos,
  type RegistroDesbloqueo,
  type RegistroRestablecimientoPin,
  type UsuarioAdmin,
} from './admin-usuario.repository';
import {
  EditarUsuarioUseCase,
  type ResultadoEditarUsuario,
} from './editar-usuario.use-case';

/**
 * Pruebas del caso de uso de edicion de usuarios (RF-05, RF-11), foco en las
 * politicas de proteccion del ultimo supervisor. Sin base de datos: doble en
 * memoria del puerto `AdminUsuarioRepository`.
 */

class FakeAdminUsuarioRepository implements AdminUsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAdmin>();
  readonly actualizaciones: Array<{
    id: string;
    datos: DatosActualizarUsuario;
  }> = [];
  /** Se fija a mano en cada prueba; cuenta las llamadas para verificar el cacheo. */
  totalSupervisoresActivos = 0;
  consultasDeConteo = 0;
  /** Simula que otra peticion simultanea dejo sin supervisores: la revision posterior al cambio lo rechaza. */
  quedariaSinSupervisores = false;

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
    if (this.quedariaSinSupervisores) throw new SinSupervisorActivoError();
    this.actualizaciones.push({ id, datos });
    const actual = this.usuarios.get(id);
    if (actual === undefined) {
      throw new Error(`usuario inexistente: ${id}`);
    }
    const actualizado: UsuarioAdmin = {
      ...actual,
      ...(datos.nombreCompleto !== undefined
        ? { nombreCompleto: datos.nombreCompleto }
        : {}),
      ...(datos.rolApp !== undefined ? { rolApp: datos.rolApp } : {}),
      ...(datos.usuarioHandyId !== undefined
        ? { usuarioHandyId: datos.usuarioHandyId }
        : {}),
      ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
    };
    this.usuarios.set(id, actualizado);
    return actualizado;
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | null> {
    return this.usuarios.get(id) ?? null;
  }

  async restablecerPin(
    _registro: RegistroRestablecimientoPin,
    _pinHash: string,
  ): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  desbloquear(_registro: RegistroDesbloqueo): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  listarAccesos(): Promise<PaginaAccesos> {
    throw new Error('no usado en estas pruebas');
  }

  async contarSupervisoresActivos(): Promise<number> {
    this.consultasDeConteo += 1;
    return this.totalSupervisoresActivos;
  }

  async buscarActivoConCuentaHandy(
    usuarioHandyId: number,
    excluirId?: string,
  ): Promise<OcupanteCuentaHandy | null> {
    const ocupante = [...this.usuarios.values()].find(
      (u) =>
        u.activo && u.usuarioHandyId === usuarioHandyId && u.id !== excluirId,
    );
    return ocupante
      ? { id: ocupante.id, nombreCompleto: ocupante.nombreCompleto }
      : null;
  }

  async nombreCuentaHandy(usuarioHandyId: number): Promise<string | null> {
    return usuarioHandyId === 42 ? 'Ruta 3' : null;
  }
}

function crearUsuario(overrides: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  return {
    id: 'u-1',
    nombreCompleto: 'Ana Supervisora',
    rolApp: RolApp.SUPERVISOR,
    usuarioHandyId: null,
    activo: true,
    debeCambiarPin: false,
    fechaUltimoCambioPin: new Date('2026-08-01T12:00:00-06:00'),
    bloqueadoHasta: null,
    creadoEn: new Date('2026-07-01T12:00:00-06:00'),
    actualizadoEn: new Date('2026-08-01T12:00:00-06:00'),
    ...overrides,
  };
}

function exigirExito(
  resultado: ResultadoEditarUsuario,
): Extract<ResultadoEditarUsuario, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

function exigirFallo(
  resultado: ResultadoEditarUsuario,
): Extract<ResultadoEditarUsuario, { exito: false }> {
  if (resultado.exito) {
    throw new Error('se esperaba un fallo pero el caso de uso tuvo exito');
  }
  return resultado;
}

describe('EditarUsuarioUseCase', () => {
  let repo: FakeAdminUsuarioRepository;
  let useCase: EditarUsuarioUseCase;

  beforeEach(() => {
    repo = new FakeAdminUsuarioRepository();
    useCase = new EditarUsuarioUseCase(repo);
  });

  it('devuelve USUARIO_NO_ENCONTRADO si el usuario no existe y no toca nada', async () => {
    const resultado = await useCase.ejecutar('desconocido', 'admin-1', {
      nombreCompleto: 'Nuevo nombre',
    });

    expect(resultado).toEqual({
      exito: false,
      motivo: 'USUARIO_NO_ENCONTRADO',
    });
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('rechaza AUTODESACTIVACION_PROHIBIDA si el actor se desactiva a si mismo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1', rolApp: RolApp.CONTADOR }));
    repo.totalSupervisoresActivos = 3;

    const resultado = exigirFallo(
      await useCase.ejecutar('sup-1', 'sup-1', { activo: false }),
    );

    expect(resultado.motivo).toBe('AUTODESACTIVACION_PROHIBIDA');
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('rechaza AUTOCAMBIO_ROL_PROHIBIDO si el actor se cambia el rol a si mismo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 3;

    const resultado = exigirFallo(
      await useCase.ejecutar('sup-1', 'sup-1', { rolApp: RolApp.CONTADOR }),
    );

    expect(resultado.motivo).toBe('AUTOCAMBIO_ROL_PROHIBIDO');
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('rechaza ULTIMO_SUPERVISOR al desactivar al unico supervisor activo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 1;

    const resultado = exigirFallo(
      await useCase.ejecutar('sup-1', 'admin-2', { activo: false }),
    );

    expect(resultado.motivo).toBe('ULTIMO_SUPERVISOR');
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('permite desactivar a un supervisor cuando hay dos activos', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 2;

    const resultado = exigirExito(
      await useCase.ejecutar('sup-1', 'admin-2', { activo: false }),
    );

    expect(resultado.usuario.activo).toBe(false);
    expect(repo.actualizaciones).toEqual([
      { id: 'sup-1', datos: { activo: false } },
    ]);
  });

  it('permite desactivar a un vendedor sin consultar el conteo de supervisores', async () => {
    repo.sembrar(
      crearUsuario({ id: 'ven-1', rolApp: RolApp.VENDEDOR, usuarioHandyId: 7 }),
    );

    const resultado = exigirExito(
      await useCase.ejecutar('ven-1', 'admin-2', { activo: false }),
    );

    expect(resultado.usuario.activo).toBe(false);
    // No hay ninguna politica que dependa del conteo para un vendedor, asi que
    // ni siquiera se consulta.
    expect(repo.consultasDeConteo).toBe(0);
  });

  it('rechaza ULTIMO_SUPERVISOR al cambiar de rol al unico supervisor activo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 1;

    const resultado = exigirFallo(
      await useCase.ejecutar('sup-1', 'admin-2', { rolApp: RolApp.VENDEDOR }),
    );

    expect(resultado.motivo).toBe('ULTIMO_SUPERVISOR');
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('permite cambiar el rol de un supervisor cuando hay otro supervisor activo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 2;

    const resultado = exigirExito(
      await useCase.ejecutar('sup-1', 'admin-2', { rolApp: RolApp.CONTADOR }),
    );

    expect(resultado.usuario.rolApp).toBe(RolApp.CONTADOR);
  });

  it('consulta el conteo de supervisores una sola vez aunque ambas politicas apliquen', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 2;

    await useCase.ejecutar('sup-1', 'admin-2', {
      activo: false,
      rolApp: RolApp.CONTADOR,
    });

    expect(repo.consultasDeConteo).toBe(1);
  });

  it('un PATCH que no toca activo ni rolApp no aplica ninguna politica ni consulta el conteo', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1' }));

    const resultado = exigirExito(
      await useCase.ejecutar('sup-1', 'sup-1', {
        nombreCompleto: 'Nombre nuevo',
      }),
    );

    expect(resultado.usuario.nombreCompleto).toBe('Nombre nuevo');
    expect(repo.consultasDeConteo).toBe(0);
  });

  it('reactivar (activo: true) no dispara la politica de desactivacion', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1', activo: false }));

    const resultado = exigirExito(
      await useCase.ejecutar('sup-1', 'admin-2', { activo: true }),
    );

    expect(resultado.usuario.activo).toBe(true);
    expect(repo.consultasDeConteo).toBe(0);
  });

  it('cambiar rolApp al mismo valor actual no dispara la politica de cambio de rol', async () => {
    repo.sembrar(crearUsuario({ id: 'sup-1', rolApp: RolApp.CONTADOR }));

    const resultado = exigirExito(
      await useCase.ejecutar('sup-1', 'sup-1', { rolApp: RolApp.CONTADOR }),
    );

    expect(resultado.usuario.rolApp).toBe(RolApp.CONTADOR);
    expect(repo.consultasDeConteo).toBe(0);
  });

  it('si la revision posterior al cambio no deja supervisores (carrera), rechaza ULTIMO_SUPERVISOR', async () => {
    // Dos supervisores se desactivan el uno al otro a la vez: los dos ven
    // "hay 2" en la validacion previa; el adaptador lo detecta al escribir.
    repo.sembrar(crearUsuario({ id: 'sup-1' }));
    repo.totalSupervisoresActivos = 2;
    repo.quedariaSinSupervisores = true;

    const resultado = exigirFallo(
      await useCase.ejecutar('sup-1', 'sup-2', { activo: false }),
    );

    expect(resultado.motivo).toBe('ULTIMO_SUPERVISOR');
    expect(repo.actualizaciones).toHaveLength(0);
  });

  describe('una cuenta de Handy, un solo usuario activo', () => {
    const vendedor = (overrides: Partial<UsuarioAdmin>) =>
      crearUsuario({ rolApp: RolApp.VENDEDOR, ...overrides });

    it('rechaza REACTIVAR a alguien cuya cuenta ya paso a otro usuario activo', async () => {
      repo.sembrar(
        vendedor({
          id: 'viejo',
          nombreCompleto: 'Juan Viejo',
          usuarioHandyId: 42,
          activo: false,
        }),
      );
      repo.sembrar(
        vendedor({
          id: 'nuevo',
          nombreCompleto: 'Pedro Nuevo',
          usuarioHandyId: 42,
        }),
      );

      const resultado = await useCase.ejecutar('viejo', 'admin-1', {
        activo: true,
      });

      expect(resultado).toEqual({
        exito: false,
        motivo: 'CUENTA_HANDY_YA_ASIGNADA',
        cuentaHandy: { id: 42, nombre: 'Ruta 3' },
        asignadaA: { id: 'nuevo', nombreCompleto: 'Pedro Nuevo' },
      });
      expect(repo.actualizaciones).toHaveLength(0);
    });

    it('rechaza vincular una cuenta que ya tiene otro usuario activo', async () => {
      repo.sembrar(vendedor({ id: 'a', usuarioHandyId: 7 }));
      repo.sembrar(
        vendedor({
          id: 'b',
          nombreCompleto: 'Pedro Nuevo',
          usuarioHandyId: 42,
        }),
      );

      const resultado = exigirFallo(
        await useCase.ejecutar('a', 'admin-1', { usuarioHandyId: 42 }),
      );

      expect(resultado.motivo).toBe('CUENTA_HANDY_YA_ASIGNADA');
      expect(repo.actualizaciones).toHaveLength(0);
    });

    it('reactivar se permite si quien tiene la cuenta esta inactivo', async () => {
      repo.sembrar(
        vendedor({ id: 'viejo', usuarioHandyId: 42, activo: false }),
      );
      repo.sembrar(vendedor({ id: 'otro', usuarioHandyId: 42, activo: false }));

      const resultado = exigirExito(
        await useCase.ejecutar('viejo', 'admin-1', { activo: true }),
      );

      expect(resultado.usuario.activo).toBe(true);
    });

    it('dos usuarios INACTIVOS con la misma cuenta se permiten', async () => {
      repo.sembrar(vendedor({ id: 'a', usuarioHandyId: 7, activo: false }));
      repo.sembrar(vendedor({ id: 'b', usuarioHandyId: 42, activo: false }));

      const resultado = exigirExito(
        await useCase.ejecutar('a', 'admin-1', { usuarioHandyId: 42 }),
      );

      expect(resultado.usuario.usuarioHandyId).toBe(42);
    });

    it('reactivar y cambiar de cuenta en el mismo PATCH revisa la cuenta NUEVA', async () => {
      repo.sembrar(
        vendedor({ id: 'viejo', usuarioHandyId: 42, activo: false }),
      );
      repo.sembrar(vendedor({ id: 'nuevo', usuarioHandyId: 42 }));

      const resultado = exigirExito(
        await useCase.ejecutar('viejo', 'admin-1', {
          activo: true,
          usuarioHandyId: 9,
        }),
      );

      expect(resultado.usuario).toMatchObject({
        activo: true,
        usuarioHandyId: 9,
      });
    });

    it('el usuario no choca consigo mismo al re-guardar su propia cuenta', async () => {
      repo.sembrar(vendedor({ id: 'a', usuarioHandyId: 42 }));

      expect(
        (await useCase.ejecutar('a', 'admin-1', { usuarioHandyId: 42 })).exito,
      ).toBe(true);
    });

    it('un usuario sin cuenta no choca con nada', async () => {
      repo.sembrar(vendedor({ id: 'v', usuarioHandyId: 42 }));
      repo.sembrar(
        crearUsuario({ id: 'c', rolApp: RolApp.CONTADOR, activo: false }),
      );

      const resultado = exigirExito(
        await useCase.ejecutar('c', 'admin-1', { activo: true }),
      );

      expect(resultado.usuario).toMatchObject({
        activo: true,
        usuarioHandyId: null,
      });
    });
  });
});
