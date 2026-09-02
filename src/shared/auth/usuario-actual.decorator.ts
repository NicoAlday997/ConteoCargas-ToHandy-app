import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { UsuarioAutenticado } from './jwt.strategy';

/**
 * Inyecta en el handler la identidad ya validada (`request.user`) que dejo
 * `JwtStrategy`. Usar esto en vez de leer el body para saber quien actua.
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: UsuarioAutenticado }>();
    return request.user;
  },
);
