import { HasherPort } from '../../auth/application/hasher.port';
import { generarPinTemporal } from '../domain/generar-pin-temporal';
import { AdminUsuarioRepository } from './admin-usuario.repository';

/**
 * Resultado del restablecimiento como union discriminada por `exito`.
 * En caso de exito se devuelve el PIN temporal EN CLARO para que el admin se lo
 * comunique al usuario (RF-09).
 */
export type ResultadoRestablecerPin =
  | { exito: true; pinTemporal: string }
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' };

/**
 * Caso de uso de restablecimiento de PIN (RF-09: solo administrativo, nunca
 * autoservicio). Capa de aplicacion: solo depende del dominio y de los puertos.
 */
export class RestablecerPinUseCase {
  constructor(
    private readonly usuarios: AdminUsuarioRepository,
    private readonly hasher: HasherPort,
  ) {}

  async ejecutar(
    usuarioAppId: string,
    restablecidoPor: string,
  ): Promise<ResultadoRestablecerPin> {
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    // PIN temporal nuevo: se genera, se hashea y se persiste solo el hash.
    const pinTemporal = generarPinTemporal();
    const pinHash = await this.hasher.hash(pinTemporal);

    // Se fuerza el cambio en el siguiente login (RF-08).
    await this.usuarios.actualizar(usuarioAppId, {
      pinHash,
      debeCambiarPin: true,
    });

    // Traza obligatoria: usuario afectado, quien lo ejecuto y cuando (RF-10).
    await this.usuarios.registrarRestablecimientoPin({
      usuarioAppId,
      restablecidoPor,
    });

    return { exito: true, pinTemporal };
  }
}
