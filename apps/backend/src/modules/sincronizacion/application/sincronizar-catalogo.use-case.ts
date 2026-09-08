import { desdeIsoHandy } from '../domain/fecha-handy';
import { aCentavos } from '../domain/precio';
import { CatalogoRepository, type ProductoLocal } from './catalogo.repository';
import {
  HandyGateway,
  PRIMERA_PAGINA_HANDY,
  type ProductoHandy,
} from './handy.gateway';

/** Resultado de una sincronizacion completa del catalogo (RF, docs/04 §1.3). */
export interface ResultadoSincronizarCatalogo {
  productosSincronizados: number;
  paginasProcesadas: number;
}

/**
 * Caso de uso: sincronizacion completa del catalogo de productos desde Handy
 * hacia el cache local. Capa de aplicacion: solo depende de los puertos
 * (`HandyGateway`, `CatalogoRepository`) y del dominio (`aCentavos`,
 * `desdeIsoHandy`), nunca de infraestructura.
 *
 * Recorre TODAS las paginas de Handy (`max=100` por pagina) hasta agotar
 * `totalPaginas`, convierte cada producto al formato local y lo entrega al
 * repositorio en bloques de una pagina.
 */
export class SincronizarCatalogoUseCase {
  constructor(
    private readonly handy: HandyGateway,
    private readonly catalogo: CatalogoRepository,
  ) {}

  async ejecutar(): Promise<ResultadoSincronizarCatalogo> {
    let pagina = PRIMERA_PAGINA_HANDY;
    // Se ajusta al valor real tras leer la primera pagina.
    let totalPaginas = PRIMERA_PAGINA_HANDY;
    let productosSincronizados = 0;
    let paginasProcesadas = 0;

    do {
      const respuesta = await this.handy.listarProductos(pagina);
      totalPaginas = respuesta.totalPaginas;

      const locales = respuesta.items.map((p) => this.aProductoLocal(p));
      await this.catalogo.upsertProductos(locales);

      productosSincronizados += locales.length;
      paginasProcesadas += 1;
      pagina += 1;
    } while (pagina <= totalPaginas);

    return { productosSincronizados, paginasProcesadas };
  }

  private aProductoLocal(producto: ProductoHandy): ProductoLocal {
    return {
      code: producto.code,
      nombre: producto.description,
      // Handy envia `price` decimal (77.5); el cache lo guarda en centavos.
      precioCentavos: aCentavos(producto.price),
      unidadCode: producto.unit.code,
      // Handy a veces devuelve `unit.description = null` (p. ej. MARUCHAN
      // codigo 805). `unidadDescripcion` es obligatorio en el cache local:
      // se usa `unit.code` como respaldo cuando llega null o vacio.
      unidadDescripcion: producto.unit.description || producto.unit.code,
      familia: producto.family?.description ?? null,
      activo: producto.enabled,
      lastUpdatedHandy: producto.lastUpdated
        ? desdeIsoHandy(producto.lastUpdated)
        : null,
    };
  }
}
