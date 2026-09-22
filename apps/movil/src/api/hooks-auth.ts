import { useMutation, useQuery } from '@tanstack/react-query';

import { cambiarPin, listarUsuarios, login, type RespuestaLogin, type UsuarioSeleccionable } from './auth';
import { ErrorApi, ErrorRed } from './cliente';
import { guardarUsuarioSesion, obtenerUsuarioSesion } from './sesion';
import { guardarToken } from './token';

const STALE_TIME_USUARIOS_MS = 1000 * 60 * 5;

/** Usuario de la lista ya validado: sin id no se puede iniciar sesión. */
export interface UsuarioElegible extends UsuarioSeleccionable {
  id: string;
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['auth', 'usuarios'],
    queryFn: listarUsuarios,
    staleTime: STALE_TIME_USUARIOS_MS,
    select: (usuarios): UsuarioElegible[] =>
      usuarios.filter((u): u is UsuarioElegible => typeof u.id === 'string' && u.id.length > 0),
  });
}

interface VariablesLogin {
  usuarioAppId: string;
  pin: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ usuarioAppId, pin }: VariablesLogin): Promise<RespuestaLogin> => {
      const respuesta = await login(usuarioAppId, pin);
      if (!respuesta?.accessToken) {
        throw new Error('El servidor no devolvió un token de sesión');
      }
      return respuesta;
    },
    onSuccess: async (respuesta, { usuarioAppId }) => {
      await guardarToken(respuesta.accessToken as string);
      await guardarUsuarioSesion({
        id: respuesta.usuario?.id ?? usuarioAppId,
        nombreCompleto: respuesta.usuario?.nombreCompleto ?? null,
        rolApp: respuesta.usuario?.rolApp ?? null,
        debeCambiarPin: respuesta.debeCambiarPin === true,
      });
    },
  });
}

interface VariablesCambiarPin {
  pinActual: string;
  pinNuevo: string;
}

export function useCambiarPin() {
  return useMutation({
    mutationFn: ({ pinActual, pinNuevo }: VariablesCambiarPin) => cambiarPin(pinActual, pinNuevo),
    onSuccess: async () => {
      const usuario = await obtenerUsuarioSesion();
      if (usuario) {
        await guardarUsuarioSesion({ ...usuario, debeCambiarPin: false });
      }
    },
  });
}

export type ErrorLogin =
  | { tipo: 'pin-incorrecto'; intentosRestantes: number | null }
  | { tipo: 'bloqueado'; bloqueadoHasta: Date | null }
  | { tipo: 'inactivo' }
  | { tipo: 'red' }
  | { tipo: 'otro'; mensaje: string };

/**
 * Traduce el error a algo que la pantalla pueda comunicar sin ambigüedad
 * (RF-03): PIN incorrecto, bloqueo y falla de red son mensajes distintos.
 */
export function clasificarErrorLogin(error: unknown): ErrorLogin {
  if (error instanceof ErrorRed) return { tipo: 'red' };
  if (error instanceof ErrorApi) {
    if (error.estado === 401) {
      const cuerpo = error.cuerpo;
      if (cuerpo?.codigo === 'USUARIO_BLOQUEADO') {
        const hasta = typeof cuerpo.bloqueadoHasta === 'string' ? new Date(cuerpo.bloqueadoHasta) : null;
        return { tipo: 'bloqueado', bloqueadoHasta: hasta && !Number.isNaN(hasta.getTime()) ? hasta : null };
      }
      if (cuerpo?.codigo === 'USUARIO_INACTIVO') return { tipo: 'inactivo' };
      const intentos = cuerpo?.intentosRestantes;
      return { tipo: 'pin-incorrecto', intentosRestantes: typeof intentos === 'number' ? intentos : null };
    }
    if (error.estado >= 500) return { tipo: 'otro', mensaje: 'El servidor tuvo un problema. Intenta de nuevo.' };
  }
  return { tipo: 'otro', mensaje: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' };
}
