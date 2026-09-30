import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AlertaRepository,
  type NuevaAlerta,
} from '../application/alerta.repository';

/** Adaptador Prisma de la tabla `alertas`: la alerta nace PENDIENTE. */
@Injectable()
export class PrismaAlertaRepository extends AlertaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async crear(alerta: NuevaAlerta): Promise<void> {
    await this.prisma.alerta.create({
      data: {
        tipo: alerta.tipo,
        urgencia: alerta.urgencia,
        mensaje: alerta.mensaje,
      },
    });
  }
}
