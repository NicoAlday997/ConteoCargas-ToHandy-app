import { RolApp } from '@prisma/client';

import {
  MAX_INTENTOS_FALLIDOS,
  MINUTOS_BLOQUEO,
} from '../domain/politica-acceso';
import { HasherPort } from './hasher.port';
import { LoginUseCase, type ResultadoLogin } from './login.use-case';
import type {
  ActualizacionAcceso,
  UsuarioAutenticable,
  UsuarioParaSeleccion,
  UsuarioRepository,
} from './usuario.repository';

/**
 * Pruebas del caso de uso de login (RF-02).
 * Sin base de datos ni argon2 reales: se usan dobles en memoria de los puertos.
 */

/** Instante fijo de referencia para todas las pruebas. */
const AHORA = new Date('2026-09-01T20:00:00-06:00');

/**
 * Repositorio falso: guarda los usuarios en un Map y registra cada llamada
 * a `actualizarEstadoAcceso` y a `buscarPorId` para poder verificarlas.
 */
class FakeUsuarioRepository implements UsuarioRepository {
  readonly usuarios = new Map<string, UsuarioAutenticable>();
  readonly actualizaciones: Array<{ id: string; datos: ActualizacionAcceso }> =
    [];
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

  async actualizarEstadoAcceso(
    id: string,
    datos: ActualizacionAcceso,
  ): Promise<void> {
    this.actualizaciones.push({ id, datos });
    const actual = this.usuarios.get(id);
    if (actual !== undefined) {
      this.usuarios.set(id, {
        ...actual,
        intentosFallidos: datos.intentosFallidos,
        bloqueadoHasta: datos.bloqueadoHasta,
      });
    }
  }

  actualizarPin(): Promise<void> {
    throw new Error('no usado en estas pruebas');
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
    debeCambiarPin: false,
    activo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...overrides,
  };
}

