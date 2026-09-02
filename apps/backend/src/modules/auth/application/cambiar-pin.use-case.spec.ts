import { RolApp } from '@prisma/client';

import {
  CambiarPinUseCase,
  type ResultadoCambioPin,
} from './cambiar-pin.use-case';
import { HasherPort } from './hasher.port';
import type {
  UsuarioAutenticable,
  UsuarioParaSeleccion,
  UsuarioRepository,
} from './usuario.repository';

/**
 * Pruebas del caso de uso de cambio de PIN (RF-08).
 * Sin base de datos ni argon2 reales: se usan dobles en memoria de los puertos.
 */

/**
 * Repositorio falso: guarda los usuarios en un Map y registra cada llamada
 * a `actualizarPin` y a `buscarPorId` para poder verificarlas.
 */
class FakeUsuarioRepository implements UsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAutenticable>();
  readonly cambiosPin: Array<{ id: string; pinHash: string }> = [];
  buscarPorIdInvocaciones = 0;

  sembrar(usuario: UsuarioAutenticable): void {
    this.usuarios.set(usuario.id, usuario);
  }

  listarActivosParaSeleccion(): Promise<UsuarioParaSeleccion[]> {
    throw new Error('no usado en estas pruebas');
  }

  async buscarPorId(id: string): Promise<UsuarioAutenticable | null> {
    this.buscarPorIdInvocaciones += 1;
    return this.usuarios.get(id) ?? null;
  }

  actualizarEstadoAcceso(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }

  async actualizarPin(id: string, pinHash: string): Promise<void> {
    this.cambiosPin.push({ id, pinHash });
  }
}

/**
 * Hasher falso: el "hash" de un valor plano `x` es la cadena `HASH:x`,
 * de modo que `verificar('HASH:1234', '1234')` es verdadero.
 */
class FakeHasher implements HasherPort {
  verificarInvocaciones = 0;

  async hash(valorPlano: string): Promise<string> {
    return `HASH:${valorPlano}`;
  }

  async verificar(hash: string, valorPlano: string): Promise<boolean> {
    this.verificarInvocaciones += 1;
    return hash === `HASH:${valorPlano}`;
  }
}

function crearUsuario(
  overrides: Partial<UsuarioAutenticable> = {},
): UsuarioAutenticable {
  return {
    id: 'u-1',
    nombreCompleto: 'Ana Vendedora',
    rolApp: RolApp.VENDEDOR,
    usuarioHandyId: 42,
    pinHash: 'HASH:1234',
    debeCambiarPin: true,
    activo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...overrides,
  };
}

/** Estrecha el resultado a la variante fallida o falla la prueba. */
function exigirFallo(
  resultado: ResultadoCambioPin,
): Extract<ResultadoCambioPin, { exito: false }> {
  if (resultado.exito) {
    throw new Error('se esperaba un fallo pero el resultado fue exitoso');
  }
  return resultado;
}

describe('CambiarPinUseCase', () => {
  let repo: FakeUsuarioRepository;
  let hasher: FakeHasher;
  let useCase: CambiarPinUseCase;

  beforeEach(() => {
    repo = new FakeUsuarioRepository();
    hasher = new FakeHasher();
    useCase = new CambiarPinUseCase(repo, hasher);
  });

  it('1. rechaza un PIN nuevo mal formado sin consultar el repositorio', async () => {
    repo.sembrar(crearUsuario());

    const resultado = await useCase.ejecutar('u-1', '1234', '12ab');

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PIN_NUEVO_MAL_FORMADO',
    });
    expect(repo.buscarPorIdInvocaciones).toBe(0);
    expect(repo.cambiosPin).toHaveLength(0);
  });

  it('2. rechaza un PIN nuevo igual al actual', async () => {
    repo.sembrar(crearUsuario());

    const resultado = await useCase.ejecutar('u-1', '1234', '1234');

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PIN_NUEVO_IGUAL_AL_ACTUAL',
    });
    expect(repo.buscarPorIdInvocaciones).toBe(0);
    expect(repo.cambiosPin).toHaveLength(0);
  });

  it('3. devuelve USUARIO_NO_ENCONTRADO si el usuario no existe', async () => {
    const resultado = await useCase.ejecutar('desconocido', '1234', '5678');

    expect(exigirFallo(resultado).motivo).toBe('USUARIO_NO_ENCONTRADO');
    expect(repo.cambiosPin).toHaveLength(0);
  });

  it('4. con PIN actual incorrecto devuelve PIN_ACTUAL_INCORRECTO y no llama a actualizarPin', async () => {
    repo.sembrar(crearUsuario({ pinHash: 'HASH:1234' }));

    const resultado = await useCase.ejecutar('u-1', '0000', '5678');

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PIN_ACTUAL_INCORRECTO',
    });
    expect(hasher.verificarInvocaciones).toBe(1);
    expect(repo.cambiosPin).toHaveLength(0);
  });

  it('5. en un cambio exitoso llama a actualizarPin con el hash del PIN nuevo', async () => {
    repo.sembrar(crearUsuario({ pinHash: 'HASH:1234' }));

    const resultado = await useCase.ejecutar('u-1', '1234', '5678');

    expect(resultado).toEqual({ exito: true });
    expect(repo.cambiosPin).toEqual([{ id: 'u-1', pinHash: 'HASH:5678' }]);
  });
});
