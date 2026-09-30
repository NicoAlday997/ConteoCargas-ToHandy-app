import {
  decidirDesactivacion,
  type MotivoRetencion,
} from '../domain/desactivacion-por-ausencia';
import { extraerFactorDeNombre } from '../domain/factor-empaque';
import { desdeIsoHandy } from '../domain/fecha-handy';
import { aCentavos } from '../domain/precio';
import {
  CatalogoRepository,
  type ProductoGuardado,
  type ProductoLocal,
} from './catalogo.repository';
import {
  FactorEmpaqueRepository,
  type FactorGuardado,
} from './factor-empaque.repository';
import {
  HandyGateway,
  PRIMERA_PAGINA_HANDY,
  type ProductoHandy,
} from './handy.gateway';

/**
 * Retencion de la desactivacion por ausencia (ver
 * `domain/desactivacion-por-ausencia.ts`): no se desactivo nada y hay que
 * avisar.
 */
export interface DesactivacionRetenida {
  motivo: MotivoRetencion;
  /** Activos del cache que no vinieron en la lista de Handy. */
  faltantes: number;
  /** Activos del cache antes de sincronizar. */
  activos: number;
}

/**
 * Que cambio en el cache con una sincronizacion (docs/04 §1.3). Cuenta
 * cambios, no registros procesados: "104 sincronizados" no dice si hubo algo
 * nuevo.
 */
export interface ResultadoSincronizarCatalogo {
  /** No existian en el cache. */
  nuevos: number;
  /**
   * Existian y cambio algun campo real (nombre, precio, familia, unidad) o
   * volvieron a estar activos. Si nada cambio no cuentan.
   */
  actualizados: number;
  /** Estaban activos aqui y Handy ya no los lista como habilitados. */
  desactivados: number;
  /**
   * Activos con `factorConfirmado = false`: NO se pueden contar hasta que un
   * supervisor diga como se venden.
   */
  sinConfirmarEmpaque: number;
  /** `null` salvo que un candado haya impedido desactivar. */
  desactivacionRetenida: DesactivacionRetenida | null;
}

/**
 * Caso de uso: sincronizacion completa del catalogo de productos desde Handy
 * hacia el cache local. Capa de aplicacion: solo depende de los puertos
 * (`HandyGateway`, `CatalogoRepository`) y del dominio (`aCentavos`,
 * `desdeIsoHandy`), nunca de infraestructura.
 *
 * Recorre TODAS las paginas de Handy (`max=100` por pagina) hasta agotar
 * `totalPaginas`, convierte cada producto al formato local, lo compara con lo
 * guardado para clasificarlo (nuevo, actualizado, desactivado o sin cambio) y
 * lo entrega al repositorio en bloques de una pagina. Al terminar el
 * recorrido, lo activo que Handy ya no lista se desactiva (con candados, ver
 * `domain/desactivacion-por-ausencia.ts`). Si una pagina falla, el error se
 * propaga y no se desactiva nada.
 *
 * Factor de empaque: a un producto SIN factor guardado se le propone el que
 * trae su nombre ("C/12" -> 12), sin confirmar. Un factor ya guardado no se
 * toca aunque el nombre cambie: si esta confirmado, la confirmacion humana
 * manda sobre la extraccion automatica; si solo esta propuesto, sigue a la
 * espera de que un supervisor lo revise. `modalidadVenta` nunca se toca.
 */
export class SincronizarCatalogoUseCase {
  constructor(
    private readonly handy: HandyGateway,
    private readonly catalogo: CatalogoRepository,
    private readonly factores: FactorEmpaqueRepository,
  ) {}

  async ejecutar(): Promise<ResultadoSincronizarCatalogo> {
    const activosAntes = new Set(
      await this.catalogo.listarCodesProductosActivos(),
    );
    const vistos = new Set<string>();
    let totalReportado = 0;
    let nuevos = 0;
    let actualizados = 0;
    let desactivados = 0;

    let pagina = PRIMERA_PAGINA_HANDY;
    // Se ajusta al valor real tras leer la primera pagina.
    let totalPaginas = PRIMERA_PAGINA_HANDY;
    do {
      const respuesta = await this.handy.listarProductos(pagina);
      totalPaginas = respuesta.totalPaginas;
      if (pagina === PRIMERA_PAGINA_HANDY) {
        totalReportado = respuesta.totalRegistros;
      }

      const codes = respuesta.items.map((p) => p.code);
      const [guardados, factoresGuardados] = await Promise.all([
        this.catalogo.buscarProductos(codes),
        this.factores.buscarFactores(codes),
      ]);
      const locales = respuesta.items.map((p) =>
        this.aProductoLocal(p, factoresGuardados.get(p.code)),
      );

      for (const local of locales) {
        vistos.add(local.code);
        switch (clasificar(guardados.get(local.code), local)) {
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
      await this.catalogo.upsertProductos(locales);
      pagina += 1;
    } while (pagina <= totalPaginas);

    const faltantes = [...activosAntes].filter((code) => !vistos.has(code));
    const decision = decidirDesactivacion({
      recibidos: vistos.size,
      totalReportado,
      activos: activosAntes.size,
      faltantes: faltantes.length,
    });
    let desactivacionRetenida: DesactivacionRetenida | null = null;
    if (decision.tipo === 'APLICAR') {
      if (faltantes.length > 0) {
        await this.catalogo.desactivarProductos(faltantes);
        desactivados += faltantes.length;
      }
    } else {
      desactivacionRetenida = {
        motivo: decision.motivo,
        faltantes: faltantes.length,
        activos: activosAntes.size,
      };
    }

    return {
      nuevos,
      actualizados,
      desactivados,
      sinConfirmarEmpaque: await this.factores.contarPendientes(),
      desactivacionRetenida,
    };
  }

  private aProductoLocal(
    producto: ProductoHandy,
    factorGuardado: FactorGuardado | undefined,
  ): ProductoLocal {
    const sinFactorGuardado =
      factorGuardado === undefined ||
      (factorGuardado.piezasPorPaquete === null &&
        !factorGuardado.factorConfirmado);

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
      piezasPorPaquetePropuesto: sinFactorGuardado
        ? extraerFactorDeNombre(producto.description)
        : null,
    };
  }
}

type Clasificacion = 'NUEVO' | 'ACTUALIZADO' | 'DESACTIVADO' | 'SIN_CAMBIO';

/** Como cuenta un producto recibido de Handy frente a lo guardado. */
function clasificar(
  guardado: ProductoGuardado | undefined,
  local: ProductoLocal,
): Clasificacion {
  if (guardado === undefined) return 'NUEVO';
  if (guardado.activo && !local.activo) return 'DESACTIVADO';
  const cambio =
    guardado.nombre !== local.nombre ||
    guardado.precioCentavos !== local.precioCentavos ||
    guardado.familia !== local.familia ||
    guardado.unidadCode !== local.unidadCode ||
    guardado.unidadDescripcion !== local.unidadDescripcion ||
    guardado.activo !== local.activo;
  return cambio ? 'ACTUALIZADO' : 'SIN_CAMBIO';
}
