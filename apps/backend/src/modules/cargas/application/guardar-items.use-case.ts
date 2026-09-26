import {
  aPiezas,
  sueltasExcedenPaquete,
  type ModalidadVenta,
} from '../domain/conversion-empaque';
import type {
  CapturaGuardada,
  CargaRepository,
  ItemAGuardar,
  SesionConteo,
} from './carga.repository';
import type {
  FactorDeConteo,
  ProductoConteoRepository,
} from './producto-conteo.repository';

/**
 * Caso de uso: guardar las cantidades capturadas en una sesion de conteo
 * (docs/04 `PATCH /eventos-carga/:id/sesiones/:sesionId/items`).
 *
 * En bodega se cuentan PAQUETES y piezas sueltas; Handy recibe unidades de
 * venta. El cliente manda `paquetes` y `sueltas` por producto y el total
 * (`cantidad`) se calcula aca con `aPiezas` del dominio: nunca se recibe del
 * cliente. Un producto que se vende COMPLETO cuenta 1 a 1 (5 bolsas = 5) y
 * solo admite `paquetes`.
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
 * - `CARGA_CANCELADA`: el evento se cancelo; lo que llegue despues (p. ej. la
 *   cola offline de un telefono) no se escribe en una carga ya auditada.
 * - `PRODUCTO_NO_ENCONTRADO`: algun `productoCode` no existe en el catalogo.
 * - `FACTOR_NO_CONFIRMADO`: se mandaron paquetes de un producto cuyo factor no
 *   ha confirmado un supervisor (o que no tiene factor). Un factor sin
 *   confirmar corrompe el conteo en silencio: el doble conteo no lo detecta
 *   porque ambos conteos usarian el mismo factor.
 * - `SUELTAS_EN_PRODUCTO_COMPLETO`: se mandaron sueltas de un producto que se
 *   vende completo (el paquete no se rompe).
 *
 * Los tres ultimos traen `productos` con los codigos afectados.
 */
export type ResultadoGuardarItems =
  | { exito: true; sesion: SesionConteo; items: ItemGuardado[] }
  | {
      exito: false;
      motivo: 'SESION_NO_ENCONTRADA' | 'SESION_AJENA' | 'CARGA_CANCELADA';
    }
  | {
      exito: false;
      motivo:
        | 'PRODUCTO_NO_ENCONTRADO'
        | 'FACTOR_NO_CONFIRMADO'
        | 'SUELTAS_EN_PRODUCTO_COMPLETO';
      productos: string[];
    };

/**
 * Modalidad y factor que se pueden usar para convertir. Sin confirmar, ni la
 * modalidad ni el factor son confiables: el producto solo admite sueltas.
 */
function empaqueEfectivo(factor: FactorDeConteo): {
  modalidad: ModalidadVenta;
  piezasPorPaquete: number | null;
} {
  if (!factor.factorConfirmado) {
    return { modalidad: 'POR_PIEZA', piezasPorPaquete: null };
  }
  return {
    modalidad: factor.modalidadVenta,
    piezasPorPaquete: factor.piezasPorPaquete,
  };
}

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
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento?.estado === 'CANCELADA') {
      return { exito: false, motivo: 'CARGA_CANCELADA' };
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

    // 3. Paquetes solo con modalidad y factor confirmados. Sin paquetes el
    //    factor no interviene y el producto puede contarse por piezas sueltas.
    //    Lo que se vende completo no necesita factor: cuenta 1 a 1.
    const empaques = new Map(
      [...factores].map(([code, f]) => [code, empaqueEfectivo(f)]),
    );
    const sinFactorConfirmado = entrada.items
      .filter((i) => {
        const empaque = empaques.get(i.productoCode)!;
        return (
          i.paquetes > 0 &&
          empaque.modalidad === 'POR_PIEZA' &&
          empaque.piezasPorPaquete === null
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

    const sueltasEnCompleto = entrada.items
      .filter(
        (i) =>
          i.sueltas > 0 &&
          empaques.get(i.productoCode)!.modalidad === 'COMPLETO',
      )
      .map((i) => i.productoCode);
    if (sueltasEnCompleto.length > 0) {
      return {
        exito: false,
        motivo: 'SUELTAS_EN_PRODUCTO_COMPLETO',
        productos: sueltasEnCompleto,
      };
    }

    // 4. Lo ya guardado, para no mover `recibidoEn` de lo que llega igual.
    const previos = new Map<string, CapturaGuardada>(
      (await this.cargas.listarCapturasDeSesion(entrada.sesionId)).map((c) => [
        c.productoCode,
        c,
      ]),
    );

    // 5. Total con el dominio. Un factor sin confirmar nunca se usa: ni para
    //    convertir ni para el aviso de sueltas.
    const items: ItemGuardado[] = entrada.items.map((i) => {
      const { modalidad, piezasPorPaquete } = empaques.get(i.productoCode)!;
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
        cantidad: aPiezas(i.paquetes, i.sueltas, piezasPorPaquete, modalidad),
        capturadoEn,
        recibidoEn,
        sueltasExcedenPaquete: sueltasExcedenPaquete(
          i.sueltas,
          piezasPorPaquete,
          modalidad,
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
