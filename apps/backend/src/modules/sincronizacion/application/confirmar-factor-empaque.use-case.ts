import {
  esPiezasPorPaqueteValido,
  type ModalidadVenta,
} from '../domain/factor-empaque';
import {
  FactorEmpaqueRepository,
  type FactorProducto,
} from './factor-empaque.repository';

export interface ComandoConfirmarFactorEmpaque {
  productoCode: string;
  modalidadVenta: ModalidadVenta;
  /** Obligatorio si se vende POR_PIEZA; se ignora (queda `null`) si COMPLETO. */
  piezasPorPaquete: number | null;
  /** Supervisor que confirma; sale del JWT, nunca del body. */
  usuarioAppId: string;
  ahora: Date;
}

export type ResultadoConfirmarFactorEmpaque =
  | { exito: true; producto: FactorProducto }
  | { exito: false; motivo: 'FACTOR_INVALIDO' | 'PRODUCTO_NO_ENCONTRADO' };

/**
 * Caso de uso: un supervisor confirma (o corrige) como se vende un producto y,
 * si se vende por pieza, cuantas piezas trae el paquete. Hasta que esto
 * ocurre, el factor propuesto por la sincronizacion no es confiable (ver
 * `domain/factor-empaque.ts`).
 *
 * `COMPLETO` guarda el factor en `null` a proposito: el "c/70" de un dulce no
 * es factor, y dejarlo guardado invitaria a que alguien lo use para convertir.
 *
 * Confirmar sobrescribe cualquier valor previo, propuesto o ya confirmado, y
 * deja traza de quien y cuando. A partir de aqui la sincronizacion ya no toca
 * el factor aunque el nombre del producto cambie en Handy.
 */
export class ConfirmarFactorEmpaqueUseCase {
  constructor(private readonly factores: FactorEmpaqueRepository) {}

  async ejecutar(
    comando: ComandoConfirmarFactorEmpaque,
  ): Promise<ResultadoConfirmarFactorEmpaque> {
    const piezasPorPaquete =
      comando.modalidadVenta === 'COMPLETO' ? null : comando.piezasPorPaquete;
    if (
      comando.modalidadVenta === 'POR_PIEZA' &&
      (piezasPorPaquete === null || !esPiezasPorPaqueteValido(piezasPorPaquete))
    ) {
      return { exito: false, motivo: 'FACTOR_INVALIDO' };
    }

    const actual = await this.factores.buscarPorCode(comando.productoCode);
    if (actual === null) {
      return { exito: false, motivo: 'PRODUCTO_NO_ENCONTRADO' };
    }

    const producto = await this.factores.confirmar({
      productoCode: comando.productoCode,
      modalidadVenta: comando.modalidadVenta,
      piezasPorPaquete,
      confirmadoPorId: comando.usuarioAppId,
      fecha: comando.ahora,
    });

    return { exito: true, producto };
  }
}
