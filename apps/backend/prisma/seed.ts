/**
 * Seed inicial del sistema.
 *
 * El RF-06 prohibe el auto-registro: solo un Supervisor puede dar de alta
 * usuarios. Por eso el primer Supervisor debe plantarse por fuera de la app,
 * con este script.
 *
 * Uso:
 *   SEED_SUPERVISOR_NOMBRE="Nombre Apellido" SEED_SUPERVISOR_PIN=1234 \
 *     npx prisma db seed
 *
 * Si no se pasan esas variables se usa un nombre por defecto y un PIN aleatorio
 * de 4 digitos que se imprime UNA sola vez en consola.
 *
 * El hasheo del PIN usa argon2id, el mismo algoritmo que Argon2HasherAdapter
 * (apps/backend/src/modules/auth/infrastructure/argon2-hasher.adapter.ts).
 */
import { randomInt } from 'node:crypto';

import { PrismaClient, RolApp } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const RUTAS_INICIALES = [
  { nombre: 'Ruta 1', codigo: 'R1' },
  { nombre: 'Ruta 2', codigo: 'R2' },
  { nombre: 'Ruta 3', codigo: 'R3' },
  { nombre: 'Ruta 4', codigo: 'R4' },
  { nombre: 'Ruta 5', codigo: 'R5' },
];

/** Mismo algoritmo que Argon2HasherAdapter: argon2 variante argon2id. */
function hashPin(pinPlano: string): Promise<string> {
  return argon2.hash(pinPlano, { type: argon2.argon2id });
}

function generarPinAleatorio(): string {
  // 4 digitos, con ceros a la izquierda si hace falta (0000-9999).
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

async function seedRutas(): Promise<void> {
  const existentes = await prisma.ruta.findMany({
    where: { codigo: { in: RUTAS_INICIALES.map((r) => r.codigo) } },
    select: { codigo: true },
  });
  const yaCreadas = new Set(existentes.map((r) => r.codigo));
  const faltantes = RUTAS_INICIALES.filter((r) => !yaCreadas.has(r.codigo));

  if (faltantes.length === 0) {
    console.log('[seed] Las 5 rutas iniciales ya existen. No se crea ninguna.');
    return;
  }

  await prisma.ruta.createMany({
    data: faltantes.map((r) => ({ nombre: r.nombre, codigo: r.codigo, activa: true })),
  });
  console.log(
    `[seed] Rutas creadas: ${faltantes.map((r) => r.codigo).join(', ')}` +
      (yaCreadas.size > 0 ? ` (ya existian: ${[...yaCreadas].join(', ')})` : ''),
  );
}

async function seedSupervisor(): Promise<void> {
  const supervisorExistente = await prisma.usuarioApp.findFirst({
    where: { rolApp: RolApp.SUPERVISOR },
    select: { id: true, nombreCompleto: true },
  });

  if (supervisorExistente) {
    console.log(
      `[seed] Ya existe un Supervisor ("${supervisorExistente.nombreCompleto}"). ` +
        'No se crea ninguno nuevo.',
    );
    return;
  }

  const nombre = process.env.SEED_SUPERVISOR_NOMBRE?.trim() || 'Supervisor Inicial';
  const pinDesdeEnv = process.env.SEED_SUPERVISOR_PIN?.trim();
  const pin = pinDesdeEnv && pinDesdeEnv.length > 0 ? pinDesdeEnv : generarPinAleatorio();
  const pinGenerado = !pinDesdeEnv || pinDesdeEnv.length === 0;

  await prisma.usuarioApp.create({
    data: {
      nombreCompleto: nombre,
      pinHash: await hashPin(pin),
      rolApp: RolApp.SUPERVISOR,
      debeCambiarPin: true,
      activo: true,
      intentosFallidos: 0,
      usuarioHandyId: null,
    },
  });

  console.log('');
  console.log('==========================================================');
  console.log('  SUPERVISOR INICIAL CREADO');
  console.log('==========================================================');
  console.log(`  Nombre: ${nombre}`);
  console.log(`  PIN temporal${pinGenerado ? ' (generado al azar)' : ''}: ${pin}`);
  console.log('');
  console.log('  Este PIN se muestra UNA SOLA VEZ y no queda registrado en');
  console.log('  ningun lado (ni logs, ni base de datos: solo su hash).');
  console.log('  Anotalo ahora y cambialo en el primer login: la cuenta');
  console.log('  tiene debeCambiarPin = true y exigira el cambio.');
  console.log('==========================================================');
  console.log('');
}

async function main(): Promise<void> {
  await seedSupervisor();
  await seedRutas();
}

main()
  .catch((error) => {
    console.error('[seed] Error ejecutando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
