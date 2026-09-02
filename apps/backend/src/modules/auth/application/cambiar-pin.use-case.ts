import { esPinValido } from '../domain/politica-acceso';
import { UsuarioRepository } from './usuario.repository';
import { HasherPort } from './hasher.port';

/**
 * Resultado del cambio de PIN como union discriminada por `exito` (RF-08).
 */
export type ResultadoCambioPin =
  | { exito: true }
  | {
      exito: false;
      motivo:
        | 'PIN_ACTUAL_INCORRECTO'
        | 'PIN_NUEVO_MAL_FORMADO'
        | 'PIN_NUEVO_IGUAL_AL_ACTUAL'
        | 'USUARIO_NO_ENCONTRADO';
    };

/**
 * Caso de uso de cambio de PIN (RF-08).
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, argon2, NestJS).
 */
export class CambiarPinUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hasher: HasherPort,
  ) {}

  async ejecutar(
    usuarioAppId: string,
    pinActual: string,
    pinNuevo: string,
  ): Promise<ResultadoCambioPin> {
    // 1. PIN nuevo mal formado: se rechaza sin tocar la base.
    if (!esPinValido(pinNuevo)) {
      return { exito: false, motivo: 'PIN_NUEVO_MAL_FORMADO' };
    }

    // 2. PIN nuevo igual al actual: evita que un usuario "cambie" su PIN
    //    temporal por el mismo y burle el RF-08.
    if (pinNuevo === pinActual) {
      return { exito: false, motivo: 'PIN_NUEVO_IGUAL_AL_ACTUAL' };
    }

    // 3. Usuario inexistente.
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    // 4. PIN actual incorrecto: no se persiste ningun cambio.
    const pinActualCorrecto = await this.hasher.verificar(
      usuario.pinHash,
      pinActual,
    );
    if (!pinActualCorrecto) {
      return { exito: false, motivo: 'PIN_ACTUAL_INCORRECTO' };
    }

    // 5. Cambio valido: se hashea el PIN nuevo y se persiste. `actualizarPin`
    //    ya pone `debeCambiarPin` en false y actualiza `fechaUltimoCambioPin`.
    const pinNuevoHash = await this.hasher.hash(pinNuevo);
    await this.usuarios.actualizarPin(usuario.id, pinNuevoHash);

    return { exito: true };
  }
}
