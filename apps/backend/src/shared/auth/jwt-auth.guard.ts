import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige un JWT valido. Al fallar responde 401 automaticamente. Se aplica con
 * `@UseGuards(JwtAuthGuard)` en cada endpoint que no sea publico.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
