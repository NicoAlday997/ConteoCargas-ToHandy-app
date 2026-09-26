import type { ColorFamilia } from '../domain/colores-familia';
import type { FamiliaRepository } from './familia.repository';

/** Renglon de la pantalla "Colores de familias". */
export interface FamiliaConColor {
  familia: string;
  /** `null`: sin color asignado (el caso por omision). */
  color: ColorFamilia | null;
  productos: number;
}

const comparador = new Intl.Collator('es', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * Caso de uso: familias del catalogo activo con su color, ordenadas por
 * nombre (`GET /admin/familias`). Los productos sin familia no se listan: no
 * hay a que darle color.
 *
 * Capa de aplicacion: solo depende del puerto.
 */
export class ListarFamiliasUseCase {
  constructor(private readonly familias: FamiliaRepository) {}

  async ejecutar(): Promise<FamiliaConColor[]> {
    const [familias, colores] = await Promise.all([
      this.familias.listarFamilias(),
      this.familias.listarColores(),
    ]);
    return familias
      .map(({ familia, productos }) => ({
        familia,
        color: colores.get(familia) ?? null,
        productos,
      }))
      .sort((a, b) => comparador.compare(a.familia, b.familia));
  }
}
