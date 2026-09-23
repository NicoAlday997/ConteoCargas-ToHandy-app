import { peticion } from './cliente';

/**
 * Permisos del supervisor para que una ruta inicie su carga inicial con la
 * ruta anterior del vendedor sin liquidar en Handy (docs/04, `/admin/permisos-carga`).
 * Duran 24 horas y sirven una sola vez. Exclusivo del rol Supervisor.
 */

/** Fila de `GET /admin/permisos-carga`: sin vencer, usado o no. */
export interface PermisoCargaApi {
  id: string | null;
  rutaId: string | null;
  rutaNombre: string | null;
  otorgadoPorId: string | null;
  otorgadoPorNombre: string | null;
  motivo: string | null;
  fechaOtorgado: string | null;
  fechaExpiracion: string | null;
  usado: boolean | null;
  /** Carga que lo consumió; `null` mientras no se use. */
  eventoCargaId: string | null;
}

export interface RutaPermisoApi {
  id: string | null;
  nombre: string | null;
  codigo: string | null;
  vendedorNombre: string | null;
}

/** 409 de `POST /admin/permisos-carga`: la ruta ya tiene uno sin usar. */
export const CODIGO_YA_EXISTE_PERMISO = 'YA_EXISTE_PERMISO_VIGENTE';

/** Mismo mínimo que el backend: "ok" o "si" no dejan nada auditable. */
export const LONGITUD_MINIMA_MOTIVO = 5;

/** Mismo plazo que el backend; solo para explicarlo antes de otorgar. */
export const VIGENCIA_PERMISO_HORAS = 24;

export async function listarPermisos(): Promise<PermisoCargaApi[]> {
  const respuesta = await peticion<{ permisos?: PermisoCargaApi[] | null } | null>('/admin/permisos-carga');
  return Array.isArray(respuesta?.permisos) ? respuesta.permisos : [];
}

export async function listarRutasPermiso(): Promise<RutaPermisoApi[]> {
  const respuesta = await peticion<{ rutas?: RutaPermisoApi[] | null } | null>('/admin/permisos-carga/rutas');
  return Array.isArray(respuesta?.rutas) ? respuesta.rutas : [];
}

export function otorgarPermiso(rutaId: string, motivo: string): Promise<{ permiso: PermisoCargaApi | null } | null> {
  return peticion<{ permiso: PermisoCargaApi | null } | null>('/admin/permisos-carga', {
    method: 'POST',
    cuerpo: { rutaId, motivo },
  });
}
