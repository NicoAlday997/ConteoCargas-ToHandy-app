import { RolApp } from '@prisma/client';

import type {
  AdminUsuarioRepository,
  DatosActualizarUsuario,
  DatosCrearUsuario,
  MovimientoAcceso,
  PaginaAccesos,
  RegistroDesbloqueo,
  RegistroRestablecimientoPin,
  UsuarioAdmin,
} from './admin-usuario.repository';
import {
  ConsultarAccesosUseCase,
  vistaMovimientoAcceso,
} from './consultar-accesos.use-case';

/**
 * Pruebas de la consulta del historial de acceso (RF-10). Sin base de datos:
 * doble en memoria del puerto `AdminUsuarioRepository` que registra con que
 * pagina se le pregunto.
 */
class FakeAdminUsuarioRepository implements AdminUsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAdmin>();
  readonly consultas: Array<{ id: string; page: number; pageSize: number }> =
    [];

  sembrar(usuario: UsuarioAdmin): void {
    this.usuarios.set(usuario.id, usuario);
  }

  listarTodos(): Promise<UsuarioAdmin[]> {
    throw new Error('no usado en estas pruebas');
  }

  crear(_datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  actualizar(
    _id: string,
    _datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
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

  desbloquear(_registro: RegistroDesbloqueo): Promise<UsuarioAdmin> {
    throw new Error('no usado en estas pruebas');
  }

  async listarAccesos(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<PaginaAccesos> {
    this.consultas.push({ id, page, pageSize });
    return { items: [], total: 0, page, pageSize };
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

function crearUsuario(): UsuarioAdmin {
  return {
    id: 'u-1',
    nombreCompleto: 'Ana Vendedora',
    rolApp: RolApp.VENDEDOR,
    usuarioHandyId: 42,
    activo: true,
    debeCambiarPin: false,
    fechaUltimoCambioPin: null,
    bloqueadoHasta: null,
    creadoEn: new Date('2026-07-01T12:00:00-06:00'),
    actualizadoEn: new Date('2026-08-01T12:00:00-06:00'),
  };
}

describe('ConsultarAccesosUseCase', () => {
  let repo: FakeAdminUsuarioRepository;
  let useCase: ConsultarAccesosUseCase;

  beforeEach(() => {
    repo = new FakeAdminUsuarioRepository();
    useCase = new ConsultarAccesosUseCase(repo);
  });

  it('rechaza un id que no existe sin consultar el historial', async () => {
    const resultado = await useCase.ejecutar('no-existe', {});

    expect(resultado).toEqual({
      exito: false,
      motivo: 'USUARIO_NO_ENCONTRADO',
    });
    expect(repo.consultas).toHaveLength(0);
  });

  it('aplica page=1 y pageSize=20 por defecto', async () => {
    repo.sembrar(crearUsuario());

    await useCase.ejecutar('u-1', {});

    expect(repo.consultas).toEqual([{ id: 'u-1', page: 1, pageSize: 20 }]);
  });

  it('respeta page y pageSize validos', async () => {
    repo.sembrar(crearUsuario());

    await useCase.ejecutar('u-1', { page: 3, pageSize: 5 });

    expect(repo.consultas).toEqual([{ id: 'u-1', page: 3, pageSize: 5 }]);
  });

  it('acota pageSize a 100 e ignora valores invalidos', async () => {
    repo.sembrar(crearUsuario());

    await useCase.ejecutar('u-1', { pageSize: 5000 });
    await useCase.ejecutar('u-1', { page: 0, pageSize: -1 });

    expect(repo.consultas).toEqual([
      { id: 'u-1', page: 1, pageSize: 100 },
      { id: 'u-1', page: 1, pageSize: 20 },
    ]);
  });
});

describe('vistaMovimientoAcceso', () => {
  const FECHA = new Date('2026-09-30T14:00:00.000Z');
  const AUTOR = { id: 'sup-1', nombreCompleto: 'Cristian Alday' };

  it('restablecimiento por supervisor: trae al autor, sin motivo', () => {
    const m: MovimientoAcceso = {
      id: 'r-1',
      tipo: 'PIN_RESTABLECIDO',
      fecha: FECHA,
      origen: 'SUPERVISOR',
      autor: AUTOR,
    };

    expect(vistaMovimientoAcceso(m)).toEqual({
      id: 'r-1',
      tipo: 'PIN_RESTABLECIDO',
      fecha: '2026-09-30T14:00:00.000Z',
      origen: 'SUPERVISOR',
      autor: AUTOR,
      motivo: null,
      bloqueadoHasta: null,
    });
  });

  it('restablecimiento por linea de comandos: sin autor, con motivo', () => {
    const m: MovimientoAcceso = {
      id: 'r-2',
      tipo: 'PIN_RESTABLECIDO',
      fecha: FECHA,
      origen: 'LINEA_COMANDOS',
      motivo: 'Unico supervisor olvido su PIN',
    };

    expect(vistaMovimientoAcceso(m)).toMatchObject({
      origen: 'LINEA_COMANDOS',
      autor: null,
      motivo: 'Unico supervisor olvido su PIN',
      bloqueadoHasta: null,
    });
  });

  it('desbloqueo: trae al autor y hasta cuando iba el bloqueo', () => {
    const m: MovimientoAcceso = {
      id: 'd-1',
      tipo: 'BLOQUEO_QUITADO',
      fecha: FECHA,
      autor: AUTOR,
      bloqueadoHasta: new Date('2026-09-30T14:12:00.000Z'),
    };

    expect(vistaMovimientoAcceso(m)).toEqual({
      id: 'd-1',
      tipo: 'BLOQUEO_QUITADO',
      fecha: '2026-09-30T14:00:00.000Z',
      origen: 'SUPERVISOR',
      autor: AUTOR,
      motivo: null,
      bloqueadoHasta: '2026-09-30T14:12:00.000Z',
    });
  });
});
