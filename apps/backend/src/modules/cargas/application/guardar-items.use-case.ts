import { aPiezas, sueltasExcedenPaquete } from '../domain/conversion-empaque';
import type {
  CapturaGuardada,
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
 * Trazabilidad del modo sin conexion: cada item puede traer `capturadoEn`
 * (hora del dispositivo) y se sella `recibidoEn` (hora del servidor). Como la
 * app reenvia la sesion completa en cada guardado, `recibidoEn` solo se mueve
 * cuando el item cambia; si llega identico conserva la fecha de su primera
 * llegada. Si no, cada reenvio borraria la evidencia de cuando llego.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos.
 */

export interface ItemRecibido {
  productoCode: string;
  paquetes: number;
  sueltas: number;
  /** Hora del dispositivo al capturar. No se valida contra el reloj del servidor: la diferencia ES el dato. */
  capturadoEn?: Date;
}

export interface EntradaGuardarItems {
  eventoId: string;
  sesionId: string;
  /** Id del usuario de la app que guarda (viaja en el JWT). */
  usuarioAppId: string;
  items: ItemRecibido[];
  /** Instante de llegada (el controlador pasa `new Date()`). */
  recibidoEn: Date;
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

    // 4. Lo ya guardado, para no mover `recibidoEn` de lo que llega igual.
    const previos = new Map<string, CapturaGuardada>(
      (await this.cargas.listarCapturasDeSesion(entrada.sesionId)).map((c) => [
        c.productoCode,
        c,
      ]),
    );

    // 5. Total en piezas con el dominio. Un factor sin confirmar nunca se usa:
    //    ni para convertir ni para el aviso de sueltas.
    const items: ItemGuardado[] = entrada.items.map((i) => {
      const factor = factores.get(i.productoCode)!;
      const piezasPorPaquete = factor.factorConfirmado
        ? factor.piezasPorPaquete
        : null;
      const capturadoEn = i.capturadoEn ?? null;
      const previo = previos.get(i.productoCode);
      const recibidoEn =
        previo?.recibidoEn &&
        previo.paquetes === i.paquetes &&
        previo.sueltas === i.sueltas &&
        previo.capturadoEn?.getTime() === capturadoEn?.getTime()
          ? previo.recibidoEn
          : entrada.recibidoEn;
      return {
        productoCode: i.productoCode,
        paquetes: i.paquetes,
        sueltas: i.sueltas,
        cantidad: aPiezas(i.paquetes, i.sueltas, piezasPorPaquete),
        capturadoEn,
        recibidoEn,
        sueltasExcedenPaquete: sueltasExcedenPaquete(
          i.sueltas,
          piezasPorPaquete,
        ),
      };
    });

    await this.cargas.guardarItems(
      entrada.sesionId,
      items.map(
        ({
          productoCode,
          paquetes,
          sueltas,
          cantidad,
          capturadoEn,
          recibidoEn,
        }) => ({
          productoCode,
          paquetes,
          sueltas,
          cantidad,
          capturadoEn,
          recibidoEn,
        }),
      ),
    );

    return { exito: true, sesion, items };
  }
}
