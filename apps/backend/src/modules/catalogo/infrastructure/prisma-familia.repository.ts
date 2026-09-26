import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  esColorFamiliaValido,
  type ColorFamilia,
} from '../domain/colores-familia';
import {
  FamiliaRepository,
  type FamiliaDelCatalogo,
} from '../application/familia.repository';

/** Adaptador Prisma del puerto `FamiliaRepository`. */
@Injectable()
export class PrismaFamiliaRepository extends FamiliaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listarFamilias(): Promise<FamiliaDelCatalogo[]> {
    const grupos = await this.prisma.producto.groupBy({
      by: ['familia'],
      where: { activo: true, familia: { not: null } },
      _count: { _all: true },
    });
    return grupos.flatMap((g) =>
      g.familia === null
        ? []
        : [{ familia: g.familia, productos: g._count._all }],
    );
  }

  async listarColores(): Promise<Map<string, ColorFamilia>> {
    const filas = await this.prisma.colorFamilia.findMany({
      select: { familia: true, color: true },
    });
    // Una fila con un color que ya no esta en la paleta se ignora: se ve
    // neutra, como sin color.
    return new Map(
      filas.flatMap((f) =>
        esColorFamiliaValido(f.color) ? [[f.familia, f.color] as const] : [],
      ),
    );
  }

  async existeFamilia(familia: string): Promise<boolean> {
    const producto = await this.prisma.producto.findFirst({
      where: { activo: true, familia },
      select: { code: true },
    });
    return producto !== null;
  }

  async asignarColor(
    familia: string,
    color: ColorFamilia,
    asignadoPorId: string,
  ): Promise<void> {
    await this.prisma.colorFamilia.upsert({
      where: { familia },
      create: { familia, color, asignadoPorId },
      update: { color, asignadoPorId },
    });
  }

  async quitarColor(familia: string): Promise<void> {
    await this.prisma.colorFamilia.deleteMany({ where: { familia } });
  }
}
