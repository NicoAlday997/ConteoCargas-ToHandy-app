import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import { ConsultarHistorialUseCase } from '../application/consultar-historial.use-case';
import { VerCargaConsolidadaUseCase } from '../application/ver-carga-consolidada.use-case';
import {
  FiltrosHistorialSchema,
  IdSchema,
  type FiltrosHistorialDto,
} from './historial.dto';

/**
 * Capa HTTP del modulo de historial (docs/04-api-interna.md seccion 1.5;
 * RF-23, RF-24). Exclusivo del rol Supervisor (docs/06 seccion 2: es el unico
 * rol con acceso al historial completo y la auditoria).
 *
 * Ninguna carga se filtra por si "cuadro" o no (CLAUDE.md, docs/01 seccion 6
 * regla 4): `conDiscrepancia` es un filtro opcional mas, igual de auditable en
 * ambos casos.
 */
@Controller('historial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HistorialController {
  constructor(
    private readonly consultarHistorialUseCase: ConsultarHistorialUseCase,
    private readonly verCargaConsolidadaUseCase: VerCargaConsolidadaUseCase,
  ) {}

  /** Listado filtrable de cargas comparadas (RF-23). */
  @Get()
  @Roles(RolApp.SUPERVISOR)
  async listar(
    @Query(new ZodValidationPipe(FiltrosHistorialSchema))
    filtros: FiltrosHistorialDto,
  ) {
    return this.consultarHistorialUseCase.ejecutar(filtros);
  }

  /** Detalle completo de una carga, productos agrupados por familia (RF-23). */
  @Get(':id')
  @Roles(RolApp.SUPERVISOR)
  async detalle(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
  ) {
    const resultado = await this.verCargaConsolidadaUseCase.ejecutar(eventoId);

    if (!resultado.exito) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'La carga no existe.',
      });
    }

    return { evento: resultado.evento, familias: resultado.familias };
  }
}
