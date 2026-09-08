import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  MAX_REGISTROS_POR_PAGINA_HANDY,
  ROL_VENDEDOR_HANDY_ID,
  type ItemRutaHandy,
  type PaginaHandy,
  type PayloadCrearRuta,
  type ProductoHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
  type UsuarioHandyDto,
} from '../application/handy.gateway';

// Los errores del puerto se re-exportan para no romper a quien ya los importaba
// desde aca (p. ej. `interface/sincronizacion.controller.ts`). Su definicion
// vive ahora en `application/handy.gateway.ts`, junto al contrato del puerto.
export {
  HandyErrorServidorError,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
} from '../application/handy.gateway';

/**
 * Adaptador HTTP real del puerto `HandyGateway` contra la API REST v2 de Handy
 * (`https://hub.handy.la/api/v2`). Es el UNICO punto del backend que conoce la
 * base URL, la forma cruda de las respuestas de Handy y el Bearer Token de
 * compañia.
 *
 * Seguridad (docs/02-documento-tecnico-y-diseno.md seccion 5):
 *  - El token vive SOLO como variable de entorno del backend (`HANDY_API_TOKEN`).
 *  - Nunca se devuelve al cliente, nunca se escribe en logs y nunca aparece en
 *    el mensaje de una excepcion. Los errores de aqui solo referencian la ruta
 *    (sin token) y el codigo de estado HTTP.
 */

/** `pagination` embebido en las respuestas de lista de Handy. */
interface PaginacionHandy {
  totalCount: number;
  totalPages: number;
  nextPage: number | null;
}

/** Forma cruda de `GET /product`. */
interface RespuestaProductosHandy {
  pagination: PaginacionHandy;
  products: ProductoHandy[];
}

/** Forma cruda de `GET /user`. */
interface RespuestaUsuariosHandy {
  pagination: PaginacionHandy;
  users: UsuarioHandyDto[];
}

/**
 * Forma cruda de `GET /user/{userId}/route/current` y de la respuesta OK de
 * `POST .../route`. Handy identifica la ruta con un `id` numerico; puede venir
 * al desnudo o envuelto en `route`. Solo se consume el `id`.
 */
interface RespuestaRutaHandy {
  id?: number | string;
  route?: { id?: number | string };
}

/** Tiempo maximo de espera de las llamadas de escritura de ruta (ms). */
const TIMEOUT_ESCRITURA_MS = 15_000;

