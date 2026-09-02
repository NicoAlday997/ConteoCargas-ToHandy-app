import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolApp } from '@prisma/client';
import type { Request } from 'express';

import type { UsuarioAutenticado } from './jwt.strategy';
import { ROLES_KEY } from './roles.decorator';

/**
 * Compara el rol del usuario autenticado contra los roles declarados con
 * `@Roles(...)`. Se aplica siempre despues de `JwtAuthGuard`, que es quien
 * deja `request.user` disponible.
 *
 * Si el endpoint no declara roles, deja pasar: basta con estar autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<
      RolApp[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UsuarioAutenticado }>();
    const usuario = request.user;

    if (!usuario || !rolesRequeridos.includes(usuario.rolApp)) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        mensaje: 'No tienes permiso para realizar esta acción',
      });
    }

    return true;
  }
}
