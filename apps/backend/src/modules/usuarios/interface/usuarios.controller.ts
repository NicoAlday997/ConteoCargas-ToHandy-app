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
import type { RechazoCuentaHandyYaAsignada } from '../application/cuenta-handy-libre';
import { DesbloquearUsuarioUseCase } from '../application/desbloquear-usuario.use-case';
import { EditarUsuarioUseCase } from '../application/editar-usuario.use-case';
import { RestablecerPinUseCase } from '../application/restablecer-pin.use-case';
import { vistaUsuarioAdmin } from '../application/vista-usuario-admin';
import {
  CrearUsuarioSchema,
  EditarUsuarioSchema,
  IdUsuarioSchema,
  type CrearUsuarioDto,
  type EditarUsuarioDto,
} from './usuarios.dto';

const MENSAJE_USUARIO_NO_ENCONTRADO = 'Usuario no encontrado';

/**
 * 409 cuando la cuenta de Handy ya la tiene otro usuario activo: dice a quien,
 * para que el supervisor sepa a quien desactivar primero.
 */
function cuentaHandyYaAsignada(
  rechazo: RechazoCuentaHandyYaAsignada,
): ConflictException {
  const cuenta = rechazo.cuentaHandy.nombre ?? `#${rechazo.cuentaHandy.id}`;
  return new ConflictException({
    statusCode: 409,
    codigo: rechazo.motivo,
    mensaje: `La cuenta de Handy de ${cuenta} ya está asignada a ${rechazo.asignadaA.nombreCompleto}. Desactiva a esa persona primero.`,
    asignadaA: rechazo.asignadaA,
  });
}

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
    private readonly desbloquearUsuarioUseCase: DesbloquearUsuarioUseCase,
  ) {}

  /**
   * Lista completa, incluidos los inactivos (RF-11). Nunca expone `pinHash`.
   * Cada usuario trae `bloqueo` (`null` o `{ desde, hasta }`) para que el
   * panel muestre quien esta bloqueado ahora mismo.
   */
  @Get()
  async listar() {
    const ahora = new Date();
    const usuarios = await this.adminUsuarioRepository.listarTodos();
    return usuarios.map((u) => vistaUsuarioAdmin(u, ahora));
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
        case 'CUENTA_HANDY_YA_ASIGNADA':
          throw cuentaHandyYaAsignada(resultado);
      }
    }

    return {
      usuario: vistaUsuarioAdmin(resultado.usuario, new Date()),
      pinTemporal: resultado.pinTemporal,
    };
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
            codigo: 'ULTIMO_SUPERVISOR',
            mensaje:
              'Es la única persona activa con rol de supervisor: sin ella nadie podría autorizar cargas ni administrar personas. Da de alta o asigna otro supervisor antes de continuar.',
          });
        case 'CUENTA_HANDY_YA_ASIGNADA':
          throw cuentaHandyYaAsignada(resultado);
      }
    }

    // Convencion docs/04 §1.7: toda mutacion devuelve el recurso completo.
    return vistaUsuarioAdmin(resultado.usuario, new Date());
  }

  /**
   * Quita al instante el bloqueo por intentos fallidos (RF-03) y deja traza
   * de quien y cuando. `desbloqueadoPor` sale del JWT, nunca del body.
   */
  @Post(':id/desbloquear')
  @HttpCode(200)
  async desbloquear(
    @Param('id', new ZodValidationPipe(IdUsuarioSchema)) id: string,
    @UsuarioActual() admin: UsuarioAutenticado,
  ) {
    const ahora = new Date();
    const resultado = await this.desbloquearUsuarioUseCase.ejecutar(
      id,
      admin.usuarioAppId,
      ahora,
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'USUARIO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
          });
        case 'AUTODESBLOQUEO_PROHIBIDO':
          throw new BadRequestException({
            statusCode: 400,
            codigo: resultado.motivo,
            mensaje:
              'No puedes quitarte tu propio bloqueo. Lo tiene que hacer otro supervisor; si no hay ninguno disponible, sigue el procedimiento de recuperación de acceso.',
          });
        case 'NO_BLOQUEADO':
          throw new ConflictException({
            statusCode: 409,
            codigo: resultado.motivo,
            mensaje: 'Esta persona ya no está bloqueada.',
          });
      }
    }

    return vistaUsuarioAdmin(resultado.usuario, ahora);
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
    const resultado = await this.restablecerPinUseCase.ejecutar(id, {
      origen: 'SUPERVISOR',
      restablecidoPor: admin.usuarioAppId,
    });

    if (!resultado.exito) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: MENSAJE_USUARIO_NO_ENCONTRADO,
      });
    }

    return { pinTemporal: resultado.pinTemporal };
  }
}
