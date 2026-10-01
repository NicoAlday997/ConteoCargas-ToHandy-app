import type { RolApp } from '@prisma/client';

import {
  puedeCambiarRol,
  puedeDesactivar,
  type MotivoRechazoPolitica,
} from '../domain/politica-supervisores';
import {
  AdminUsuarioRepository,
  SinSupervisorActivoError,
  type UsuarioAdmin,
} from './admin-usuario.repository';
import {
  escribirOCuentaOcupada,
  rechazoSiCuentaHandyOcupada,
  type RechazoCuentaHandyYaAsignada,
} from './cuenta-handy-libre';

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
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' | MotivoRechazoPolitica }
  | RechazoCuentaHandyYaAsignada;

/**
 * Caso de uso que maneja el PATCH completo de un usuario del panel de
 * administracion: campos simples, alta/baja y cambio de rol. Antes de tocar
 * `activo = false` o `rolApp` aplica las politicas de `politica-supervisores`:
 * nadie se desactiva ni se cambia el rol a si mismo, y ninguna accion puede
 * dejar el sistema sin un supervisor activo. Si el PATCH vincula una cuenta
 * de Handy o REACTIVA a alguien que tiene una, verifica que ningun otro
 * usuario activo la tenga ya (una cuenta de Handy, un solo usuario activo).
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
    const tocaCambioDeRol =
      rolNuevo !== undefined && rolNuevo !== existente.rolApp;

    // El conteo de supervisores activos solo hace falta cuando el objetivo ES
    // supervisor Y el PATCH realmente toca `activo` o `rolApp`: ninguna de las
    // dos politicas puede rechazar por ULTIMO_SUPERVISOR en ningun otro caso.
    // Se consulta como maximo una vez por ejecucion.
    const necesitaConteo =
      existente.rolApp === 'SUPERVISOR' &&
      (tocaDesactivacion || tocaCambioDeRol);
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

    // Como quedaria tras el PATCH: solo choca si queda ACTIVO y CON cuenta, y
    // solo se revisa si el PATCH toca alguno de los dos (vincular una cuenta o
    // reactivar a alguien cuya cuenta ya paso a otro).
    const cuentaFinal =
      datos.usuarioHandyId !== undefined
        ? datos.usuarioHandyId
        : existente.usuarioHandyId;
    const activoFinal = datos.activo ?? existente.activo;
    const tocaCuentaOActivo =
      datos.usuarioHandyId !== undefined || datos.activo !== undefined;
    if (tocaCuentaOActivo && activoFinal && cuentaFinal !== null) {
      const rechazo = await rechazoSiCuentaHandyOcupada(
        this.usuarios,
        cuentaFinal,
        id,
      );
      if (rechazo !== null) return rechazo;
    }

    // Lo de arriba da el mensaje; la garantia es `actualizar`, que revisa el
    // estado DESPUES del cambio en la misma transaccion (dos supervisores
    // desactivandose el uno al otro a la vez pasarian los dos la validacion).
    try {
      const actualizado = await escribirOCuentaOcupada(
        this.usuarios,
        cuentaFinal,
        id,
        () => this.usuarios.actualizar(id, datos),
      );
      if ('motivo' in actualizado) return actualizado;
      return { exito: true, usuario: actualizado };
    } catch (error) {
      if (error instanceof SinSupervisorActivoError) {
        return { exito: false, motivo: 'ULTIMO_SUPERVISOR' };
      }
      throw error;
    }
  }
}
