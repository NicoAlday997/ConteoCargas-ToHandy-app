import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  type DiaNoLaborable,
  DiaNoLaborableDuplicadoError,
  DiaNoLaborableRepository,
} from '../application/dia-no-laborable.repository';

const SELECCION = {
  fecha: true,
  motivo: true,
  creadoPorId: true,
  creadoEn: true,
  creadoPor: { select: { nombreCompleto: true } },
} satisfies Prisma.DiaNoLaborableSelect;

type Fila = Prisma.DiaNoLaborableGetPayload<{ select: typeof SELECCION }>;

function aDominio(fila: Fila): DiaNoLaborable {
  return {
    fecha: fila.fecha,
    motivo: fila.motivo,
    creadoPorId: fila.creadoPorId,
    creadoPorNombre: fila.creadoPor?.nombreCompleto ?? null,
    creadoEn: fila.creadoEn,
  };
}

/**
 * Adaptador Prisma del puerto `DiaNoLaborableRepository`. La fecha llega ya
 * normalizada al inicio del dia de negocio: aqui solo se guarda y se busca.
 */
@Injectable()
export class PrismaDiaNoLaborableRepository extends DiaNoLaborableRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]> {
    const filas = await this.prisma.diaNoLaborable.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
      select: SELECCION,
    });
    return filas.map(aDominio);
  }

  async marcar(
    fecha: Date,
    motivo: string,
    usuarioId: string,
  ): Promise<DiaNoLaborable> {
    try {
      const fila = await this.prisma.diaNoLaborable.create({
        data: { fecha, motivo, creadoPorId: usuarioId },
        select: SELECCION,
      });
      return aDominio(fila);
    } catch (error) {
      // P2002 = violacion de unicidad: la fecha es la llave primaria.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DiaNoLaborableDuplicadoError();
      }
      throw error;
    }
  }

  async quitar(fecha: Date): Promise<boolean> {
    const { count } = await this.prisma.diaNoLaborable.deleteMany({
      where: { fecha },
    });
    return count > 0;
  }
}
