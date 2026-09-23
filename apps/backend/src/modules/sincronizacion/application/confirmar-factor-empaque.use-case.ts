import { esPiezasPorPaqueteValido } from '../domain/factor-empaque';
import {
  FactorEmpaqueRepository,
  type FactorProducto,
} from './factor-empaque.repository';

export interface ComandoConfirmarFactorEmpaque {
  productoCode: string;
  piezasPorPaquete: number;
  /** Supervisor que confirma; sale del JWT, nunca del body. */
  usuarioAppId: string;
  ahora: Date;
}

export type ResultadoConfirmarFactorEmpaque =
  | { exito: true; producto: FactorProducto }
  | { exito: false; motivo: 'FACTOR_INVALIDO' | 'PRODUCTO_NO_ENCONTRADO' };

/**
 * Caso de uso: un supervisor confirma (o corrige) cuantas piezas trae un
 * paquete de un producto. Hasta que esto ocurre, el factor propuesto por la
 * sincronizacion no es confiable (ver `domain/factor-empaque.ts`).
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
    if (!esPiezasPorPaqueteValido(comando.piezasPorPaquete)) {
      return { exito: false, motivo: 'FACTOR_INVALIDO' };
    }

    const actual = await this.factores.buscarPorCode(comando.productoCode);
    if (actual === null) {
      return { exito: false, motivo: 'PRODUCTO_NO_ENCONTRADO' };
    }

    const producto = await this.factores.confirmar({
      productoCode: comando.productoCode,
      piezasPorPaquete: comando.piezasPorPaquete,
      confirmadoPorId: comando.usuarioAppId,
      fecha: comando.ahora,
    });

    return { exito: true, producto };
  }
}
