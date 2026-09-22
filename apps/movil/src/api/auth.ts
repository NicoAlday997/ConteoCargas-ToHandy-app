import { peticion } from './cliente';

export type RolApp = 'VENDEDOR' | 'CONTADOR' | 'SUPERVISOR';

export const ETIQUETAS_ROL: Record<RolApp, string> = {
  VENDEDOR: 'Vendedor',
  CONTADOR: 'Contador',
  SUPERVISOR: 'Supervisor',
};

/** Fila de la lista pública de selección (RF-01). */
export interface UsuarioSeleccionable {
  id: string | null;
  nombreCompleto: string | null;
  rolApp: RolApp | null;
}

export interface UsuarioLogin {
  id: string | null;
  nombreCompleto: string | null;
  rolApp: RolApp | null;
}

export interface RespuestaLogin {
  accessToken: string | null;
  debeCambiarPin: boolean | null;
  usuario: UsuarioLogin | null;
}

export interface RespuestaCambiarPin {
  debeCambiarPin: boolean | null;
}

export async function listarUsuarios(): Promise<UsuarioSeleccionable[]> {
  const usuarios = await peticion<UsuarioSeleccionable[] | null>('/auth/usuarios');
  return Array.isArray(usuarios) ? usuarios : [];
}

export function login(usuarioAppId: string, pin: string): Promise<RespuestaLogin> {
  return peticion<RespuestaLogin>('/auth/login', {
    method: 'POST',
    cuerpo: { usuarioAppId, pin },
  });
}

export function cambiarPin(pinActual: string, pinNuevo: string): Promise<RespuestaCambiarPin | null> {
  return peticion<RespuestaCambiarPin | null>('/auth/cambiar-pin', {
    method: 'POST',
    cuerpo: { pinActual, pinNuevo },
  });
}
