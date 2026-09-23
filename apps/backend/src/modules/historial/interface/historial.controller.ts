import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { UsuarioAutenticado } from '../../../shared/auth/jwt.strategy';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
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
 * RF-23, RF-24). Abierto a los tres roles, con alcance distinto por rol
 * (`domain/politica-historial`): Vendedor solo sus cargas y Contador todas,
 * ambos 2 semanas atras; Supervisor todo. El alcance sale del JWT
 * (`@UsuarioActual`), nunca del query: ningun parametro lo amplia.
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

  /** Listado filtrable de cargas, por fecha operativa (RF-23). */
  @Get()
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(FiltrosHistorialSchema))
    filtros: FiltrosHistorialDto,
  ) {
    return this.consultarHistorialUseCase.ejecutar(
      { usuarioAppId: usuario.usuarioAppId, rolApp: usuario.rolApp },
      filtros,
      new Date(),
    );
  }

  /** Detalle completo de una carga, productos agrupados por familia (RF-23). */
  @Get(':id')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
  ) {
    const resultado = await this.verCargaConsolidadaUseCase.ejecutar(
      eventoId,
      { usuarioAppId: usuario.usuarioAppId, rolApp: usuario.rolApp },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'CARGA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'La carga no existe.',
          });
        case 'FUERA_DE_ALCANCE':
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'FUERA_DE_ALCANCE',
            mensaje: 'No tienes acceso a esta carga.',
          });
      }
    }

    return { evento: resultado.evento, familias: resultado.familias };
  }
}
