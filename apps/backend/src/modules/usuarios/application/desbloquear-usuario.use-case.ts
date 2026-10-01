import { bloqueoVigente } from '../domain/bloqueo-vigente';
import {
  AdminUsuarioRepository,
  type UsuarioAdmin,
} from './admin-usuario.repository';

/**
 * - `USUARIO_NO_ENCONTRADO`: el id no existe.
 * - `AUTODESBLOQUEO_PROHIBIDO`: quien llama es el mismo usuario. Un supervisor
 *   bloqueado no puede entrar a desbloquearse, asi que permitirlo no serviria
 *   de nada: hace falta otro supervisor o el procedimiento de emergencia.
 * - `NO_BLOQUEADO`: no tiene un bloqueo vigente (nunca lo tuvo o ya vencio
 *   mientras el supervisor tenia la pantalla abierta). No se escribe nada.
 */
export type ResultadoDesbloquearUsuario =
  | { exito: true; usuario: UsuarioAdmin }
  | {
      exito: false;
      motivo:
        'USUARIO_NO_ENCONTRADO' | 'AUTODESBLOQUEO_PROHIBIDO' | 'NO_BLOQUEADO';
    };

/**
 * Un supervisor quita al instante el bloqueo por intentos fallidos (RF-03):
 * `intentosFallidos = 0` y `bloqueadoHasta = null`, y queda la traza de quien
 * desbloqueo a quien y cuando. No toca el PIN: si la persona no lo recuerda,
 * lo que corresponde es restablecerlo (que tambien quita el bloqueo).
 *
 * `desbloqueadoPor` SIEMPRE sale del JWT, nunca del body. Capa de aplicacion:
 * solo depende del dominio y del puerto.
 */
export class DesbloquearUsuarioUseCase {
  constructor(private readonly usuarios: AdminUsuarioRepository) {}

  async ejecutar(
    usuarioAppId: string,
    desbloqueadoPor: string,
    ahora: Date,
  ): Promise<ResultadoDesbloquearUsuario> {
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }
    if (usuarioAppId === desbloqueadoPor) {
      return { exito: false, motivo: 'AUTODESBLOQUEO_PROHIBIDO' };
    }
    const bloqueo = bloqueoVigente(usuario.bloqueadoHasta, ahora);
    if (bloqueo === null) {
      return { exito: false, motivo: 'NO_BLOQUEADO' };
    }

    const actualizado = await this.usuarios.actualizar(usuarioAppId, {
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    await this.usuarios.registrarDesbloqueo({
      usuarioAppId,
      desbloqueadoPor,
      bloqueadoHasta: bloqueo.hasta,
    });

    return { exito: true, usuario: actualizado };
  }
}
