import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  ProductoConteoRepository,
  type FactorDeConteo,
  type ProductoDeConteo,
} from '../application/producto-conteo.repository';

/** Adaptador Prisma del puerto `ProductoConteoRepository`. */
@Injectable()
export class PrismaProductoConteoRepository extends ProductoConteoRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarFactores(codes: string[]): Promise<Map<string, FactorDeConteo>> {
    if (codes.length === 0) return new Map();
    const rows = await this.prisma.producto.findMany({
      where: { code: { in: codes } },
      select: {
        code: true,
        modalidadVenta: true,
        piezasPorPaquete: true,
        factorConfirmado: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.code,
        {
          modalidadVenta: r.modalidadVenta,
          piezasPorPaquete: r.piezasPorPaquete,
          factorConfirmado: r.factorConfirmado,
        },
      ]),
    );
  }

  private static readonly SELECT_CONTEO = {
    code: true,
    nombre: true,
    unidadCode: true,
    unidadDescripcion: true,
    familia: true,
    modalidadVenta: true,
    piezasPorPaquete: true,
    factorConfirmado: true,
  } satisfies Prisma.ProductoSelect;

  async listarActivos(plantillaId: string | null): Promise<ProductoDeConteo[]> {
    return this.prisma.producto.findMany({
      where: {
        activo: true,
        ...(plantillaId === null
          ? {}
          : { plantillaProductos: { some: { plantillaId } } }),
      },
      select: PrismaProductoConteoRepository.SELECT_CONTEO,
    });
  }

  async listarContadosEnEvento(eventoId: string): Promise<ProductoDeConteo[]> {
    return this.prisma.producto.findMany({
      where: {
        activo: true,
        conteoItems: { some: { sesion: { eventoCargaId: eventoId } } },
      },
      select: PrismaProductoConteoRepository.SELECT_CONTEO,
    });
  }

  async buscarColoresDeFamilias(
    familias: string[],
  ): Promise<Map<string, string>> {
    if (familias.length === 0) return new Map();
    const filas = await this.prisma.colorFamilia.findMany({
      where: { familia: { in: familias } },
      select: { familia: true, color: true },
    });
    return new Map(filas.map((f) => [f.familia, f.color]));
  }
}