/** Estrecha el resultado a la variante exitosa o falla la prueba. */
function exigirExito(
  resultado: ResultadoLogin,
): Extract<ResultadoLogin, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('LoginUseCase', () => {
  let repo: FakeUsuarioRepository;
  let hasher: FakeHasher;
  let useCase: LoginUseCase;

  beforeEach(() => {
    repo = new FakeUsuarioRepository();
    hasher = new FakeHasher();
    useCase = new LoginUseCase(repo, hasher);
  });

  it('1. rechaza un PIN mal formado sin consultar el repositorio', async () => {
    const resultado = await useCase.ejecutar('u-1', '12ab', AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'PIN_MAL_FORMADO' });
    expect(repo.buscarPorIdInvocaciones).toBe(0);
  });

  it('2. devuelve CREDENCIALES_INVALIDAS si el usuario no existe', async () => {
    const resultado = await useCase.ejecutar('desconocido', '1234', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'CREDENCIALES_INVALIDAS',
    });
  });

  it('3. devuelve INACTIVO si el usuario esta inactivo aunque el PIN sea correcto', async () => {
    repo.sembrar(crearUsuario({ activo: false }));

    const resultado = await useCase.ejecutar('u-1', '1234', AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'INACTIVO' });
    expect(hasher.verificarInvocaciones).toBe(0);
  });

  it('4. devuelve BLOQUEADO con la fecha de desbloqueo y no invoca al hasher', async () => {
    const bloqueadoHasta = new Date(AHORA.getTime() + 60_000);
    repo.sembrar(crearUsuario({ bloqueadoHasta, intentosFallidos: 5 }));

    const resultado = await useCase.ejecutar('u-1', '1234', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'BLOQUEADO',
      bloqueadoHasta,
    });
    expect(hasher.verificarInvocaciones).toBe(0);
    expect(repo.actualizaciones).toHaveLength(0);
  });

  it('5. permite intentar cuando el bloqueo ya vencio y entra con PIN correcto', async () => {
    repo.sembrar(
      crearUsuario({
        bloqueadoHasta: new Date(AHORA.getTime() - 60_000),
        intentosFallidos: 4,
      }),
    );

    const resultado = await useCase.ejecutar('u-1', '1234', AHORA);

    expect(exigirExito(resultado).usuarioAppId).toBe('u-1');
    expect(hasher.verificarInvocaciones).toBe(1);
  });

  it('6. con PIN incorrecto devuelve PIN_INCORRECTO con intentos restantes e incrementa intentosFallidos', async () => {
    repo.sembrar(crearUsuario({ intentosFallidos: 2 }));

    const resultado = await useCase.ejecutar('u-1', '0000', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'PIN_INCORRECTO',
      intentosRestantes: MAX_INTENTOS_FALLIDOS - 3,
    });
    expect(repo.actualizaciones).toHaveLength(1);
    expect(repo.actualizaciones[0]).toEqual({
      id: 'u-1',
      datos: { intentosFallidos: 3, bloqueadoHasta: null },
    });
  });

  it('7. al quinto intento fallido consecutivo devuelve BLOQUEO_ACTIVADO y persiste bloqueadoHasta', async () => {
    repo.sembrar(crearUsuario({ intentosFallidos: 4 }));
    const bloqueadoHastaEsperado = new Date(
      AHORA.getTime() + MINUTOS_BLOQUEO * 60 * 1000,
    );

    const resultado = await useCase.ejecutar('u-1', '9999', AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'BLOQUEO_ACTIVADO',
      bloqueadoHasta: bloqueadoHastaEsperado,
    });
    const { datos } = repo.actualizaciones[0];
    expect(datos.intentosFallidos).toBe(5);
    expect(datos.bloqueadoHasta).toEqual(bloqueadoHastaEsperado);
  });

  it('7b. intentos restantes decrecen de uno en uno hasta la transicion al bloqueo', async () => {
    repo.sembrar(crearUsuario());

    const restantes: number[] = [];
    for (let i = 1; i < MAX_INTENTOS_FALLIDOS; i++) {
      const resultado = await useCase.ejecutar('u-1', '0000', AHORA);
      if (resultado.exito || resultado.motivo !== 'PIN_INCORRECTO') {
        throw new Error(`intento ${i}: resultado inesperado`);
      }
      restantes.push(resultado.intentosRestantes);
    }
    expect(restantes).toEqual([4, 3, 2, 1]);

    const ultimo = await useCase.ejecutar('u-1', '0000', AHORA);
    expect(ultimo).toEqual({
      exito: false,
      motivo: 'BLOQUEO_ACTIVADO',
      bloqueadoHasta: new Date(AHORA.getTime() + MINUTOS_BLOQUEO * 60 * 1000),
    });

    // Ya bloqueado: ni el PIN correcto entra y no se toca el contador.
    const siguiente = await useCase.ejecutar('u-1', '1234', AHORA);
    expect(!siguiente.exito && siguiente.motivo).toBe('BLOQUEADO');
    expect(repo.actualizaciones).toHaveLength(MAX_INTENTOS_FALLIDOS);
  });

  it('7c. un usuario inexistente no recibe intentos restantes', async () => {
    const resultado = await useCase.ejecutar('desconocido', '0000', AHORA);

    expect(resultado).not.toHaveProperty('intentosRestantes');
    expect(resultado).not.toHaveProperty('bloqueadoHasta');
  });

  it('8. en login exitoso devuelve los datos del usuario', async () => {
    repo.sembrar(
      crearUsuario({
        nombreCompleto: 'Beto Contador',
        rolApp: RolApp.CONTADOR,
        usuarioHandyId: null,
        debeCambiarPin: false,
      }),
    );

    const resultado = exigirExito(await useCase.ejecutar('u-1', '1234', AHORA));

    expect(resultado).toEqual({
      exito: true,
      usuarioAppId: 'u-1',
      nombreCompleto: 'Beto Contador',
      rolApp: RolApp.CONTADOR,
      usuarioHandyId: null,
      debeCambiarPin: false,
    });
  });

  it('9. en login exitoso persiste intentosFallidos en 0 y bloqueadoHasta en null', async () => {
    repo.sembrar(crearUsuario({ intentosFallidos: 3, bloqueadoHasta: null }));

    await useCase.ejecutar('u-1', '1234', AHORA);

    expect(repo.actualizaciones).toHaveLength(1);
    expect(repo.actualizaciones[0]).toEqual({
      id: 'u-1',
      datos: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  });

  it('10. un vendedor con debeCambiarPin true lo refleja en el resultado', async () => {
    repo.sembrar(
      crearUsuario({ rolApp: RolApp.VENDEDOR, debeCambiarPin: true }),
    );

    const resultado = exigirExito(await useCase.ejecutar('u-1', '1234', AHORA));

    expect(resultado.debeCambiarPin).toBe(true);
    expect(resultado.rolApp).toBe(RolApp.VENDEDOR);
  });
});
