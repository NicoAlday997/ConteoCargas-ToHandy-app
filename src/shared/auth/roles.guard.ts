import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolApp } from '@prisma/client';
import type { Request } from 'express';

import { ROLES_KEY } from './roles.decorator';
import type { UsuarioAutenticado } from './jwt.strategy';

/**
 * Autoriza por rol. Se ejecuta despues de `JwtAuthGuard`, por lo que asume que
 * `request.user` ya existe. Si el endpoint no declara `@Roles(...)`, no hay
 * restriccion de rol y se permite el paso.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolApp[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UsuarioAutenticado }>();
    const usuario = request.user;

    if (!usuario || !rolesRequeridos.includes(usuario.rolApp)) {
      throw new ForbiddenException({
        statusCode: 403,
        mensaje: 'No tienes permisos para realizar esta accion',
      });
    }

    return true;
  }
}
