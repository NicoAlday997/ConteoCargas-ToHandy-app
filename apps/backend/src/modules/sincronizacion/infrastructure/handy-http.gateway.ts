import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  HandyGateway,
  MAX_REGISTROS_POR_PAGINA_HANDY,
  ROL_VENDEDOR_HANDY_ID,
  type PaginaHandy,
  type ProductoHandy,
  type UsuarioHandyDto,
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
 * El token de Handy es invalido o expiro (HTTP 401). No lo puede resolver el
 * usuario operativo: debe generar una alerta de urgencia ALTA para el
 * administrador (docs/02 seccion 6). El mensaje jamas incluye el token.
 */
export class HandyTokenInvalidoError extends Error {
  constructor(ruta: string) {
    super(`Handy respondio 401 (token invalido o expirado) en ${ruta}`);
    this.name = 'HandyTokenInvalidoError';
  }
}

/**
 * Handy respondio con un error de servidor (HTTP 5xx). Es transitorio: la capa
 * que orquesta la sincronizacion puede reintentar con backoff (docs/02 4.4).
 */
export class HandyErrorServidorError extends Error {
  constructor(
    ruta: string,
    readonly estado: number,
  ) {
    super(`Handy respondio ${estado} (error de servidor) en ${ruta}`);
    this.name = 'HandyErrorServidorError';
  }
}

/**
 * Handy respondio con un estado que este adaptador no sabe interpretar (un 4xx
 * distinto de 401/404). Se expone el codigo pero nunca el cuerpo ni el token.
 */
export class HandyRespuestaNoOkError extends Error {
  constructor(
    ruta: string,
    readonly estado: number,
  ) {
    super(`Handy respondio ${estado} (inesperado) en ${ruta}`);
    this.name = 'HandyRespuestaNoOkError';
  }
}

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
}
