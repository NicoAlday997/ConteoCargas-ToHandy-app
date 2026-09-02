import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige un `Authorization: Bearer <jwt>` valido. Todos los endpoints salvo el
 * login se protegen con este guard (docs/04). Delega en `JwtStrategy` la
 * verificacion de firma y expiracion y el armado de `request.user`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
