import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AsignacionRepository,
  type AsignacionVigente,
} from '../application/asignacion.repository';

/**
 * Adaptador Prisma del puerto `AsignacionRepository`. Aqui SI se conoce el
 * esquema (`AsignacionRutaVendedor`); la capa de aplicacion solo ve el puerto.
 *
 * "Vigente" = el registro cuyo `vigenteHasta` es `null`. Al reasignar una ruta
 * se cierra el anterior y se abre uno nuevo, asi que hay como maximo uno abierto
 * por vendedor.
 */
@Injectable()
export class PrismaAsignacionRepository extends AsignacionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarAsignacionVigente(
    usuarioAppId: string,
  ): Promise<AsignacionVigente | null> {
    return this.prisma.asignacionRutaVendedor.findFirst({
      where: { usuarioAppId, vigenteHasta: null },
      select: { rutaId: true, plantillaId: true },
    });
  }
}
