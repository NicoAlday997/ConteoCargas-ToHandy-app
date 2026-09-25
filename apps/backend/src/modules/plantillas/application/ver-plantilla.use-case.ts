import {
  agruparPorFamilia,
  type GrupoFamilia,
} from '../domain/politica-plantillas';
import type {
  Plantilla,
  PlantillaRepository,
  ProductoDePlantilla,
  RutaDePlantilla,
} from './plantilla.repository';

export interface DetallePlantilla extends Plantilla {
  totalProductos: number;
  rutas: RutaDePlantilla[];
  /** Mismo orden que el grid de conteo: el supervisor ve lo que vera el vendedor. */
  familias: GrupoFamilia<ProductoDePlantilla>[];
}

export type ResultadoVerPlantilla =
  | { exito: true; plantilla: DetallePlantilla }
  | { exito: false; motivo: 'PLANTILLA_NO_ENCONTRADA' };

/**
 * Caso de uso: detalle de una plantilla con sus productos agrupados por
 * familia y las rutas que la usan hoy. Lo usan tambien las mutaciones para
 * devolver el recurso completo (docs/04 §1.7).
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class VerPlantillaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(id: string): Promise<ResultadoVerPlantilla> {
    const plantilla = await this.plantillas.buscarPorId(id);
    if (plantilla === null) {
      return { exito: false, motivo: 'PLANTILLA_NO_ENCONTRADA' };
    }

    const [productos, rutas] = await Promise.all([
      this.plantillas.listarProductos(id),
      this.plantillas.listarRutasVigentes(id),
    ]);

    return {
      exito: true,
      plantilla: {
        ...plantilla,
        totalProductos: productos.length,
        rutas,
        familias: agruparPorFamilia(productos),
      },
    };
  }
}
