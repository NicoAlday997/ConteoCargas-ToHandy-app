import { borrarToken, obtenerToken } from './token';

const URL_BASE = process.env.EXPO_PUBLIC_API_URL;

export interface OpcionesPeticion extends Omit<RequestInit, 'body'> {
  cuerpo?: unknown;
}

/**
 * Cliente HTTP propio (nunca hacia Handy directo: el backend es el único
 * que conoce el token de integración de Handy).
 */
export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  if (!URL_BASE) {
    throw new Error('EXPO_PUBLIC_API_URL no está configurada');
  }

  const { cuerpo, headers, ...resto } = opciones;
  const token = await obtenerToken();

  const encabezados: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (token) {
    encabezados.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...resto,
    headers: encabezados,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  if (respuesta.status === 401) {
    await borrarToken();
    throw new Error('Sesión expirada');
  }

  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => '');
    throw new Error(`Error ${respuesta.status}: ${texto || respuesta.statusText}`);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}
