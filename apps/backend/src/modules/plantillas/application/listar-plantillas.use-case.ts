import type {
  PlantillaRepository,
  ResumenPlantilla,
} from './plantilla.repository';

/**
 * Caso de uso: lista de plantillas para el panel del supervisor, con cuantos
 * productos tiene cada una y a que rutas esta asignada.
 *
 * Por omision solo las activas. `incluirInactivas` existe para poder volver a
 * activar una: sin verla en ninguna lista, una plantilla desactivada solo se
 * recuperaria por SQL.
 *
 * Capa de aplicacion: solo depende del puerto.
 */
export class ListarPlantillasUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(
    entrada: { incluirInactivas?: boolean } = {},
  ): Promise<ResumenPlantilla[]> {
    return this.plantillas.listar(entrada.incluirInactivas ?? false);
  }
}