@Injectable()
export class HandyHttpGateway extends HandyGateway {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.token = config.getOrThrow<string>('HANDY_API_TOKEN');
    // Se normaliza la barra final para poder concatenar rutas que empiezan por `/`.
    this.baseUrl = config
      .getOrThrow<string>('HANDY_API_BASE_URL')
      .replace(/\/+$/, '');
  }

  async listarProductos(pagina: number): Promise<PaginaHandy<ProductoHandy>> {
    const ruta = `/product?enabled=true&max=${MAX_REGISTROS_POR_PAGINA_HANDY}&page=${pagina}`;
    const cuerpo = await this.peticion<RespuestaProductosHandy>(ruta);
    if (cuerpo === null) {
      return { items: [], totalPaginas: 0, totalRegistros: 0 };
    }
    return {
      items: cuerpo.products ?? [],
      totalPaginas: cuerpo.pagination.totalPages,
      totalRegistros: cuerpo.pagination.totalCount,
    };
  }

  async listarVendedores(pagina: number): Promise<PaginaHandy<UsuarioHandyDto>> {
    const ruta = `/user?enabled=true&role=${ROL_VENDEDOR_HANDY_ID}&max=${MAX_REGISTROS_POR_PAGINA_HANDY}&page=${pagina}`;
    const cuerpo = await this.peticion<RespuestaUsuariosHandy>(ruta);
    if (cuerpo === null) {
      return { items: [], totalPaginas: 0, totalRegistros: 0 };
    }
    return {
      items: cuerpo.users ?? [],
      totalPaginas: cuerpo.pagination.totalPages,
      totalRegistros: cuerpo.pagination.totalCount,
    };
  }

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    const ruta = `/user/${usuarioHandyId}/route/current`;
    // `peticion` ya traduce 404 -> null: verificado que Handy responde 404
    // cuando el vendedor no tiene ninguna ruta abierta, y eso es informacion
    // valida, no un fallo.
    const cuerpo = await this.peticion<RespuestaRutaHandy>(ruta);
    if (cuerpo === null) {
      return null;
    }
    const id = this.extraerIdRuta(cuerpo);
    return id === null ? null : { id };
  }

  async crearRuta(
    usuarioHandyId: number,
    payload: PayloadCrearRuta,
  ): Promise<RespuestaCrearRuta> {
    return this.peticionEnvioRuta(
      `/user/${usuarioHandyId}/route?prettyMessages=true`,
      payload,
    );
  }

  async recargarRuta(
    usuarioHandyId: number,
    items: ItemRutaHandy[],
  ): Promise<RespuestaCrearRuta> {
    return this.peticionEnvioRuta(
      `/user/${usuarioHandyId}/route/recharge?prettyMessages=true`,
      { items },
    );
  }

  async cancelarRuta(rutaId: string): Promise<boolean> {
    const ruta = `/route/${rutaId}`;
    const respuesta = await this.fetchConManejoDeRed(ruta, { method: 'DELETE' });

    if (respuesta.status === 401) {
      throw new HandyTokenInvalidoError(ruta);
    }
    if (respuesta.status >= 500) {
      throw new HandyErrorServidorError(ruta, respuesta.status);
    }
    // Handy rechaza el DELETE (404 / 409 / 422) cuando la ruta ya no se puede
    // cancelar —tipicamente porque el vendedor ya la acepto— o no existe.
    if (respuesta.status === 404 || respuesta.status === 409 || respuesta.status === 422) {
      return false;
    }
    if (!respuesta.ok) {
      throw new HandyRespuestaNoOkError(ruta, respuesta.status);
    }
    return true;
  }

  /**
   * GET autenticado contra Handy. Usa el `fetch` nativo de Node (sin axios).
   *
   * Mapa de estados:
   *  - 401 -> `HandyTokenInvalidoError` (no recuperable, alerta alta).
   *  - 404 -> `null`. NO es un fallo: p. ej. `GET /user/{id}/route/current`
   *    responde 404 cuando el vendedor no tiene ruta abierta, y eso es
   *    informacion valida. Verificado contra la API real.
   *  - 5xx -> `HandyErrorServidorError` (transitorio, reintentable).
   *  - otro no-ok -> `HandyRespuestaNoOkError`.
   *  - ok -> cuerpo JSON tipado como `T`.
   *
   * El token viaja solo en el header `Authorization`; nunca se registra ni se
   * incluye en el mensaje de una excepcion.
   */
  private async peticion<T>(ruta: string): Promise<T | null> {
    const respuesta = await fetch(`${this.baseUrl}${ruta}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (respuesta.status === 401) {
      throw new HandyTokenInvalidoError(ruta);
    }
    if (respuesta.status === 404) {
      return null;
    }
    if (respuesta.status >= 500) {
      throw new HandyErrorServidorError(ruta, respuesta.status);
    }
    if (!respuesta.ok) {
      throw new HandyRespuestaNoOkError(ruta, respuesta.status);
    }

    return (await respuesta.json()) as T;
  }

  /**
   * POST autenticado que crea o recarga una ruta. Mantiene el mismo mapa de
   * errores de infraestructura que `peticion` (401 / 5xx / otro no-ok) y ademas:
   *  - timeout o error de red -> `HandySinRespuestaError`: no se sabe si Handy
   *    llego a crear la ruta; el envio debe quedar `ENVIO_INCIERTO`.
   *  - 422 -> desenlace de negocio, NO excepcion: se aislan los productos
   *    rechazados (`prettyMessages=true`) y se devuelven para reenviar el resto
   *    (docs/02 seccion 4.3 y 4.4).
   *  - ok -> `{ estado: 'CREADA', idHandy }`.
   */
  private async peticionEnvioRuta(
    ruta: string,
    cuerpo: unknown,
  ): Promise<RespuestaCrearRuta> {
    const respuesta = await this.fetchConManejoDeRed(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    if (respuesta.status === 401) {
      throw new HandyTokenInvalidoError(ruta);
    }
    if (respuesta.status === 422) {
      const json = (await respuesta.json().catch(() => null)) as unknown;
      return {
        estado: 'INVENTARIO_INSUFICIENTE',
        productosRechazados: this.extraerProductosRechazados(json),
      };
    }
    if (respuesta.status >= 500) {
      throw new HandyErrorServidorError(ruta, respuesta.status);
    }
    if (!respuesta.ok) {
      throw new HandyRespuestaNoOkError(ruta, respuesta.status);
    }

    const json = (await respuesta.json().catch(() => null)) as RespuestaRutaHandy | null;
    const idHandy = json === null ? null : this.extraerIdRuta(json);
    if (idHandy === null) {
      // Handy contesto 2xx pero sin un id reconocible: no se puede registrar el
      // envio como exitoso sin ese identificador.
      throw new HandyRespuestaNoOkError(ruta, respuesta.status);
    }
    return { estado: 'CREADA', idHandy };
  }

  /**
   * `fetch` con timeout y traduccion de fallos de red a
   * `HandySinRespuestaError`. Cualquier rechazo del `fetch` (abort por timeout,
   * DNS, conexion cortada) entra aca; el `AbortError` incluido.
   */
  private async fetchConManejoDeRed(
    ruta: string,
    init: RequestInit,
  ): Promise<Response> {
    const controlador = new AbortController();
    const temporizador = setTimeout(
      () => controlador.abort(),
      TIMEOUT_ESCRITURA_MS,
    );
    try {
      return await fetch(`${this.baseUrl}${ruta}`, {
        ...init,
        signal: controlador.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...init.headers,
        },
      });
    } catch (causa) {
      throw new HandySinRespuestaError(ruta, causa);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** Toma el `id` de la ruta (al desnudo o dentro de `route`) y lo pasa a string. */
  private extraerIdRuta(cuerpo: RespuestaRutaHandy): string | null {
    const id = cuerpo.id ?? cuerpo.route?.id;
    if (id === undefined || id === null || id === '') {
      return null;
    }
    return String(id);
  }

  /**
   * Extrae los `code` de producto rechazados del cuerpo de un 422. Con
   * `prettyMessages=true` Handy devuelve los detalles por item; la forma exacta
   * es de las que docs/02 seccion 7 marca "validar contra el ambiente de Handy",
   * asi que este parser es defensivo: reconoce las variantes conocidas y, si no
   * encuentra ninguna, devuelve `[]` (el caso de uso lo trata como que no pudo
   * aislar nada).
   */
  private extraerProductosRechazados(json: unknown): string[] {
    if (json === null || typeof json !== 'object') {
      return [];
    }
    const raiz = json as Record<string, unknown>;
    const listas = [raiz.messages, raiz.errors, raiz.rejected, raiz.details];
    const codigos = new Set<string>();
    for (const lista of listas) {
      if (!Array.isArray(lista)) {
        continue;
      }
      for (const entrada of lista) {
        const code =
          typeof entrada === 'string'
            ? entrada
            : entrada && typeof entrada === 'object'
              ? (entrada as Record<string, unknown>).product ??
                (entrada as Record<string, unknown>).code ??
                (entrada as Record<string, unknown>).productCode
              : undefined;
        if (typeof code === 'string' && code.length > 0) {
          codigos.add(code);
        }
      }
    }
    return [...codigos];
  }
}
