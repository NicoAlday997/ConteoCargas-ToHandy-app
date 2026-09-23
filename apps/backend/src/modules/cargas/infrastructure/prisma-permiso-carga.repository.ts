import { Injectable } from '@nestjs/common';
import type { PermisoCargaSinLiquidar as PermisoRow } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  PermisoCargaRepository,
  type DatosCrearPermiso,
  type PermisoCargaSinLiquidar,
  type PermisoVigenteDetallado,
  type RutaParaPermiso,
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

  async listarNoVencidos(ahora: Date): Promise<PermisoVigenteDetallado[]> {
    const rows = await this.prisma.permisoCargaSinLiquidar.findMany({
      where: { fechaExpiracion: { gt: ahora } },
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

  async listarRutasActivas(): Promise<RutaParaPermiso[]> {
    const rows = await this.prisma.ruta.findMany({
      where: { activa: true },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        asignaciones: {
          where: { vigenteHasta: null },
          orderBy: { vigenteDesde: 'desc' },
          take: 1,
          select: { usuarioApp: { select: { nombreCompleto: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      codigo: row.codigo,
      vendedorNombre: row.asignaciones[0]?.usuarioApp.nombreCompleto ?? null,
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
