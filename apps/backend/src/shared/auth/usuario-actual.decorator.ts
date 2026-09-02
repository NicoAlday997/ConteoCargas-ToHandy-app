import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { UsuarioAutenticado } from './jwt.strategy';

/**
 * Inyecta el usuario autenticado (`request.user`, poblado por `JwtStrategy`)
 * en un parametro del handler. Usar solo en endpoints protegidos con
 * `JwtAuthGuard`; en un endpoint publico devolveria `undefined`.
 *
 * @example
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Post('cambiar-pin')
 * cambiarPin(@UsuarioActual() usuario: UsuarioAutenticado) { ... }
 * ```
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: UsuarioAutenticado }>();
    return request.user;
  },
);
