import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { UsuarioAutenticado } from '../../../shared/auth/jwt.strategy';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import { MOTIVO_MINIMO_SUPERVISOR } from '../application/cancelar-carga.use-case';
import { RecorrerCargasDeDiaUseCase } from '../application/recorrer-cargas-de-dia.use-case';
import { SinDiasHabilesError } from '../domain/calendario-laboral';
import { aRespuestaCargaDelDia } from './carga-del-dia.respuesta';
import { RecorrerCargasSchema, type RecorrerCargasDto } from './cargas.dto';

/**
 * Operaciones del supervisor sobre varias cargas a la vez (docs/04 §1.4.1).
 */
@Controller('admin/cargas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class AdminCargasController {
  constructor(
    private readonly recorrerCargasDeDia: RecorrerCargasDeDiaUseCase,
  ) {}

  /**
   * Recorre TODAS las cargas de un dia que no se trabajo a otro dia habil, en
   * una sola transaccion. Las ENVIADAS tambien se mueven: corrige nuestro
   * registro y la ruta en Handy no se toca. Si alguna ruta ya tiene carga
   * inicial en el destino no se mueve ninguna (409 CONFLICTO_EN_DESTINO).
   */
  @Post('recorrer')
  @HttpCode(200)
  async recorrer(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(RecorrerCargasSchema)) dto: RecorrerCargasDto,
  ) {
    let resultado;
    try {
      resultado = await this.recorrerCargasDeDia.ejecutar(
        {
          fechaOrigen: dto.fechaOrigen,
          fechaDestino: dto.fechaDestino,
          motivo: dto.motivo,
          usuarioAppId: usuario.usuarioAppId,
        },
        new Date(),
      );
    } catch (error) {
      if (error instanceof SinDiasHabilesError) {
        throw new ConflictException({
          statusCode: 409,
          codigo: 'SIN_DIAS_HABILES',
          mensaje:
            'No hay ningún día hábil en el próximo mes. Revisa los días no laborables.',
        });
      }
      throw error;
    }

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'MOTIVO_REQUERIDO':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'MOTIVO_REQUERIDO',
            mensaje: `Escribe por qué recorres las cargas (mínimo ${MOTIVO_MINIMO_SUPERVISOR} caracteres).`,
          });
        case 'FECHA_DESTINO_INVALIDA':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'FECHA_DESTINO_INVALIDA',
            mensaje:
              'El nuevo día tiene que ser posterior al día que no se trabajó, y no puede haber pasado.',
          });
        case 'FECHA_NO_DISPONIBLE':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'FECHA_NO_DISPONIBLE',
            mensaje: 'Ese día no se trabaja. Elige un día hábil.',
          });
        case 'CONFLICTO_EN_DESTINO': {
          const nombres = resultado.rutas.map((r) => r.rutaNombre).join(', ');
          throw new ConflictException({
            statusCode: 409,
            codigo: 'CONFLICTO_EN_DESTINO',
            mensaje: `${nombres} ya ${resultado.rutas.length === 1 ? 'tiene' : 'tienen'} una carga inicial ese día. Resuélvelo antes de recorrer las demás; no se movió ninguna.`,
            rutas: resultado.rutas,
          });
        }
      }
    }

    return {
      movidas: resultado.movidas,
      eventos: resultado.eventos.map(aRespuestaCargaDelDia),
    };
  }
}
