import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { RolApp } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Contenido que viaja dentro del JWT firmado en `POST /auth/login`.
 * `sub` es el id del usuario de la app (no del usuario de Handy).
 */
export interface JwtPayload {
  sub: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
}

/**
 * Identidad ya validada que queda disponible en `request.user` para el resto
 * de la request. La app nunca decide localmente que puede hacer: el backend
 * lee de aqui el rol y el `usuarioHandyId` en cada endpoint.
 */
export interface UsuarioAutenticado {
  usuarioAppId: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // El token llega como `Authorization: Bearer <jwt>` (docs/04).
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Passport ya verifico firma y expiracion antes de llamar aqui. Lo que se
   * devuelve es exactamente lo que quedara en `request.user`.
   */
  validate(payload: JwtPayload): UsuarioAutenticado {
    return {
      usuarioAppId: payload.sub,
      rolApp: payload.rolApp,
      usuarioHandyId: payload.usuarioHandyId,
    };
  }
}
