import type { RolApp } from '@prisma/client';

import {
  puedeCambiarRol,
  puedeDesactivar,
  type MotivoRechazoPolitica,
} from '../domain/politica-supervisores';
import {
  AdminUsuarioRepository,
  type UsuarioAdmin,
} from './admin-usuario.repository';

/**
 * Campos que el PATCH `/admin/usuarios/:id` puede tocar (RF-05, RF-11).
 * `pinHash` y `debeCambiarPin` quedan fuera: esos los manejan el alta y el
 * restablecimiento de PIN, no la edicion.
 */
export interface DatosEditarUsuario {
  nombreCompleto?: string;
  rolApp?: RolApp;
  usuarioHandyId?: number | null;
  activo?: boolean;
}

export type ResultadoEditarUsuario =
  | { exito: true; usuario: UsuarioAdmin }
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' | MotivoRechazoPolitica };

/**
 * Caso de uso que maneja el PATCH completo de un usuario del panel de
 * administracion: campos simples, alta/baja y cambio de rol. Antes de tocar
 * `activo = false` o `rolApp` aplica las politicas de `politica-supervisores`:
 * nadie se desactiva ni se cambia el rol a si mismo, y ninguna accion puede
 * dejar el sistema sin un supervisor activo.
 *
 * `actorId` SIEMPRE sale del usuario autenticado (JWT), nunca del body: si
 * viajara en el body cualquiera podria suplantar a otro admin para saltarse
 * la politica.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class EditarUsuarioUseCase {
  constructor(private readonly usuarios: AdminUsuarioRepository) {}

  async ejecutar(
    id: string,
    actorId: string,
    datos: DatosEditarUsuario,
  ): Promise<ResultadoEditarUsuario> {
    const existente = await this.usuarios.buscarPorId(id);
    if (existente === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    const rolNuevo = datos.rolApp;
    const tocaDesactivacion = datos.activo === false;
    const tocaCambioDeRol = rolNuevo !== undefined && rolNuevo !== existente.rolApp;

    // El conteo de supervisores activos solo hace falta cuando el objetivo ES
    // supervisor Y el PATCH realmente toca `activo` o `rolApp`: ninguna de las
    // dos politicas puede rechazar por ULTIMO_SUPERVISOR en ningun otro caso.
    // Se consulta como maximo una vez por ejecucion.
    const necesitaConteo =
      existente.rolApp === 'SUPERVISOR' && (tocaDesactivacion || tocaCambioDeRol);
    const total = necesitaConteo
      ? await this.usuarios.contarSupervisoresActivos()
      : 0;

    if (tocaDesactivacion) {
      const resultado = puedeDesactivar(actorId, existente, total);
      if (!resultado.permitido) {
        return { exito: false, motivo: resultado.motivo };
      }
    }

    if (tocaCambioDeRol) {
      const resultado = puedeCambiarRol(actorId, existente, rolNuevo, total);
      if (!resultado.permitido) {
        return { exito: false, motivo: resultado.motivo };
      }
    }

    const actualizado = await this.usuarios.actualizar(id, datos);
    return { exito: true, usuario: actualizado };
  }
}
