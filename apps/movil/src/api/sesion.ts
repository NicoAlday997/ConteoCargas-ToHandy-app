import * as SecureStore from 'expo-secure-store';

import type { RolApp } from './auth';
import { borrarToken } from './token';

/**
 * Datos del usuario con sesión abierta. El JWT no trae el nombre, y la
 * pantalla de inicio lo necesita sin volver a consultar al servidor.
 */
export interface UsuarioSesion {
  id: string;
  nombreCompleto: string | null;
  rolApp: RolApp | null;
  debeCambiarPin: boolean;
}

const CLAVE_USUARIO = 'conteo_cargas_usuario';

export async function guardarUsuarioSesion(usuario: UsuarioSesion): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_USUARIO, JSON.stringify(usuario));
}

export async function obtenerUsuarioSesion(): Promise<UsuarioSesion | null> {
  const texto = await SecureStore.getItemAsync(CLAVE_USUARIO);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as UsuarioSesion;
  } catch {
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  pinTemporal = null;
  await Promise.all([borrarToken(), SecureStore.deleteItemAsync(CLAVE_USUARIO)]);
}

/**
 * PIN temporal con el que se acaba de entrar, necesario como `pinActual`
 * en /auth/cambiar-pin. Solo vive en memoria: nunca se persiste. Si la app
 * se reinicia antes de cambiarlo, el usuario vuelve a entrar con su PIN temporal.
 */
let pinTemporal: string | null = null;

export function recordarPinTemporal(pin: string): void {
  pinTemporal = pin;
}

export function obtenerPinTemporal(): string | null {
  return pinTemporal;
}

export function olvidarPinTemporal(): void {
  pinTemporal = null;
}
