import { Injectable } from '@nestjs/common';

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

  async listarActivos(plantillaId: string | null): Promise<ProductoDeConteo[]> {
    return this.prisma.producto.findMany({
      where: {
        activo: true,
        ...(plantillaId === null
          ? {}
          : { plantillaProductos: { some: { plantillaId } } }),
      },
      select: {
        code: true,
        nombre: true,
        unidadCode: true,
        unidadDescripcion: true,
        familia: true,
        modalidadVenta: true,
        piezasPorPaquete: true,
        factorConfirmado: true,
      },
    });
  }
}
