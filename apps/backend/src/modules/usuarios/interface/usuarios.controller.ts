import {
  BadRequestException,
  Body,
  ConflictException,
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
import { EditarUsuarioUseCase } from '../application/editar-usuario.use-case';
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
    private readonly editarUsuarioUseCase: EditarUsuarioUseCase,
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
   * Edicion de nombre, rol, vinculo con Handy (RF-05), alta/baja (RF-11). Todo
   * pasa por `EditarUsuarioUseCase`, que aplica las politicas de proteccion
   * del ultimo supervisor antes de tocar `activo` o `rolApp`: nadie se
   * desactiva ni se cambia el rol a si mismo, y ninguna accion puede dejar el
   * sistema sin un supervisor activo. `actorId` sale del JWT, nunca del body.
   */
  @Patch(':id')
  @HttpCode(200)
  async editar(
    @Param('id', new ZodValidationPipe(IdUsuarioSchema)) id: string,
    @Body(new ZodValidationPipe(EditarUsuarioSchema)) dto: EditarUsuarioDto,
    @UsuarioActual() admin: UsuarioAutenticado,
  ) {
    const resultado = await this.editarUsuarioUseCase.ejecutar(
      id,
      admin.usuarioAppId,
      dto,
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'USUARIO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
          });
        case 'AUTODESACTIVACION_PROHIBIDA':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'No puedes desactivar tu propia cuenta.',
          });
        case 'AUTOCAMBIO_ROL_PROHIBIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'No puedes cambiar tu propio rol.',
          });
        case 'ULTIMO_SUPERVISOR':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Esta accion dejaria el sistema sin ningun supervisor activo. Asigna el rol de supervisor a otra persona antes de continuar.',
          });
      }
    }

    // Convencion docs/04 §1.7: toda mutacion devuelve el recurso completo.
    return resultado.usuario;
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
