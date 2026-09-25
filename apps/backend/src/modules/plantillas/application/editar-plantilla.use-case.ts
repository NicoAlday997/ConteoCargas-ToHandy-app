import { claveNombre, puedeDesactivar } from '../domain/politica-plantillas';
import type {
  DatosActualizarPlantilla,
  Plantilla,
  PlantillaRepository,
} from './plantilla.repository';

export type MotivoRechazoEditarPlantilla =
  'PLANTILLA_NO_ENCONTRADA' | 'NOMBRE_DUPLICADO' | 'PLANTILLA_EN_USO';

export type ResultadoEditarPlantilla =
  | { exito: true; plantilla: Plantilla }
  | { exito: false; motivo: MotivoRechazoEditarPlantilla };

/**
 * Caso de uso: renombrar, cambiar la descripcion, activar o desactivar una
 * plantilla (PATCH parcial: solo se toca lo que viene).
 *
 * - `NOMBRE_DUPLICADO`: el nombre nuevo choca con el de otra plantilla (ver
 *   `CrearPlantillaUseCase`). Renombrarla a su propio nombre no es duplicado.
 * - `PLANTILLA_EN_USO`: se intenta desactivar una plantilla que alguna ruta
 *   usa hoy. Reactivar no tiene restriccion.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class EditarPlantillaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(
    id: string,
    datos: DatosActualizarPlantilla,
  ): Promise<ResultadoEditarPlantilla> {
    const existente = await this.plantillas.buscarPorId(id);
    if (existente === null) {
      return { exito: false, motivo: 'PLANTILLA_NO_ENCONTRADA' };
    }

    if (datos.nombre !== undefined) {
      const clave = claveNombre(datos.nombre);
      const otras = await this.plantillas.listarNombres();
      if (otras.some((p) => p.id !== id && claveNombre(p.nombre) === clave)) {
        return { exito: false, motivo: 'NOMBRE_DUPLICADO' };
      }
    }

    // Solo cuando realmente se apaga: desactivar una ya inactiva no cambia nada.
    if (datos.activa === false && existente.activa) {
      const rutas = await this.plantillas.listarRutasVigentes(id);
      const politica = puedeDesactivar(rutas.length);
      if (!politica.permitido) {
        return { exito: false, motivo: politica.motivo };
      }
    }

    const plantilla = await this.plantillas.actualizar(id, datos);
    return { exito: true, plantilla };
  }
}
