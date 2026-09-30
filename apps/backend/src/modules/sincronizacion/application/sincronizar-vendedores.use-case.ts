import {
  CatalogoRepository,
  type VendedorGuardado,
  type VendedorHandyLocal,
} from './catalogo.repository';
import {
  HandyGateway,
  PRIMERA_PAGINA_HANDY,
  type UsuarioHandyDto,
} from './handy.gateway';
import { decidirDesactivacion } from '../domain/desactivacion-por-ausencia';
import { normalizarFotoHandy } from '../domain/foto-handy';
import type { DesactivacionRetenida } from './sincronizar-catalogo.use-case';

/**
 * Que cambio en el cache de vendedores (docs/04 §1.3). Mismas reglas que el
 * catalogo: se cuentan cambios reales, no registros procesados.
 */
export interface ResultadoSincronizarVendedores {
  /** No existian en el cache. */
  nuevos: number;
  /**
   * Existian y cambio algun campo real (nombre, email, rol, foto) o volvieron
   * a estar activos.
   */
  actualizados: number;
  /** Estaban activos aqui y Handy ya no los lista como habilitados. */
  desactivados: number;
  /** `null` salvo que un candado haya impedido desactivar. */
  desactivacionRetenida: DesactivacionRetenida | null;
}

/**
 * Caso de uso: sincronizacion completa de los usuarios vendedores de Handy
 * (`role.id = 4`) hacia el cache local. Mismo recorrido paginado y misma
 * desactivacion por ausencia (con sus candados) que
 * `SincronizarCatalogoUseCase`. Capa de aplicacion: solo depende de los puertos.
 */
export class SincronizarVendedoresUseCase {
  constructor(
    private readonly handy: HandyGateway,
    private readonly catalogo: CatalogoRepository,
  ) {}

  async ejecutar(): Promise<ResultadoSincronizarVendedores> {
    const activosAntes = new Set(
      await this.catalogo.listarIdsVendedoresActivos(),
    );
    const vistos = new Set<number>();
    let totalReportado = 0;
    let nuevos = 0;
    let actualizados = 0;
    let desactivados = 0;

    let pagina = PRIMERA_PAGINA_HANDY;
    let totalPaginas = PRIMERA_PAGINA_HANDY;
    do {
      const respuesta = await this.handy.listarVendedores(pagina);
      totalPaginas = respuesta.totalPaginas;
      if (pagina === PRIMERA_PAGINA_HANDY) {
        totalReportado = respuesta.totalRegistros;
      }

      const locales = respuesta.items.map((u) => this.aVendedorLocal(u));
      const guardados = await this.catalogo.buscarVendedores(
        locales.map((v) => v.idHandy),
      );
      for (const local of locales) {
        vistos.add(local.idHandy);
        switch (clasificar(guardados.get(local.idHandy), local)) {
          case 'NUEVO':
            nuevos += 1;
            break;
          case 'ACTUALIZADO':
            actualizados += 1;
            break;
          case 'DESACTIVADO':
            desactivados += 1;
            break;
        }
      }
      await this.catalogo.upsertVendedores(locales);
      pagina += 1;
    } while (pagina <= totalPaginas);

    const faltantes = [...activosAntes].filter((id) => !vistos.has(id));
    const decision = decidirDesactivacion({
      recibidos: vistos.size,
      totalReportado,
      activos: activosAntes.size,
      faltantes: faltantes.length,
    });
    let desactivacionRetenida: DesactivacionRetenida | null = null;
    if (decision.tipo === 'APLICAR') {
      if (faltantes.length > 0) {
        await this.catalogo.desactivarVendedores(faltantes);
        desactivados += faltantes.length;
      }
    } else {
      desactivacionRetenida = {
        motivo: decision.motivo,
        faltantes: faltantes.length,
        activos: activosAntes.size,
      };
    }

    return { nuevos, actualizados, desactivados, desactivacionRetenida };
  }

  private aVendedorLocal(usuario: UsuarioHandyDto): VendedorHandyLocal {
    return {
      idHandy: usuario.id,
      nombre: usuario.name,
      email: usuario.email ?? null,
      rolHandyId: usuario.role.id,
      rolHandyAuthority: usuario.role.authority,
      activo: usuario.enabled,
      fotoUrl: this.fotoDe(usuario),
    };
  }

  /**
   * Solo se actualiza la foto cuando Handy manda algo en `pictureUrl`: la foto
   * real, o la silueta generica (el vendedor no tiene o la quito: `null`). Si
   * el campo no llega (`undefined`/`null`), se conserva la guardada: perderla
   * por un cambio de la API seria peor que mostrar una foto vieja.
   */
  private fotoDe(usuario: UsuarioHandyDto): string | null | undefined {
    const url: unknown = usuario.pictureUrl;
    return typeof url === 'string' ? normalizarFotoHandy(url) : undefined;
  }
}

type Clasificacion = 'NUEVO' | 'ACTUALIZADO' | 'DESACTIVADO' | 'SIN_CAMBIO';

/** Como cuenta un vendedor recibido de Handy frente a lo guardado. */
function clasificar(
  guardado: VendedorGuardado | undefined,
  local: VendedorHandyLocal,
): Clasificacion {
  if (guardado === undefined) return 'NUEVO';
  if (guardado.activo && !local.activo) return 'DESACTIVADO';
  const cambio =
    guardado.nombre !== local.nombre ||
    guardado.email !== local.email ||
    guardado.rolHandyId !== local.rolHandyId ||
    guardado.rolHandyAuthority !== local.rolHandyAuthority ||
    guardado.activo !== local.activo ||
    // `undefined`: Handy no mando la foto y se conserva la guardada.
    (local.fotoUrl !== undefined && guardado.fotoUrl !== local.fotoUrl);
  return cambio ? 'ACTUALIZADO' : 'SIN_CAMBIO';
}
