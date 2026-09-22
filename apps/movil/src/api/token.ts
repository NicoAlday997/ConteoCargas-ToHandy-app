import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store (no AsyncStorage): el token da acceso a un sistema
 * de control de inventario, no es un dato de conveniencia.
 */
const CLAVE_TOKEN = 'conteo_cargas_token';

export async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function obtenerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function borrarToken(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
