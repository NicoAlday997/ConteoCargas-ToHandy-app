import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
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
import {
  type DiaNoLaborable,
  DiaNoLaborableRepository,
} from '../application/dia-no-laborable.repository';
import {
  MarcarDiaNoLaborableUseCase,
  MOTIVO_MINIMO_DIA_NO_LABORABLE,
} from '../application/marcar-dia-no-laborable.use-case';
import { QuitarDiaNoLaborableUseCase } from '../application/quitar-dia-no-laborable.use-case';
import { RecorrerCargasDeDiaUseCase } from '../application/recorrer-cargas-de-dia.use-case';
import { diaTexto } from '../domain/calendario-laboral';
import { normalizarFechaOperativa } from '../domain/fecha-operativa';
import {
  DiaParamSchema,
  ListarDiasNoLaborablesQuerySchema,
  MarcarDiaNoLaborableSchema,
  type ListarDiasNoLaborablesQueryDto,
  type MarcarDiaNoLaborableDto,
} from './cargas.dto';
import { aRespuestaCargaDelDia } from './carga-del-dia.respuesta';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Sin `hasta`, la lista cubre un año. */
const DIAS_LISTA_POR_DEFECTO = 366;

/** Lo que ve la app: el dia como `aaaa-mm-dd`, no como instante. */
function aRespuesta(dia: DiaNoLaborable) {
  return {
    fecha: diaTexto(dia.fecha),
    motivo: dia.motivo,
    creadoPorNombre: dia.creadoPorNombre,
    creadoEn: dia.creadoEn,
  };
}

/**
 * Dias que no se trabajan: festivos, paros, clima, cierres (docs/04 §1.2.3
 * y docs/01 §6 regla 9). Los domingos no se guardan aqui: ya salen de la
 * semana laboral (`DIAS_HABILES_SEMANA`). Toda la seccion es del SUPERVISOR.
 */
@Controller('admin/dias-no-laborables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class DiasNoLaborablesController {
  constructor(
    private readonly diasNoLaborables: DiaNoLaborableRepository,
    private readonly marcarDiaNoLaborableUseCase: MarcarDiaNoLaborableUseCase,
    private readonly quitarDiaNoLaborableUseCase: QuitarDiaNoLaborableUseCase,
    private readonly recorrerCargasDeDia: RecorrerCargasDeDiaUseCase,
  ) {}

  /** Dias marcados entre `desde` (por defecto hoy) y `hasta`, en orden. */
  @Get()
  async listar(
    @Query(new ZodValidationPipe(ListarDiasNoLaborablesQuerySchema))
    query: ListarDiasNoLaborablesQueryDto,
  ) {
    const desde = query.desde ?? normalizarFechaOperativa(new Date());
    const hasta =
      query.hasta ?? new Date(desde.getTime() + DIAS_LISTA_POR_DEFECTO * MS_POR_DIA);
    const dias = await this.diasNoLaborables.listarEntre(desde, hasta);
    return { dias: dias.map(aRespuesta) };
  }

  /**
   * Previsualizacion antes de recorrer las cargas de ese dia: las que se
   * moverian (ENVIADAS incluidas), las que se quedan (CANCELADA,
   * ENVIO_INCIERTO) y el siguiente dia habil como destino sugerido. Sirve
   * tambien para un dia que no esta marcado.
   */
  @Get(':fecha/cargas')
  async cargasDelDia(
    @Param('fecha', new ZodValidationPipe(DiaParamSchema)) fecha: Date,
  ) {
    const vista = await this.recorrerCargasDeDia.previsualizar(fecha, new Date());
    return {
      fecha: diaTexto(fecha),
      cargas: vista.cargas.map(aRespuestaCargaDelDia),
      excluidas: vista.excluidas.map(aRespuestaCargaDelDia),
      destinoSugerido:
        vista.destinoSugerido === null ? null : diaTexto(vista.destinoSugerido),
    };
  }

  @Post()
  @HttpCode(201)
  async marcar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(MarcarDiaNoLaborableSchema))
    dto: MarcarDiaNoLaborableDto,
  ) {
    const resultado = await this.marcarDiaNoLaborableUseCase.ejecutar(
      { fecha: dto.fecha, motivo: dto.motivo, usuarioAppId: usuario.usuarioAppId },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'FECHA_PASADA':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'FECHA_PASADA',
            mensaje: 'Ese día ya pasó. Solo se marcan días de hoy en adelante.',
          });
        case 'NO_SE_TRABAJA_POR_SEMANA':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'DOMINGO',
            mensaje: 'Los domingos ya están considerados: no hace falta marcarlos.',
          });
        case 'MOTIVO_REQUERIDO':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'MOTIVO_REQUERIDO',
            mensaje: `Escribe el motivo (mínimo ${MOTIVO_MINIMO_DIA_NO_LABORABLE} caracteres).`,
          });
        case 'YA_MARCADO':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'YA_MARCADO',
            mensaje: 'Ese día ya está marcado como no laborable.',
          });
      }
    }

    return { dia: aRespuesta(resultado.dia) };
  }

  @Delete(':fecha')
  @HttpCode(200)
  async quitar(
    @Param('fecha', new ZodValidationPipe(DiaParamSchema)) fecha: Date,
  ) {
    const resultado = await this.quitarDiaNoLaborableUseCase.ejecutar(
      fecha,
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'FECHA_PASADA':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'FECHA_PASADA',
            mensaje: 'Ese día ya pasó: se queda en el registro.',
          });
        case 'NO_MARCADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'Ese día no estaba marcado como no laborable.',
          });
      }
    }

    return { fecha: diaTexto(fecha) };
  }
}
