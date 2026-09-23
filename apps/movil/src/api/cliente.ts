import { borrarToken, obtenerToken } from './token';

const URL_BASE = process.env.EXPO_PUBLIC_API_URL;

export interface OpcionesPeticion extends Omit<RequestInit, 'body'> {
  cuerpo?: unknown;
}

/** Forma de los errores del backend (`{ statusCode, mensaje }`), más campos opcionales. */
export interface CuerpoErrorApi {
  statusCode?: number | null;
  mensaje?: string | null;
  /**
   * Login: `PIN_INCORRECTO`, `USUARIO_BLOQUEADO`, `USUARIO_INACTIVO`, `CREDENCIALES_INVALIDAS`.
   * Iniciar carga: `YA_TIENE_CARGA_ABIERTA`, `FECHA_OPERATIVA_INVALIDA`.
   */
  codigo?: string | null;
  intentosRestantes?: number | null;
  /** Solo en `PATCH .../items` rechazado: los productos que el servidor no aceptó. */
  productos?: unknown;
  /** ISO 8601. */
  bloqueadoHasta?: string | null;
  /** Solo en 409 `YA_TIENE_CARGA_ABIERTA`: la carga inicial que ya existe. */
  eventoId?: string | null;
}

/** El servidor respondió, pero con un código de error. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly cuerpo: CuerpoErrorApi | null,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/**
 * No hubo respuesta del servidor. Se distingue de ErrorApi para no hacer
 * creer al usuario que su PIN está mal cuando lo que falla es la red.
 */
export class ErrorRed extends Error {
  constructor() {
    super('No hay conexión con el servidor');
    this.name = 'ErrorRed';
  }
}

async function leerCuerpoError(respuesta: Response): Promise<CuerpoErrorApi | null> {
  const texto = await respuesta.text().catch(() => '');
  if (!texto) return null;
  try {
    const json: unknown = JSON.parse(texto);
    return typeof json === 'object' && json !== null ? (json as CuerpoErrorApi) : null;
  } catch {
    return { mensaje: texto };
  }
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

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      ...resto,
      headers: encabezados,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorRed();
  }

  if (!respuesta.ok) {
    const cuerpoError = await leerCuerpoError(respuesta);

    // Con token, un 401 significa sesión vencida. Sin token (login) es un
    // PIN incorrecto y se deja pasar el mensaje del servidor.
    if (respuesta.status === 401 && token) {
      await borrarToken();
      throw new ErrorApi(401, cuerpoError, 'Sesión expirada');
    }

    throw new ErrorApi(
      respuesta.status,
      cuerpoError,
      cuerpoError?.mensaje || `Error ${respuesta.status}: ${respuesta.statusText}`,
    );
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}
