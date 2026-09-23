import { Injectable } from '@nestjs/common';
import type { PermisoCargaSinLiquidar as PermisoRow } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  PermisoCargaRepository,
  type DatosCrearPermiso,
  type PermisoCargaSinLiquidar,
  type PermisoVigenteDetallado,
} from '../application/permiso-carga.repository';

/** Adaptador Prisma del puerto `PermisoCargaRepository`. */
@Injectable()
export class PrismaPermisoCargaRepository extends PermisoCargaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async existeRuta(rutaId: string): Promise<boolean> {
    const ruta = await this.prisma.ruta.findUnique({
      where: { id: rutaId },
      select: { id: true },
    });
    return ruta !== null;
  }

  async buscarVigente(
    rutaId: string,
    ahora: Date,
  ): Promise<PermisoCargaSinLiquidar | null> {
    const row = await this.prisma.permisoCargaSinLiquidar.findFirst({
      where: { rutaId, usado: false, fechaExpiracion: { gt: ahora } },
      orderBy: { fechaOtorgado: 'asc' },
    });
    return row === null ? null : this.aPermiso(row);
  }

  async crear(datos: DatosCrearPermiso): Promise<PermisoCargaSinLiquidar> {
    const row = await this.prisma.permisoCargaSinLiquidar.create({
      data: datos,
    });
    return this.aPermiso(row);
  }

  async listarVigentes(ahora: Date): Promise<PermisoVigenteDetallado[]> {
    const rows = await this.prisma.permisoCargaSinLiquidar.findMany({
      where: { usado: false, fechaExpiracion: { gt: ahora } },
      include: {
        ruta: { select: { nombre: true } },
        otorgadoPor: { select: { nombreCompleto: true } },
      },
      orderBy: { fechaExpiracion: 'asc' },
    });
    return rows.map((row) => ({
      ...this.aPermiso(row),
      rutaNombre: row.ruta.nombre,
      otorgadoPorNombre: row.otorgadoPor.nombreCompleto,
    }));
  }

  private aPermiso(row: PermisoRow): PermisoCargaSinLiquidar {
    return {
      id: row.id,
      rutaId: row.rutaId,
      otorgadoPorId: row.otorgadoPorId,
      motivo: row.motivo,
      fechaOtorgado: row.fechaOtorgado,
      fechaExpiracion: row.fechaExpiracion,
      usado: row.usado,
      eventoCargaId: row.eventoCargaId,
    };
  }
}
