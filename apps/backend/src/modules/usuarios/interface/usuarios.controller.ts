import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
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
import { AdminUsuarioRepository } from '../application/admin-usuario.repository';
import { CrearUsuarioUseCase } from '../application/crear-usuario.use-case';
import { DesactivarUsuarioUseCase } from '../application/desactivar-usuario.use-case';
import { RestablecerPinUseCase } from '../application/restablecer-pin.use-case';
import {
  CrearUsuarioSchema,
  EditarUsuarioSchema,
  IdUsuarioSchema,
  type CrearUsuarioDto,
  type EditarUsuarioDto,
} from './usuarios.dto';

const MENSAJE_USUARIO_NO_ENCONTRADO = 'Usuario no encontrado';

/**
 * Administracion de usuarios (RF-05 .. RF-11). Toda la seccion es exclusiva del
 * rol Supervisor con permiso de administracion: los guards se aplican a nivel de
 * clase, asi que TODOS los endpoints exigen JWT valido y rol SUPERVISOR.
 */
@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class UsuariosController {
  constructor(
    private readonly adminUsuarioRepository: AdminUsuarioRepository,
    private readonly crearUsuarioUseCase: CrearUsuarioUseCase,
    private readonly restablecerPinUseCase: RestablecerPinUseCase,
    private readonly desactivarUsuarioUseCase: DesactivarUsuarioUseCase,
  ) {}

  /** Lista completa, incluidos los inactivos (RF-11). Nunca expone `pinHash`. */
  @Get()
  async listar() {
    return this.adminUsuarioRepository.listarTodos();
  }

  /**
   * Alta de usuario (RF-06 sin auto-registro, RF-07). Devuelve el usuario creado
   * y el `pinTemporal` en claro: el admin debe comunicarselo al usuario, que
   * sera forzado a cambiarlo en su primer login (RF-08).
   */
  @Post()
  async crear(
    @Body(new ZodValidationPipe(CrearUsuarioSchema)) dto: CrearUsuarioDto,
  ) {
    const resultado = await this.crearUsuarioUseCase.ejecutar({
      nombreCompleto: dto.nombreCompleto,
      rolApp: dto.rolApp,
      usuarioHandyId: dto.usuarioHandyId ?? null,
    });

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'VENDEDOR_REQUIERE_HANDY':
          throw new BadRequestException({
            statusCode: 400,
            mensaje: 'Un vendedor debe tener un usuario de Handy vinculado',
          });
        case 'NO_VENDEDOR_CON_HANDY':
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'Solo un vendedor puede tener un usuario de Handy vinculado',
          });
      }
    }

    return { usuario: resultado.usuario, pinTemporal: resultado.pinTemporal };
  }

  /**
   * Edicion de nombre, rol, vinculo con Handy (RF-05) o estado. La baja
   * (`activo: false`, RF-11) pasa siempre por su caso de uso, que garantiza que
   * el registro solo se marca inactivo y nunca se elimina.
   */
  @Patch(':id')
  @HttpCode(200)
  async editar(
    @Param('id', new ZodValidationPipe(IdUsuarioSchema)) id: string,
    @Body(new ZodValidationPipe(EditarUsuarioSchema)) dto: EditarUsuarioDto,
  ) {
    const existente = await this.adminUsuarioRepository.buscarPorId(id);
    if (existente === null) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
      });
    }

    const { activo, ...campos } = dto;

    // Campos simples y reactivacion (`activo: true`) van directo al repositorio.
    if (Object.keys(campos).length > 0 || activo === true) {
      await this.adminUsuarioRepository.actualizar(id, {
        ...campos,
        ...(activo === true ? { activo: true } : {}),
      });
    }

    // Baja: RF-11.
    if (activo === false) {
      const resultado = await this.desactivarUsuarioUseCase.ejecutar(id);
      if (!resultado.exito) {
        throw new NotFoundException({
          statusCode: 404,
          mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
        });
      }
      return resultado.usuario;
    }

    // Convencion docs/04 §1.7: toda mutacion devuelve el recurso completo.
    return this.adminUsuarioRepository.buscarPorId(id);
  }

  /**
   * Restablecimiento administrativo de PIN (RF-09). Devuelve el `pinTemporal`
   * nuevo en claro; marca `debeCambiarPin = true` y deja traza (RF-10). El
   * `restablecidoPor` sale del JWT, nunca del body.
   */
  @Post(':id/restablecer-pin')
  @HttpCode(200)
  async restablecerPin(
    @Param('id', new ZodValidationPipe(IdUsuarioSchema)) id: string,
    @UsuarioActual() admin: UsuarioAutenticado,
  ) {
    const resultado = await this.restablecerPinUseCase.ejecutar(
      id,
      admin.usuarioAppId,
    );

    if (!resultado.exito) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
      });
    }

    return { pinTemporal: resultado.pinTemporal };
  }
}
