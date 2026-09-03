import {
  AdminUsuarioRepository,
  type UsuarioAdmin,
} from './admin-usuario.repository';

/**
 * Resultado de la baja como union discriminada por `exito`.
 */
export type ResultadoDesactivarUsuario =
  | { exito: true; usuario: UsuarioAdmin }
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' };

/**
 * Caso de uso de baja de usuario (RF-11). Marca `activo = false` y NUNCA borra
 * el registro: los conteos historicos de ese usuario deben seguir siendo
 * auditables. Capa de aplicacion: solo depende del puerto.
 */
export class DesactivarUsuarioUseCase {
  constructor(private readonly usuarios: AdminUsuarioRepository) {}

  async ejecutar(usuarioAppId: string): Promise<ResultadoDesactivarUsuario> {
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    const actualizado = await this.usuarios.actualizar(usuarioAppId, {
      activo: false,
    });

    return { exito: true, usuario: actualizado };
  }
}
