import type { RolApp } from '@prisma/client';

import {
  puedeIntentarLogin,
  registrarIntentoFallido,
  registrarIntentoExitoso,
  esPinValido,
  type EstadoAcceso,
} from '../domain/politica-acceso';
import { UsuarioRepository } from './usuario.repository';
import { HasherPort } from './hasher.port';

/**
 * Resultado del login como union discriminada por `exito`.
 * En caso de fallo, `CREDENCIALES_INVALIDAS` y `PIN_MAL_FORMADO` comparten
 * mensaje hacia el cliente para no revelar que IDs de usuario existen.
 */
export type ResultadoLogin =
  | {
      exito: true;
      usuarioAppId: string;
      nombreCompleto: string;
      rolApp: RolApp;
      usuarioHandyId: number | null;
      debeCambiarPin: boolean;
    }
  | {
      exito: false;
      motivo: 'CREDENCIALES_INVALIDAS' | 'BLOQUEADO' | 'PIN_MAL_FORMADO';
    };

/**
 * Caso de uso de autenticacion por PIN (RF-02).
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, argon2, NestJS).
 */
export class LoginUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hasher: HasherPort,
  ) {}

  async ejecutar(
    usuarioAppId: string,
    pin: string,
    ahora: Date,
  ): Promise<ResultadoLogin> {
    // 1. PIN mal formado: se rechaza sin tocar la base.
    if (!esPinValido(pin)) {
      return { exito: false, motivo: 'PIN_MAL_FORMADO' };
    }

    // 2. Usuario inexistente: mismo mensaje que un PIN incorrecto.
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'CREDENCIALES_INVALIDAS' };
    }

    // 3. Bloqueo antes de verificar el hash: argon2 es costoso a proposito
    //    y no queremos que un atacante agote el servidor con intentos.
    const estado: EstadoAcceso = {
      activo: usuario.activo,
      intentosFallidos: usuario.intentosFallidos,
      bloqueadoHasta: usuario.bloqueadoHasta,
    };
    if (!puedeIntentarLogin(estado, ahora)) {
      return { exito: false, motivo: 'BLOQUEADO' };
    }

    // 4. PIN incorrecto: se registra el intento fallido y se persiste.
    const pinCorrecto = await this.hasher.verificar(usuario.pinHash, pin);
    if (!pinCorrecto) {
      const nuevoEstado = registrarIntentoFallido(estado, ahora);
      await this.usuarios.actualizarEstadoAcceso(usuario.id, {
        intentosFallidos: nuevoEstado.intentosFallidos,
        bloqueadoHasta: nuevoEstado.bloqueadoHasta,
      });
      return { exito: false, motivo: 'CREDENCIALES_INVALIDAS' };
    }

    // 5. PIN correcto: se limpia el contador de intentos y se persiste.
    const estadoLimpio = registrarIntentoExitoso(estado);
    await this.usuarios.actualizarEstadoAcceso(usuario.id, {
      intentosFallidos: estadoLimpio.intentosFallidos,
      bloqueadoHasta: estadoLimpio.bloqueadoHasta,
    });

    return {
      exito: true,
      usuarioAppId: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      rolApp: usuario.rolApp,
      usuarioHandyId: usuario.usuarioHandyId,
      debeCambiarPin: usuario.debeCambiarPin,
    };
  }
}
