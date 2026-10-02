import { randomUUID } from 'node:crypto';

import type { EstadoCarga } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { DatosCrearEvento } from '../application/carga.repository';
import { PrismaCargaRepository } from './prisma-carga.repository';

/**
 * Prueba contra el Postgres REAL (`npm run test:db`, necesita Docker) de las
 * dos operaciones de `PrismaCargaRepository` que hacen dos escrituras en una
 * sola transaccion. Los dobles en memoria de los casos de uso solo pueden
 * imitar el rollback; aqui se comprueba que la base de verdad no deja nada a
 * medias si falla el segundo paso.
 *
 * Escribe de verdad en la base de prueba (`handy_conteo_test`), por eso cada
 * prueba crea su propia ruta, usuarios y productos con claves unicas.
 */

const prisma = new PrismaService();
const repo = new PrismaCargaRepository(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

function unico(prefijo: string): string {
  return `${prefijo}-${randomUUID().slice(0, 8)}`;
}

/** Ruta, vendedor (app + Handy) y los datos para crear su carga INICIAL. */
async function sembrarRuta(): Promise<{ vendedorId: string; datos: DatosCrearEvento }> {
  const idHandy = Math.floor(Math.random() * 1_000_000_000);
  await prisma.usuarioHandy.create({
    data: { idHandy, nombre: 'Vendedor', rolHandyId: 1, rolHandyAuthority: 'ROLE_SELLER' },
  });
  const ruta = await prisma.ruta.create({
    data: { nombre: 'Ruta prueba', codigo: unico('R') },
  });
  const vendedor = await prisma.usuarioApp.create({
    data: { nombreCompleto: 'Vendedor', pinHash: 'x', rolApp: 'VENDEDOR', usuarioHandyId: idHandy },
  });
  return {
    vendedorId: vendedor.id,
    datos: {
      rutaId: ruta.id,
      plantillaId: null,
      tipo: 'INICIAL',
      usuarioHandyId: idHandy,
      tipoOperacion: 'AUTOVENTA',
      fechaConteo: new Date('2026-10-02T12:00:00Z'),
      fechaOperativa: new Date('2026-10-02T06:00:00Z'),
    },
  };
}

describe('PrismaCargaRepository contra Postgres', () => {
  describe('crearEventoConSesion', () => {
    it('si falla la sesion (segundo paso), no queda la carga y la ruta sigue libre', async () => {
      const { vendedorId, datos } = await sembrarRuta();

      // La sesion apunta a un usuario que no existe: la llave foranea la
      // rechaza DESPUES de que el evento ya se inserto en la transaccion.
      await expect(
        repo.crearEventoConSesion(datos, { tipo: 'VENDEDOR', usuarioAppId: 'no-existe' }),
      ).rejects.toThrow();

      expect(await prisma.eventoCarga.count({ where: { rutaId: datos.rutaId } })).toBe(0);

      // Sin carga fantasma, el indice de "una inicial sin terminar por ruta"
      // deja crear la buena.
      const { evento, sesion } = await repo.crearEventoConSesion(datos, {
        tipo: 'VENDEDOR',
        usuarioAppId: vendedorId,
      });
      expect(evento.estado).toBe('BORRADOR');
      expect(sesion).toMatchObject({
        eventoCargaId: evento.id,
        tipo: 'VENDEDOR',
        usuarioAppId: vendedorId,
        estado: 'ABIERTA',
      });
    });
  });

  describe('confirmarDiscrepancia', () => {
    /** Carga en CONFLICTOS_PENDIENTES con discrepancias capturadas por el vendedor. */
    async function sembrarConflictos(productos: string[]) {
      const { vendedorId, datos } = await sembrarRuta();
      const contador = await prisma.usuarioApp.create({
        data: { nombreCompleto: 'Contador', pinHash: 'x', rolApp: 'CONTADOR' },
      });
      const evento = await prisma.eventoCarga.create({
        data: { ...datos, estado: 'CONFLICTOS_PENDIENTES' },
      });
      const codes = productos.map((p) => unico(p));
      for (const code of codes) {
        await prisma.producto.create({
          data: {
            code,
            nombre: code,
            precioCentavos: 1000,
            unidadCode: 'PZA',
            unidadDescripcion: 'Pieza',
          },
        });
        await prisma.discrepanciaResuelta.create({
          data: {
            eventoCargaId: evento.id,
            productoCode: code,
            cantidadVendedorOriginal: 10,
            cantidadContadorOriginal: 12,
            cantidadFinal: 11,
            capturadaPor: vendedorId,
            fechaCaptura: new Date(),
          },
        });
      }
      return { eventoId: evento.id, contadorId: contador.id, codes };
    }

    const aEspera = (): EstadoCarga => 'EN_ESPERA_AUTORIZACION';

    it('si falla el cambio de estado (segundo paso), la confirmacion tampoco queda', async () => {
      const { eventoId, contadorId, codes } = await sembrarConflictos(['P']);

      // Un estado que no existe en el enum: la escritura del evento truena con
      // la confirmacion ya hecha dentro de la transaccion.
      await expect(
        repo.confirmarDiscrepancia(
          eventoId,
          codes[0],
          { confirmadaPor: contadorId, fechaConfirmacion: new Date() },
          () => 'NO_EXISTE' as EstadoCarga,
        ),
      ).rejects.toThrow();

      const discrepancia = await prisma.discrepanciaResuelta.findFirstOrThrow({
        where: { eventoCargaId: eventoId },
      });
      expect(discrepancia.confirmadaPor).toBeNull();
      expect(discrepancia.fechaConfirmacion).toBeNull();
      const evento = await prisma.eventoCarga.findUniqueOrThrow({ where: { id: eventoId } });
      expect(evento.estado).toBe('CONFLICTOS_PENDIENTES');
    });

    it('confirma y cambia el estado juntos cuando sale bien', async () => {
      const { eventoId, contadorId, codes } = await sembrarConflictos(['P']);

      const { discrepancia, evento } = await repo.confirmarDiscrepancia(
        eventoId,
        codes[0],
        { confirmadaPor: contadorId, fechaConfirmacion: new Date() },
        aEspera,
      );

      expect(discrepancia.confirmadaPor).toBe(contadorId);
      expect(evento.estado).toBe('EN_ESPERA_AUTORIZACION');
    });

    it('bloquea el evento: espera a quien lo tenga tomado (dos confirmaciones no se cruzan)', async () => {
      const { eventoId, contadorId, codes } = await sembrarConflictos(['P']);

      // Otra transaccion toma el evento (como lo haria una confirmacion
      // simultanea) y no lo suelta hasta que la prueba diga.
      let soltar!: () => void;
      const suelto = new Promise<void>((r) => (soltar = r));
      let avisarTomado!: () => void;
      const tomado = new Promise<void>((r) => (avisarTomado = r));
      const otra = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM "eventos_carga" WHERE "id" = ${eventoId} FOR UPDATE`;
          avisarTomado();
          await suelto;
        },
        { timeout: 10_000 },
      );
      await tomado;

      let termino = false;
      const confirmacion = repo
        .confirmarDiscrepancia(
          eventoId,
          codes[0],
          { confirmadaPor: contadorId, fechaConfirmacion: new Date() },
          // Sin cambio de estado: asi lo unico que puede hacerla esperar es
          // el candado inicial, no el UPDATE del evento.
          () => null,
        )
        .then((r) => {
          termino = true;
          return r;
        });

      // Sin el FOR UPDATE, la confirmacion terminaria aqui mismo y una
      // confirmacion simultanea de la otra discrepancia no la veria.
      await new Promise((r) => setTimeout(r, 400));
      expect(termino).toBe(false);

      soltar();
      await otra;
      const { discrepancia } = await confirmacion;
      expect(discrepancia.confirmadaPor).toBe(contadorId);
    });
  });
});
