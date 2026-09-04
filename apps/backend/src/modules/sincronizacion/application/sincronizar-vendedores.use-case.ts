import {
  CatalogoRepository,
  type VendedorHandyLocal,
} from './catalogo.repository';
import {
  HandyGateway,
  PRIMERA_PAGINA_HANDY,
  type UsuarioHandyDto,
} from './handy.gateway';

/** Resultado de una sincronizacion completa de vendedores (docs/04 §1.3). */
export interface ResultadoSincronizarVendedores {
  vendedoresSincronizados: number;
  paginasProcesadas: number;
}

/**
 * Caso de uso: sincronizacion completa de los usuarios vendedores de Handy
 * (`role.id = 4`) hacia el cache local. Mismo recorrido paginado que
 * `SincronizarCatalogoUseCase`. Capa de aplicacion: solo depende de los puertos.
 */
export class SincronizarVendedoresUseCase {
  constructor(
    private readonly handy: HandyGateway,
    private readonly catalogo: CatalogoRepository,
  ) {}

  async ejecutar(): Promise<ResultadoSincronizarVendedores> {
    let pagina = PRIMERA_PAGINA_HANDY;
    let totalPaginas = PRIMERA_PAGINA_HANDY;
    let vendedoresSincronizados = 0;
    let paginasProcesadas = 0;

    do {
      const respuesta = await this.handy.listarVendedores(pagina);
      totalPaginas = respuesta.totalPaginas;

      const locales = respuesta.items.map((u) => this.aVendedorLocal(u));
      await this.catalogo.upsertVendedores(locales);

      vendedoresSincronizados += locales.length;
      paginasProcesadas += 1;
      pagina += 1;
    } while (pagina <= totalPaginas);

    return { vendedoresSincronizados, paginasProcesadas };
  }

  private aVendedorLocal(usuario: UsuarioHandyDto): VendedorHandyLocal {
    return {
      idHandy: usuario.id,
      nombre: usuario.name,
      email: usuario.email ?? null,
      rolHandyId: usuario.role.id,
      rolHandyAuthority: usuario.role.authority,
      activo: usuario.enabled,
    };
  }
}
