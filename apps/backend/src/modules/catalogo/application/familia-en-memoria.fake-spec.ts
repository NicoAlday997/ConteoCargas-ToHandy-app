import type { ColorFamilia } from '../domain/colores-familia';
import type {
  FamiliaDelCatalogo,
  FamiliaRepository,
} from './familia.repository';

/**
 * Doble en memoria de `FamiliaRepository` para las pruebas de los casos de
 * uso de familias. El sufijo `.fake-spec.ts` lo deja fuera del build sin que
 * jest lo corra como prueba.
 */
export class FamiliaEnMemoria implements FamiliaRepository {
  /** Familia de cada producto activo (`null` = sin familia). */
  productos: Array<string | null> = [];
  readonly colores = new Map<
    string,
    { color: ColorFamilia; asignadoPorId: string }
  >();

  async listarFamilias(): Promise<FamiliaDelCatalogo[]> {
    const conteo = new Map<string, number>();
    for (const familia of this.productos) {
      if (familia === null) continue;
      conteo.set(familia, (conteo.get(familia) ?? 0) + 1);
    }
    return [...conteo].map(([familia, productos]) => ({ familia, productos }));
  }

  async listarColores(): Promise<Map<string, ColorFamilia>> {
    return new Map([...this.colores].map(([f, { color }]) => [f, color]));
  }

  async existeFamilia(familia: string): Promise<boolean> {
    return this.productos.includes(familia);
  }

  async asignarColor(
    familia: string,
    color: ColorFamilia,
    asignadoPorId: string,
  ): Promise<void> {
    this.colores.set(familia, { color, asignadoPorId });
  }

  async quitarColor(familia: string): Promise<void> {
    this.colores.delete(familia);
  }
}
