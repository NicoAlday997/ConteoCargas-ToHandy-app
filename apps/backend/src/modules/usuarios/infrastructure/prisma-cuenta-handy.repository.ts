import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  CuentaHandyRepository,
  type CuentaHandy,
} from '../application/cuenta-handy.repository';

/** Adaptador Prisma de `usuarios_handy` para la administracion de usuarios. */
@Injectable()
export class PrismaCuentaHandyRepository extends CuentaHandyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listar(): Promise<CuentaHandy[]> {
    const registros = await this.prisma.usuarioHandy.findMany({
      select: {
        idHandy: true,
        nombre: true,
        fotoUrl: true,
        activo: true,
        // Solo los usuarios activos ocupan la cuenta (ver `CuentaHandy.vinculadaA`).
        vendedores: {
          where: { activo: true },
          select: { id: true, nombreCompleto: true },
          orderBy: { creadoEn: 'asc' },
          take: 1,
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return registros.map((r) => ({
      idHandy: r.idHandy,
      nombre: r.nombre,
      fotoUrl: r.fotoUrl,
      activa: r.activo,
      vinculadaA: r.vendedores[0] ?? null,
    }));
  }
}
