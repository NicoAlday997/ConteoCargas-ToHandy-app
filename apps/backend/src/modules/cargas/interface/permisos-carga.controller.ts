import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
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
import { ListarPermisosVigentesUseCase } from '../application/listar-permisos-vigentes.use-case';
import { ListarRutasParaPermisoUseCase } from '../application/listar-rutas-para-permiso.use-case';
import { OtorgarPermisoCargaUseCase } from '../application/otorgar-permiso-carga.use-case';
import {
  OtorgarPermisoCargaSchema,
  type OtorgarPermisoCargaDto,
} from './cargas.dto';

/**
 * Permisos del supervisor para que una ruta inicie su carga INICIAL con la
 * ruta anterior del vendedor sin liquidar en Handy (24 h, un solo uso).
 * Exclusivo del rol SUPERVISOR: los guards se aplican a nivel de clase.
 */
@Controller('admin/permisos-carga')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class PermisosCargaController {
  constructor(
    private readonly otorgarPermisoCargaUseCase: OtorgarPermisoCargaUseCase,
    private readonly listarPermisosVigentesUseCase: ListarPermisosVigentesUseCase,
    private readonly listarRutasParaPermisoUseCase: ListarRutasParaPermisoUseCase,
  ) {}

  /** Otorga el permiso. `otorgadoPorId` sale del JWT, nunca del body. */
  @Post()
  async otorgar(
    @UsuarioActual() supervisor: UsuarioAutenticado,
    @Body(new ZodValidationPipe(OtorgarPermisoCargaSchema))
    dto: OtorgarPermisoCargaDto,
  ) {
    const resultado = await this.otorgarPermisoCargaUseCase.ejecutar(
      {
        rutaId: dto.rutaId,
        motivo: dto.motivo,
        usuarioAppId: supervisor.usuarioAppId,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'MOTIVO_INVALIDO':
          // El DTO ya lo valida; queda por si el caso de uso se invoca distinto.
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'El motivo debe explicar por que se permite cargar sin liquidar.',
          });
        case 'RUTA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'La ruta no existe.',
          });
        case 'YA_EXISTE_PERMISO_VIGENTE':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'YA_EXISTE_PERMISO_VIGENTE',
            mensaje:
              'Esta ruta ya tiene un permiso vigente sin usar. Se puede otorgar otro cuando se use o venza.',
            permisoId: resultado.permisoId,
          });
      }
    }

    return { permiso: resultado.permiso };
  }

  /** Permisos que no han vencido, usados o no (`usado`, `eventoCargaId`). */
  @Get()
  async listarVigentes() {
    return {
      permisos: await this.listarPermisosVigentesUseCase.ejecutar(new Date()),
    };
  }

  /** Rutas activas con su vendedor asignado, para elegir al otorgar. */
  @Get('rutas')
  async listarRutas() {
    return { rutas: await this.listarRutasParaPermisoUseCase.ejecutar() };
  }
}
