/**
 * Restablecimiento de PIN de emergencia por linea de comandos (docs/07 §12).
 *
 *   DATABASE_URL="postgresql://..." npm run reestablecer-pin -- \
 *     --usuario "NOMBRE COMPLETO" --motivo "por que se hace"
 *
 * Para cuando nadie puede hacerlo desde la app: el unico supervisor olvido su
 * PIN, o no hay otro a la mano. No necesita el servidor corriendo; solo la
 * cadena de conexion, que es el verdadero control del sistema.
 *
 * Usa el mismo `RestablecerPinUseCase` y el mismo hasher que la app: PIN
 * temporal aleatorio, `debeCambiarPin = true`, sin intentos fallidos ni
 * bloqueo. Queda en el historial con origen LINEA_COMANDOS y el motivo, que
 * es obligatorio porque nunca se sabra quien lo corrio.
 *
 * El PIN temporal se imprime UNA vez en pantalla; no se escribe en ningun
 * registro, archivo ni en la base (solo su hash).
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

// Ojo: nada de Prisma en los imports de arriba. `@prisma/client` carga el
// .env local al importarse y llenaria DATABASE_URL por su cuenta; se importa
// abajo, despues de leer la variable del entorno real.
import {
  buscarCandidato,
  confirmacionValida,
  describirBase,
  validarArgumentos,
  type CandidatoRestablecer,
} from './reestablecer-pin.reglas';

const USO =
  'Uso: DATABASE_URL="postgresql://..." npm run reestablecer-pin -- ' +
  '--usuario "NOMBRE COMPLETO" --motivo "por que se hace"';

function renglon(u: CandidatoRestablecer): string {
  const estado = u.activo ? '' : '  (INACTIVO)';
  return `  ${u.nombreCompleto}  ·  ${u.rolApp}  ·  id ${u.id}${estado}`;
}

/**
 * Una sola respuesta del teclado. La interfaz se abre justo aqui y no antes:
 * abierta desde el principio, consume la entrada y se cierra antes de la
 * pregunta. Sin respuesta (fin de la entrada) devuelve cadena vacia.
 */
async function preguntar(texto: string): Promise<string> {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await terminal.question(texto);
  } catch {
    return '';
  } finally {
    terminal.close();
  }
}

/** Devuelve el codigo de salida: 0 si se restablecio, 1 si no. */
async function principal(): Promise<number> {
  let valores: { usuario?: string; motivo?: string };
  try {
    ({ values: valores } = parseArgs({
      options: {
        usuario: { type: 'string' },
        motivo: { type: 'string' },
      },
      strict: true,
    }));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USO}`);
    return 1;
  }

  const argumentos = validarArgumentos(valores.usuario, valores.motivo);
  if (!argumentos.ok) {
    console.error(`${argumentos.error}\n${USO}`);
    return 1;
  }

  // Se exige en el entorno a proposito: nunca se toma del .env local, para
  // que nadie crea que esta tocando produccion cuando no (o al reves). Por
  // eso se lee ANTES de importar Prisma.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    console.error(
      'Falta DATABASE_URL: pega la External Database URL de Render (docs/07 §12).\n' +
        USO,
    );
    return 1;
  }

  // `require` y no `import()`: el proyecto compila a CommonJS y ts-node deja
  // el `import()` como ESM nativo, que no resuelve rutas sin extension.
  const { PrismaService } =
    require('../shared/prisma/prisma.service') as typeof import('../shared/prisma/prisma.service');
  const { PrismaAdminUsuarioRepository } =
    require('../modules/usuarios/infrastructure/prisma-admin-usuario.repository') as typeof import('../modules/usuarios/infrastructure/prisma-admin-usuario.repository');
  const { Argon2HasherAdapter } =
    require('../modules/auth/infrastructure/argon2-hasher.adapter') as typeof import('../modules/auth/infrastructure/argon2-hasher.adapter');
  const { RestablecerPinUseCase } =
    require('../modules/usuarios/application/restablecer-pin.use-case') as typeof import('../modules/usuarios/application/restablecer-pin.use-case');

  const prisma = new PrismaService({ datasourceUrl: databaseUrl });
  try {
    const usuarios = await prisma.usuarioApp.findMany({
      select: { id: true, nombreCompleto: true, rolApp: true, activo: true },
      orderBy: { nombreCompleto: 'asc' },
    });

    const busqueda = buscarCandidato(usuarios, argumentos.usuario);
    if (busqueda.tipo === 'NINGUNO') {
      console.error(
        `No hay nadie cuyo nombre contenga "${argumentos.usuario}". No se cambio nada.`,
      );
      return 1;
    }
    if (busqueda.tipo === 'VARIOS') {
      console.error(
        `Hay ${busqueda.coincidencias.length} personas que coinciden con ` +
          `"${argumentos.usuario}". No se cambio nada.\n` +
          busqueda.coincidencias.map(renglon).join('\n') +
          '\nVuelve a correrlo con --usuario "<id>" de la persona correcta.',
      );
      return 1;
    }

    const usuario = busqueda.usuario;
    if (!usuario.activo) {
      console.error(
        `${usuario.nombreCompleto} esta INACTIVA: aunque tenga PIN no puede ` +
          'entrar. No se cambio nada.',
      );
      return 1;
    }

    console.log(
      `\nBase:    ${describirBase(databaseUrl)}\n` +
        `Persona: ${usuario.nombreCompleto} (${usuario.rolApp})\n` +
        `Motivo:  ${argumentos.motivo}\n\n` +
        'Se le pondra un PIN temporal nuevo y tendra que cambiarlo al entrar.\n' +
        'El motivo queda en el historial para siempre.\n',
    );
    const escrito = await preguntar(
      'Para confirmar, escribe su nombre completo: ',
    );
    if (!confirmacionValida(usuario, escrito)) {
      console.error('El nombre no coincide. No se cambio nada.');
      return 1;
    }

    const restablecer = new RestablecerPinUseCase(
      new PrismaAdminUsuarioRepository(prisma),
      new Argon2HasherAdapter(),
    );
    const resultado = await restablecer.ejecutar(usuario.id, {
      origen: 'LINEA_COMANDOS',
      motivo: argumentos.motivo,
    });
    if (!resultado.exito) {
      console.error(`No se pudo restablecer (${resultado.motivo}).`);
      return 1;
    }

    console.log(
      `\nPIN temporal de ${usuario.nombreCompleto}: ${resultado.pinTemporal}\n\n` +
        'Se muestra solo esta vez y no se guarda en ningun lado. Daselo en\n' +
        'persona; al entrar, la app le pedira cambiarlo.\n',
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

principal().then(
  (codigo) => process.exit(codigo),
  (error: unknown) => {
    console.error('Error inesperado; revisa si se cambio algo:', error);
    process.exit(1);
  },
);
