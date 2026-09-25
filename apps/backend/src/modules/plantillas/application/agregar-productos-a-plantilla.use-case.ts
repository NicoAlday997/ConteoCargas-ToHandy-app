import { normalizarCodigos } from '../domain/politica-plantillas';
import type { PlantillaRepository } from './plantilla.repository';

export type ResultadoAgregarProductos =
  | { exito: true; agregados: number; yaEstaban: number }
  | { exito: false; motivo: 'PLANTILLA_NO_ENCONTRADA' }
  | { exito: false; motivo: 'PRODUCTOS_NO_ENCONTRADOS'; codes: string[] };

/**
 * Caso de uso: agrega varios productos a una plantilla de una vez (cuando
 * entra un producto nuevo a Handy, alguien tiene que agregarlo o el vendedor
 * nunca lo vera).
 *
 * Todo o nada frente a codigos desconocidos: si alguno no existe en el
 * catalogo no se agrega ninguno, asi la app no queda con una seleccion a
 * medias sin saber cual entro. Los que ya estaban en la plantilla se ignoran
 * (agregar dos veces no duplica) y se reportan en `yaEstaban`.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class AgregarProductosAPlantillaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(
    plantillaId: string,
    codes: readonly string[],
  ): Promise<ResultadoAgregarProductos> {
    const plantilla = await this.plantillas.buscarPorId(plantillaId);
    if (plantilla === null) {
      return { exito: false, motivo: 'PLANTILLA_NO_ENCONTRADA' };
    }

    const pedidos = normalizarCodigos(codes);
    const existentes = await this.plantillas.buscarCodigosExistentes(pedidos);
    const desconocidos = pedidos.filter((c) => !existentes.has(c));
    if (desconocidos.length > 0) {
      return {
        exito: false,
        motivo: 'PRODUCTOS_NO_ENCONTRADOS',
        codes: desconocidos,
      };
    }

    const agregados = await this.plantillas.agregarProductos(
      plantillaId,
      pedidos,
    );
    return { exito: true, agregados, yaEstaban: pedidos.length - agregados };
  }
}
