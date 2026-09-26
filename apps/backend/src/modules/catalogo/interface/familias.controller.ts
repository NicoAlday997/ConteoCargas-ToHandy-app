import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { UsuarioAutenticado } from '../../../shared/auth/jwt.strategy';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import { AsignarColorFamiliaUseCase } from '../application/asignar-color-familia.use-case';
import { ListarFamiliasUseCase } from '../application/listar-familias.use-case';
import {
  AsignarColorFamiliaSchema,
  FamiliaParamSchema,
  type AsignarColorFamiliaDto,
} from './familias.dto';

const COLOR_INVALIDO = {
  statusCode: 400,
  codigo: 'COLOR_INVALIDO',
  mensaje: 'Ese color no esta en la paleta. Elige uno de la lista.',
};

/**
 * Colores de familia (docs/04): el supervisor le da a cada familia del
 * catalogo un color de la paleta cerrada para ubicarla mas rapido en el grid
 * de conteo. Guards a nivel de clase: JWT valido y rol SUPERVISOR.
 */
@Controller('admin/familias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class FamiliasController {
  constructor(
    private readonly listarFamiliasUseCase: ListarFamiliasUseCase,
    private readonly asignarColorUseCase: AsignarColorFamiliaUseCase,
  ) {}

  /** Familias del catalogo activo con su color (o `null`), por nombre. */
  @Get()
  async listar() {
    return this.listarFamiliasUseCase.ejecutar();
  }

  /** Asigna el color de la familia; `color: null` lo quita. */
  @Put(':familia/color')
  @HttpCode(200)
  async asignarColor(
    @Param('familia', new ZodValidationPipe(FamiliaParamSchema))
    familia: string,
    @Body(new ZodValidationPipe(AsignarColorFamiliaSchema))
    dto: AsignarColorFamiliaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.asignarColorUseCase.ejecutar({
      familia,
      color: dto.color,
      asignadoPorId: usuario.usuarioAppId,
    });
    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'COLOR_INVALIDO':
          throw new BadRequestException(COLOR_INVALIDO);
        case 'FAMILIA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            codigo: 'FAMILIA_NO_ENCONTRADA',
            mensaje:
              'Esa familia ya no esta en el catalogo. Actualiza la lista.',
          });
      }
    }
    return { familia: resultado.familia, color: resultado.color };
  }
}
