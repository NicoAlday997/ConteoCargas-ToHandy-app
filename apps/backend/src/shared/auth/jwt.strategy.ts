import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { RolApp } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Contenido que transporta el JWT. Lo firma `AuthController.login` y lo
 * verifica esta strategy en cada request protegido.
 */
export interface JwtPayload {
  sub: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
}

/**
 * Forma del objeto que queda disponible en `request.user` tras validar el
 * token. Es lo que consumen `RolesGuard` y el decorador `UsuarioActual`.
 */
export interface UsuarioAutenticado {
  usuarioAppId: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
}

/**
 * Valida el `Authorization: Bearer {JWT}` de cada endpoint protegido (todos
 * salvo el login, ver `docs/04-api-interna.md`). Passport llama a `validate`
 * solo si la firma y la expiracion son correctas.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): UsuarioAutenticado {
    return {
      usuarioAppId: payload.sub,
      rolApp: payload.rolApp,
      usuarioHandyId: payload.usuarioHandyId,
    };
  }
}
