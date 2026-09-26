import {
  esColorFamiliaValido,
  type ColorFamilia,
} from '../domain/colores-familia';
import type { FamiliaRepository } from './familia.repository';

export type ResultadoAsignarColorFamilia =
  | { exito: true; familia: string; color: ColorFamilia | null }
  | { exito: false; motivo: 'COLOR_INVALIDO' | 'FAMILIA_NO_ENCONTRADA' };

/**
 * Caso de uso: el supervisor asigna un color de la paleta cerrada a una
 * familia, o lo quita con `color: null`
 * (`PUT /admin/familias/:familia/color`).
 *
 * Solo familias que existen en el catalogo activo: un color de una familia
 * que no existe nunca se veria y ensucia la tabla. Quitar el color de una
 * familia que no tenia no es error (idempotente).
 *
 * Capa de aplicacion: solo depende del puerto.
 */
export class AsignarColorFamiliaUseCase {
  constructor(private readonly familias: FamiliaRepository) {}

  async ejecutar(entrada: {
    familia: string;
    color: string | null;
    asignadoPorId: string;
  }): Promise<ResultadoAsignarColorFamilia> {
    const { familia, color, asignadoPorId } = entrada;
    if (color !== null && !esColorFamiliaValido(color)) {
      return { exito: false, motivo: 'COLOR_INVALIDO' };
    }
    if (!(await this.familias.existeFamilia(familia))) {
      return { exito: false, motivo: 'FAMILIA_NO_ENCONTRADA' };
    }

    if (color === null) {
      await this.familias.quitarColor(familia);
    } else {
      await this.familias.asignarColor(familia, color, asignadoPorId);
    }
    return { exito: true, familia, color };
  }
}
