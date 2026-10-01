import { bloqueoVigente, type BloqueoVigente } from '../domain/bloqueo-vigente';
import type { UsuarioAdmin } from './admin-usuario.repository';

/**
 * Lo que el panel de administracion recibe de un usuario. En lugar del
 * `bloqueadoHasta` crudo (que puede ser una fecha ya vencida) lleva `bloqueo`:
 * `null` si hoy puede entrar, o desde y hasta cuando esta bloqueado.
 */
export interface UsuarioAdminVista extends Omit<
  UsuarioAdmin,
  'bloqueadoHasta'
> {
  bloqueo: BloqueoVigente | null;
}

export function vistaUsuarioAdmin(
  usuario: UsuarioAdmin,
  ahora: Date,
): UsuarioAdminVista {
  const { bloqueadoHasta, ...resto } = usuario;
  return { ...resto, bloqueo: bloqueoVigente(bloqueadoHasta, ahora) };
}
