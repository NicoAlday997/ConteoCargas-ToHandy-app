import { aPiezas, sueltasExcedenPaquete } from '../domain/conversion-empaque';
import type {
  CargaRepository,
  ItemAGuardar,
  SesionConteo,
} from './carga.repository';
import type { ProductoConteoRepository } from './producto-conteo.repository';

/**
 * Caso de uso: guardar las cantidades capturadas en una sesion de conteo
 * (docs/04 `PATCH /eventos-carga/:id/sesiones/:sesionId/items`).
 *
 * En bodega se cuentan PAQUETES y piezas sueltas; Handy recibe PIEZAS. El
 * cliente manda `paquetes` y `sueltas` por producto y el total en piezas
 * (`cantidad`) se calcula aca con `aPiezas` del dominio: nunca se recibe del
 * cliente.
 *
 * Reemplazo total: un producto que ya no venga en `items` queda eliminado de
 * la sesion. Si cualquier item se rechaza, no se persiste nada.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */

export interface ItemRecibido {
  productoCode: string;
  paquetes: number;
  sueltas: number;
}

export interface EntradaGuardarItems {
  eventoId: string;
  sesionId: string;
  /** Id del usuario de la app que guarda (viaja en el JWT). */
  usuarioAppId: string;
  items: ItemRecibido[];
}

/** Item ya guardado, con el total en piezas y el aviso para la app. */
export interface ItemGuardado extends ItemAGuardar {
  /** Las sueltas ya completan un paquete: la app debe avisarlo (no es error). */
  sueltasExcedenPaquete: boolean;
}

/**
 * Motivos de rechazo:
 * - `SESION_NO_ENCONTRADA`: la sesion no existe o no pertenece al evento.
 * - `SESION_AJENA`: la sesion es de otro usuario.
 * - `PRODUCTO_NO_ENCONTRADO`: algun `productoCode` no existe en el catalogo.
 * - `FACTOR_NO_CONFIRMADO`: se mandaron paquetes de un producto cuyo factor no
 *   ha confirmado un supervisor (o que no tiene factor). Un factor sin
 *   confirmar corrompe el conteo en silencio: el doble conteo no lo detecta
 *   porque ambos conteos usarian el mismo factor.
 *
 * Los dos ultimos traen `productos` con los codigos afectados.
 */
export type ResultadoGuardarItems =
  | { exito: true; sesion: SesionConteo; items: ItemGuardado[] }
  | { exito: false; motivo: 'SESION_NO_ENCONTRADA' | 'SESION_AJENA' }
  | {
      exito: false;
      motivo: 'PRODUCTO_NO_ENCONTRADO' | 'FACTOR_NO_CONFIRMADO';
      productos: string[];
    };

export class GuardarItemsUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly productos: ProductoConteoRepository,
  ) {}

  async ejecutar(entrada: EntradaGuardarItems): Promise<ResultadoGuardarItems> {
    // 1. La sesion debe existir, pertenecer al evento y ser del usuario.
    const sesion = await this.cargas.buscarSesionPorId(entrada.sesionId);
    if (sesion === null || sesion.eventoCargaId !== entrada.eventoId) {
      return { exito: false, motivo: 'SESION_NO_ENCONTRADA' };
    }
    if (sesion.usuarioAppId !== entrada.usuarioAppId) {
      return { exito: false, motivo: 'SESION_AJENA' };
    }

    // 2. Factor de empaque de cada producto recibido.
    const factores = await this.productos.buscarFactores(
      entrada.items.map((i) => i.productoCode),
    );

    const inexistentes = entrada.items
      .filter((i) => !factores.has(i.productoCode))
      .map((i) => i.productoCode);
    if (inexistentes.length > 0) {
      return {
        exito: false,
        motivo: 'PRODUCTO_NO_ENCONTRADO',
        productos: inexistentes,
      };
    }

    // 3. Paquetes solo con factor confirmado. Sin paquetes el factor no
    //    interviene y el producto puede contarse por piezas sueltas.
    const sinFactorConfirmado = entrada.items
      .filter((i) => {
        const factor = factores.get(i.productoCode)!;
        return (
          i.paquetes > 0 &&
          (!factor.factorConfirmado || factor.piezasPorPaquete === null)
        );
      })
      .map((i) => i.productoCode);
    if (sinFactorConfirmado.length > 0) {
      return {
        exito: false,
        motivo: 'FACTOR_NO_CONFIRMADO',
        productos: sinFactorConfirmado,
      };
    }

    // 4. Total en piezas con el dominio. Un factor sin confirmar nunca se usa:
    //    ni para convertir ni para el aviso de sueltas.
    const items: ItemGuardado[] = entrada.items.map((i) => {
      const factor = factores.get(i.productoCode)!;
      const piezasPorPaquete = factor.factorConfirmado
        ? factor.piezasPorPaquete
        : null;
      return {
        productoCode: i.productoCode,
        paquetes: i.paquetes,
        sueltas: i.sueltas,
        cantidad: aPiezas(i.paquetes, i.sueltas, piezasPorPaquete),
        sueltasExcedenPaquete: sueltasExcedenPaquete(
          i.sueltas,
          piezasPorPaquete,
        ),
      };
    });

    await this.cargas.guardarItems(
      entrada.sesionId,
      items.map(({ productoCode, paquetes, sueltas, cantidad }) => ({
        productoCode,
        paquetes,
        sueltas,
        cantidad,
      })),
    );

    return { exito: true, sesion, items };
  }
}
