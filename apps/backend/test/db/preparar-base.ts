import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Preparacion de `npm run test:db` (globalSetup de `jest.db.config.ts`).
 *
 * Nunca toca la base de desarrollo: toma `DATABASE_URL` de `.env`, le agrega
 * `_test` al nombre (`handy_conteo` -> `handy_conteo_test`, en el mismo
 * Postgres de Docker) y le aplica las migraciones con `prisma migrate deploy`
 * (la crea si no existe; no borra nada). Asi la prueba ve exactamente lo que
 * crean las migraciones, incluido el SQL manual que Prisma no conoce
 * (triggers, indices parciales, CHECK).
 *
 * La base de prueba se queda entre corridas: las pruebas no dependen de que
 * este vacia (cada una crea sus propios datos, con claves unicas). Si algun
 * dia queda en mal estado, borrala a mano y se recrea sola:
 * `docker exec handy_conteo_db dropdb -U handy_app handy_conteo_test`.
 *
 * Se niega a correr contra algo que no sea localhost.
 */
export default function prepararBase(): void {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const original = process.env.DATABASE_URL;
  if (original === undefined || original === '') {
    throw new Error('test:db: falta DATABASE_URL (en .env o en el entorno).');
  }

  const url = new URL(original);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error(
      `test:db: DATABASE_URL apunta a ${url.hostname}; solo corre contra un Postgres local (Docker).`,
    );
  }
  const nombre = url.pathname.replace(/^\//, '');
  if (!nombre.endsWith('_test')) {
    url.pathname = `/${nombre}_test`;
  }
  const urlPrueba = url.toString();

  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: urlPrueba },
      stdio: 'pipe',
    });
  } catch (error) {
    const salida = (error as { stderr?: Buffer; stdout?: Buffer });
    throw new Error(
      'test:db: no se pudo preparar la base de prueba. ¿Esta levantado Docker ' +
        '(`docker compose up -d` en apps/backend)?\n' +
        `${salida.stdout?.toString() ?? ''}${salida.stderr?.toString() ?? ''}`,
    );
  }

  // Las pruebas corren en este mismo proceso (--runInBand) y leen esta.
  process.env.DATABASE_URL = urlPrueba;
}
