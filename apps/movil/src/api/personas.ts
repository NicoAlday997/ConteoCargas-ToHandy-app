import type { RolApp } from './auth';
import { peticion } from './cliente';

/**
 * Administración de usuarios (docs/04 §1.2). Solo Supervisor. El PIN temporal
 * llega EN CLARO una sola vez (al crear o al restablecer) y la app no lo
 * guarda en ningún lado: solo lo muestra.
 */

/** Fila de `GET /admin/usuarios` (incluye inactivos). Nunca trae el PIN. */
export interface UsuarioAdminApi {
  id: string | null;
  nombreCompleto: string | null;
  rolApp: RolApp | null;
  usuarioHandyId: number | null;
  activo: boolean | null;
  debeCambiarPin: boolean | null;
  /** Bloqueo por intentos fallidos vigente al leer (ISO 8601); `null` si puede entrar. */
  bloqueo?: { desde: string | null; hasta: string | null } | null;
}

/** Fila de `GET /admin/usuarios-handy`. */
export interface CuentaHandyApi {
  idHandy: number | null;
  nombre: string | null;
  fotoUrl: string | null;
  /** `false`: Handy ya no la lista como habilitada. */
  activa: boolean | null;
  /** Usuario ACTIVO de la app que la ocupa; `null` si está libre. */
  vinculadaA: { id: string; nombreCompleto: string } | null;
}

export interface DatosAlta {
  nombreCompleto: string;
  rolApp: RolApp;
  /** Solo vendedor: siempre. Los demás roles: nunca (el servidor lo rechaza). */
  usuarioHandyId?: number;
}

export interface DatosEdicion {
  nombreCompleto?: string;
  activo?: boolean;
}

const base = '/admin/usuarios';

export function listarPersonas(): Promise<UsuarioAdminApi[] | null> {
  return peticion<UsuarioAdminApi[] | null>(base);
}

export function listarCuentasHandy(): Promise<CuentaHandyApi[] | null> {
  return peticion<CuentaHandyApi[] | null>('/admin/usuarios-handy');
}

export function crearPersona(datos: DatosAlta): Promise<{ usuario: UsuarioAdminApi | null; pinTemporal: string | null } | null> {
  return peticion(base, { method: 'POST', cuerpo: datos });
}

export function editarPersona(id: string, datos: DatosEdicion): Promise<UsuarioAdminApi | null> {
  return peticion(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', cuerpo: datos });
}

/** Quita el bloqueo por intentos fallidos sin tocar el PIN. Nunca el propio. */
export function desbloquearPersona(id: string): Promise<UsuarioAdminApi | null> {
  return peticion(`${base}/${encodeURIComponent(id)}/desbloquear`, { method: 'POST' });
}

export function restablecerPinPersona(id: string): Promise<{ pinTemporal: string | null } | null> {
  return peticion(`${base}/${encodeURIComponent(id)}/restablecer-pin`, { method: 'POST' });
}

/**
 * Renglón de `GET /admin/usuarios/:id/accesos`. `autor` es `null` solo en
 * `LINEA_COMANDOS` (no hay sesión: nunca se sabrá quién), y entonces `motivo`
 * dice por qué. `bloqueadoHasta`: solo en `BLOQUEO_QUITADO`.
 */
export interface MovimientoAccesoApi {
  id: string | null;
  tipo: 'PIN_RESTABLECIDO' | 'BLOQUEO_QUITADO' | null;
  /** ISO 8601. */
  fecha: string | null;
  origen: 'SUPERVISOR' | 'LINEA_COMANDOS' | null;
  autor: { id: string | null; nombreCompleto: string | null } | null;
  motivo: string | null;
  /** ISO 8601. */
  bloqueadoHasta: string | null;
}

export interface PaginaAccesosApi {
  items: MovimientoAccesoApi[] | null;
  total: number | null;
  page: number | null;
  pageSize: number | null;
}

/** Solo lectura: no hay (ni habrá) forma de editar o borrar un renglón. */
export function listarAccesosPersona(id: string, page: number, pageSize: number): Promise<PaginaAccesosApi | null> {
  return peticion(`${base}/${encodeURIComponent(id)}/accesos?page=${page}&pageSize=${pageSize}`);
}
