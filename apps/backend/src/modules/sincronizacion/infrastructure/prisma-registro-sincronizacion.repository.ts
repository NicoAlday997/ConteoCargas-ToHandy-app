import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  ResultadoCandado,
  UltimaSincronizacion,
} from '../domain/candado-sincronizacion';
import {
  RegistroSincronizacionRepository,
  type NuevoRegistroSincronizacion,
  type ResultadoReserva,
} from '../application/registro-sincronizacion.repository';

/**
 * Llave del candado de Postgres que serializa las reservas. Un numero fijo y
 * propio de este uso: solo tiene que no chocar con otro `pg_advisory_*`.
 */
const LLAVE_CANDADO_SINCRONIZACION = 4_726_301;

/** Adaptador Prisma de la bitacora `registros_sincronizacion`. */
@Injectable()
export class PrismaRegistroSincronizacionRepository extends RegistroSincronizacionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Leer la ultima y crear la nueva van en una transaccion que primero toma
   * `pg_advisory_xact_lock`: si dos dispositivos pulsan a la vez, el segundo
   * espera a que el primero confirme su fila y entonces la ve. Sin esto, los
   * dos leerian "hace 3 minutos" y los dos irian a Handy. El candado se suelta
   * solo al terminar la transaccion (milisegundos: no abarca la llamada a
   * Handy, que va despues y fuera de ella).
   */
  async reservar(
    registro: NuevoRegistroSincronizacion,
    evaluar: (ultima: UltimaSincronizacion | null) => ResultadoCandado,
  ): Promise<ResultadoReserva> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_CANDADO_SINCRONIZACION})`;
      const ultima = await tx.registroSincronizacion.findFirst({
        orderBy: { iniciadaEn: 'desc' },
        select: { iniciadaEn: true, exito: true },
      });
      const candado = evaluar(ultima);
      if (!candado.libre) {
        return {
          reservado: false,
          motivo: candado.motivo,
          reintentarEn: candado.reintentarEn,
        };
      }
      const creado = await tx.registroSincronizacion.create({
        data: {
          origen: registro.origen,
          usuarioAppId: registro.usuarioAppId,
          iniciadaEn: registro.iniciadaEn,
        },
        select: { id: true },
      });
      return { reservado: true, registroId: creado.id };
    });
  }

  async registrar(registro: NuevoRegistroSincronizacion): Promise<string> {
    const creado = await this.prisma.registroSincronizacion.create({
      data: {
        origen: registro.origen,
        usuarioAppId: registro.usuarioAppId,
        iniciadaEn: registro.iniciadaEn,
      },
      select: { id: true },
    });
    return creado.id;
  }

  async terminar(
    registroId: string,
    datos: { terminadaEn: Date; exito: boolean },
  ): Promise<void> {
    await this.prisma.registroSincronizacion.update({
      where: { id: registroId },
      data: { terminadaEn: datos.terminadaEn, exito: datos.exito },
    });
  }
}
