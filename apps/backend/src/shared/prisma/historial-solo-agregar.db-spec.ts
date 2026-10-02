import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prueba contra el Postgres REAL (`npm run test:db`, necesita Docker) de los
 * triggers de solo agregar de la migracion `historial_solo_agregar`. Con un
 * doble en memoria no se puede: lo que se prueba es la base misma.
 *
 * Todo corre dentro de UNA transaccion que al final se deshace (rollback): no
 * queda nada escrito. Cada intento que la base debe rechazar va dentro de un
 * SAVEPOINT, porque en Postgres un error deja la transaccion inservible hasta
 * volver a un punto seguro.
 */

type Tx = Prisma.TransactionClient;

/** Se lanza al final de cada prueba para deshacer la transaccion. */
class Deshacer extends Error {}

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

/** Corre `cuerpo` en una transaccion y la deshace siempre. */
async function enTransaccionDeshecha(cuerpo: (tx: Tx) => Promise<void>) {
  try {
    await prisma.$transaction(
      async (tx) => {
        await cuerpo(tx);
        throw new Deshacer();
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof Deshacer) {
      return;
    }
    throw error; // una expectativa que fallo adentro, con su mensaje
  }
}

/** `true` si la base acepto la sentencia; `false` y el mensaje si la rechazo. */
async function intentar(
  tx: Tx,
  sql: Prisma.Sql,
): Promise<{ aceptada: true } | { aceptada: false; error: string }> {
  await tx.$executeRawUnsafe('SAVEPOINT intento');
  try {
    await tx.$executeRaw(sql);
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT intento');
    return { aceptada: true };
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT intento');
    return { aceptada: false, error: String(error) };
  }
}

async function esperarRechazo(tx: Tx, sql: Prisma.Sql, mensaje: RegExp) {
  const resultado = await intentar(tx, sql);
  expect(resultado).toEqual({ aceptada: false, error: expect.stringMatching(mensaje) });
}

// ---------------------------------------------------------------------------
// Padres minimos para poder insertar en cada tabla.
// ---------------------------------------------------------------------------

async function crearUsuario(tx: Tx, rolApp: 'VENDEDOR' | 'CONTADOR' | 'SUPERVISOR') {
  return tx.usuarioApp.create({
    data: { nombreCompleto: `Prueba ${rolApp}`, pinHash: 'x', rolApp },
  });
}

async function crearProducto(tx: Tx, code: string) {
  return tx.producto.create({
    data: {
      code,
      nombre: `Producto ${code}`,
      precioCentavos: 1000,
      unidadCode: 'PZA',
      unidadDescripcion: 'Pieza',
    },
  });
}

async function crearEvento(tx: Tx) {
  const handy = await tx.usuarioHandy.create({
    data: {
      idHandy: 900_001,
      nombre: 'Vendedor Handy',
      rolHandyId: 1,
      rolHandyAuthority: 'ROLE_SELLER',
    },
  });
  const ruta = await tx.ruta.create({ data: { nombre: 'Ruta prueba', codigo: 'RP-1' } });
  return tx.eventoCarga.create({
    data: {
      rutaId: ruta.id,
      tipo: 'INICIAL',
      usuarioHandyId: handy.idHandy,
      fechaOperativa: new Date('2026-10-02T06:00:00Z'),
    },
  });
}

const SOLO_AGREGAR = /solo agregar/;

describe('tablas de solo agregar (triggers en Postgres)', () => {
  /**
   * Las cinco tablas que no aceptan ningun UPDATE, DELETE ni TRUNCATE. Cada
   * una sabe insertar un renglon valido y devuelve su id.
   */
  const tablas: Array<{ tabla: string; insertar: (tx: Tx) => Promise<string> }> = [
    {
      tabla: 'historiales_restablecimiento_pin',
      insertar: async (tx) => {
        const usuario = await crearUsuario(tx, 'VENDEDOR');
        const supervisor = await crearUsuario(tx, 'SUPERVISOR');
        const fila = await tx.historialRestablecimientoPin.create({
          data: { usuarioAppId: usuario.id, restablecidoPor: supervisor.id },
        });
        return fila.id;
      },
    },
    {
      tabla: 'historiales_desbloqueo',
      insertar: async (tx) => {
        const usuario = await crearUsuario(tx, 'VENDEDOR');
        const supervisor = await crearUsuario(tx, 'SUPERVISOR');
        const fila = await tx.historialDesbloqueo.create({
          data: {
            usuarioAppId: usuario.id,
            desbloqueadoPor: supervisor.id,
            bloqueadoHasta: new Date(),
          },
        });
        return fila.id;
      },
    },
    {
      tabla: 'cambios_fecha_operativa',
      insertar: async (tx) => {
        const evento = await crearEvento(tx);
        const vendedor = await crearUsuario(tx, 'VENDEDOR');
        const fila = await tx.cambioFechaOperativa.create({
          data: {
            eventoCargaId: evento.id,
            fechaAnterior: evento.fechaOperativa,
            fechaNueva: new Date('2026-10-03T06:00:00Z'),
            cambiadaPorId: vendedor.id,
          },
        });
        return fila.id;
      },
    },
    {
      tabla: 'cambios_factor_empaque',
      insertar: async (tx) => {
        const producto = await crearProducto(tx, 'P-EMP');
        const supervisor = await crearUsuario(tx, 'SUPERVISOR');
        const fila = await tx.cambioFactorEmpaque.create({
          data: {
            productoCode: producto.code,
            modalidadAnterior: 'POR_PIEZA',
            piezasAnterior: 12,
            estabaConfirmado: false,
            modalidadNueva: 'POR_PIEZA',
            piezasNueva: 24,
            cambiadoPorId: supervisor.id,
            fecha: new Date(),
            cargasEnCurso: 0,
          },
        });
        return fila.id;
      },
    },
    {
      tabla: 'revisiones_supervisor',
      insertar: async (tx) => {
        const fila = await tx.revisionSupervisor.create({
          data: await datosRevision(tx, 'P-REV'),
        });
        return fila.id;
      },
    },
  ];

  describe.each(tablas)('$tabla', ({ tabla, insertar }) => {
    it('INSERT pasa; UPDATE, DELETE y TRUNCATE se rechazan', async () => {
      await enTransaccionDeshecha(async (tx) => {
        const id = await insertar(tx);
        const t = Prisma.raw(`"${tabla}"`);

        await esperarRechazo(
          tx,
          Prisma.sql`UPDATE ${t} SET "id" = "id" WHERE "id" = ${id}`,
          SOLO_AGREGAR,
        );
        await esperarRechazo(
          tx,
          Prisma.sql`DELETE FROM ${t} WHERE "id" = ${id}`,
          SOLO_AGREGAR,
        );
        await esperarRechazo(tx, Prisma.sql`TRUNCATE ${t} CASCADE`, SOLO_AGREGAR);

        // Sigue ahi, intacto.
        const [{ total }] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM ${t} WHERE "id" = ${id}`,
        );
        expect(total).toBe(1n);
      });
    });
  });

  describe('revisiones_supervisor: una correccion es una revision nueva', () => {
    it('se corrige agregando con reemplazaAId; ni dos originales ni dos correcciones de la misma', async () => {
      await enTransaccionDeshecha(async (tx) => {
        const datos = await datosRevision(tx, 'P-CAD');
        const original = await tx.revisionSupervisor.create({ data: datos });

        // Una segunda revision ORIGINAL del mismo producto: indice parcial.
        await esperarRechazo(
          tx,
          Prisma.sql`INSERT INTO "revisiones_supervisor"
            ("id", "comparacionCargaId", "productoCode", "resultado")
            VALUES ('rev-dup', ${datos.comparacionCargaId}, ${datos.productoCode}, 'CORRECTO')`,
          /comparacionCargaId.*productoCode.*already exists/,
        );

        // La correccion: renglon nuevo que apunta a la anterior.
        const correccion = await tx.revisionSupervisor.create({
          data: { ...datos, resultado: 'CORRECTO', reemplazaAId: original.id },
        });
        expect(correccion.reemplazaAId).toBe(original.id);

        // Nadie se reemplaza dos veces.
        await esperarRechazo(
          tx,
          Prisma.sql`INSERT INTO "revisiones_supervisor"
            ("id", "comparacionCargaId", "productoCode", "resultado", "reemplazaAId")
            VALUES ('rev-2', ${datos.comparacionCargaId}, ${datos.productoCode}, 'CORRECTO', ${original.id})`,
          /reemplazaAId.*already exists/,
        );
      });
    });
  });

  describe('registros_sincronizacion: solo se cierra una vez', () => {
    async function abrir(tx: Tx): Promise<string> {
      const fila = await tx.registroSincronizacion.create({
        data: { origen: 'AUTOMATICA' },
      });
      return fila.id;
    }

    it('INSERT pasa y el cierre (terminadaEn + exito, una vez) pasa', async () => {
      await enTransaccionDeshecha(async (tx) => {
        const id = await abrir(tx);
        const cierre = await intentar(
          tx,
          Prisma.sql`UPDATE "registros_sincronizacion"
            SET "terminadaEn" = NOW(), "exito" = false WHERE "id" = ${id}`,
        );
        expect(cierre).toEqual({ aceptada: true });
      });
    });

    it('rechaza volver a cerrar, cerrar a medias, tocar otras columnas, DELETE y TRUNCATE', async () => {
      await enTransaccionDeshecha(async (tx) => {
        const abierta = await abrir(tx);
        const cerrada = await abrir(tx);
        await tx.$executeRaw`UPDATE "registros_sincronizacion"
          SET "terminadaEn" = NOW(), "exito" = false WHERE "id" = ${cerrada}`;
        const solo = /solo se cierra una vez/;

        // Una fallida no se convierte en exitosa.
        await esperarRechazo(
          tx,
          Prisma.sql`UPDATE "registros_sincronizacion" SET "exito" = true WHERE "id" = ${cerrada}`,
          solo,
        );
        // Cerrar sin decir si salio bien no es cerrar.
        await esperarRechazo(
          tx,
          Prisma.sql`UPDATE "registros_sincronizacion" SET "terminadaEn" = NOW() WHERE "id" = ${abierta}`,
          solo,
        );
        // El candado lee `iniciadaEn`: moverla manipularia el candado.
        await esperarRechazo(
          tx,
          Prisma.sql`UPDATE "registros_sincronizacion"
            SET "terminadaEn" = NOW(), "exito" = true, "iniciadaEn" = NOW() - INTERVAL '1 hour'
            WHERE "id" = ${abierta}`,
          solo,
        );
        await esperarRechazo(
          tx,
          Prisma.sql`DELETE FROM "registros_sincronizacion" WHERE "id" = ${cerrada}`,
          solo,
        );
        await esperarRechazo(
          tx,
          Prisma.sql`TRUNCATE "registros_sincronizacion"`,
          SOLO_AGREGAR,
        );
      });
    });
  });
});

/** Datos de una revision original de `productoCode` sobre una comparacion nueva. */
async function datosRevision(tx: Tx, productoCode: string) {
  const evento = await crearEvento(tx);
  const vendedor = await crearUsuario(tx, 'VENDEDOR');
  const contador = await crearUsuario(tx, 'CONTADOR');
  const producto = await crearProducto(tx, productoCode);
  const comparacion = await tx.comparacionCarga.create({
    data: {
      eventoCargaId: evento.id,
      vendedorUsuarioAppId: vendedor.id,
      contadorUsuarioAppId: contador.id,
      totalProductos: 1,
      productosConDiscrepancia: 1,
    },
  });
  return {
    comparacionCargaId: comparacion.id,
    productoCode: producto.code,
    resultado: 'INCORRECTO' as const,
    cantidadRealEncontrada: 7,
  };
}
