import {
  AdminUsuarioRepository,
  CuentaHandyYaAsignadaError,
} from './admin-usuario.repository';

/**
 * Rechazo cuando la cuenta de Handy ya la tiene otro usuario ACTIVO. Lleva los
 * dos nombres para que el mensaje diga a quien hay que desactivar primero.
 */
export interface RechazoCuentaHandyYaAsignada {
  exito: false;
  motivo: 'CUENTA_HANDY_YA_ASIGNADA';
  /** `nombre` es el de la cuenta en Handy; `null` si no esta en el cache. */
  cuentaHandy: { id: number; nombre: string | null };
  asignadaA: { id: string; nombreCompleto: string };
}

/**
 * Una cuenta de Handy, un solo usuario activo: cada cuenta es una ruta, y dos
 * usuarios activos con la misma podrian abrir cargas de la misma ruta. La
 * garantia real es el indice unico parcial de `usuarios_app` (ver la
 * migracion `cuenta_handy_unica_activa`); esto existe para responder con un
 * mensaje que diga a quien, en vez de un error de base de datos.
 *
 * Los usuarios INACTIVOS no ocupan la cuenta: cuando un vendedor se va, su
 * cuenta pasa a quien llega, y el viejo se queda con ella en su historial.
 */
export async function rechazoSiCuentaHandyOcupada(
  usuarios: AdminUsuarioRepository,
  usuarioHandyId: number,
  excluirId?: string,
): Promise<RechazoCuentaHandyYaAsignada | null> {
  const ocupante = await usuarios.buscarActivoConCuentaHandy(
    usuarioHandyId,
    excluirId,
  );
  if (ocupante === null) return null;
  return {
    exito: false,
    motivo: 'CUENTA_HANDY_YA_ASIGNADA',
    cuentaHandy: {
      id: usuarioHandyId,
      nombre: await usuarios.nombreCuentaHandy(usuarioHandyId),
    },
    asignadaA: { id: ocupante.id, nombreCompleto: ocupante.nombreCompleto },
  };
}

/**
 * Corre `escribir` y, si la base de datos lo rechaza por el indice unico
 * (otra peticion gano la carrera entre la validacion y la escritura),
 * devuelve el mismo rechazo que la validacion previa.
 */
export async function escribirOCuentaOcupada<T>(
  usuarios: AdminUsuarioRepository,
  usuarioHandyId: number | null,
  excluirId: string | undefined,
  escribir: () => Promise<T>,
): Promise<T | RechazoCuentaHandyYaAsignada> {
  try {
    return await escribir();
  } catch (error) {
    if (!(error instanceof CuentaHandyYaAsignadaError)) throw error;
    const id = usuarioHandyId ?? error.usuarioHandyId;
    const rechazo =
      id === null
        ? null
        : await rechazoSiCuentaHandyOcupada(usuarios, id, excluirId);
    if (rechazo === null) throw error;
    return rechazo;
  }
}
