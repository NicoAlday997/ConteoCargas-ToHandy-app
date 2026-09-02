import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { HasherPort } from '../application/hasher.port';

/**
 * Adaptador de infraestructura del puerto de hasheo.
 * Aqui SI se conoce el detalle tecnico: se usa argon2 con la variante argon2id
 * (recomendada por OWASP para hasheo de contrasenas/PIN).
 */
@Injectable()
export class Argon2HasherAdapter extends HasherPort {
  async hash(valorPlano: string): Promise<string> {
    return argon2.hash(valorPlano, { type: argon2.argon2id });
  }

  async verificar(hash: string, valorPlano: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, valorPlano);
    } catch {
      // argon2.verify lanza si el hash almacenado esta corrupto o mal formado.
      // Un hash invalido en la BD no debe tumbar el login: se trata como PIN
      // incorrecto y el caso de uso registra el intento fallido.
      return false;
    }
  }
}
