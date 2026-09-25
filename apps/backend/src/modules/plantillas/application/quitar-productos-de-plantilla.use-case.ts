import { normalizarCodigos } from '../domain/politica-plantillas';
import type { PlantillaRepository } from './plantilla.repository';

export type ResultadoQuitarProductos =
  | { exito: true; quitados: number }
  | { exito: false; motivo: 'PLANTILLA_NO_ENCONTRADA' };

/**
 * Caso de uso: quita varios productos de una plantilla de una vez. Los que no
 * estaban se ignoran.
 *
 * No toca ninguna carga ya creada: el evento guarda su `plantillaId` como
 * snapshot y los conteos historicos se leen de sus propios items, no de la
 * plantilla. Una carga en curso que ya conto el producto lo sigue mostrando
 * en su grid (`ListarProductosDePlantillaUseCase`); solo las cargas nuevas
 * dejan de verlo.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class QuitarProductosDePlantillaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(
    plantillaId: string,
    codes: readonly string[],
  ): Promise<ResultadoQuitarProductos> {
    const plantilla = await this.plantillas.buscarPorId(plantillaId);
    if (plantilla === null) {
      return { exito: false, motivo: 'PLANTILLA_NO_ENCONTRADA' };
    }

    const quitados = await this.plantillas.quitarProductos(
      plantillaId,
      normalizarCodigos(codes),
    );
    return { exito: true, quitados };
  }
}
