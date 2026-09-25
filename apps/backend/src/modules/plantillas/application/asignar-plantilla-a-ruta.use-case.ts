import type { PlantillaRepository } from './plantilla.repository';

export type MotivoRechazoAsignarPlantilla =
  | 'PLANTILLA_NO_ENCONTRADA'
  | 'PLANTILLA_INACTIVA'
  | 'RUTA_NO_ENCONTRADA'
  | 'RUTA_SIN_ASIGNACION_VIGENTE';

export type ResultadoAsignarPlantilla =
  | { exito: true; asignacionesActualizadas: number }
  | { exito: false; motivo: MotivoRechazoAsignarPlantilla };

/**
 * Caso de uso: la ruta pasa a usar esta plantilla. Cambia la `plantillaId` de
 * sus asignaciones vigentes (todas, si varios vendedores comparten la ruta);
 * la plantilla anterior deja de estar asignada a esa ruta.
 *
 * Solo afecta a las cargas que se inicien despues: cada evento guardo su
 * plantilla como snapshot al crearse.
 *
 * - `PLANTILLA_INACTIVA`: una plantilla desactivada no se asigna; se activa primero.
 * - `RUTA_NO_ENCONTRADA`: no existe o esta dada de baja.
 * - `RUTA_SIN_ASIGNACION_VIGENTE`: la ruta no tiene vendedor; la plantilla
 *   vive en la asignacion, asi que no hay donde guardarla.
 *
 * Capa de aplicacion: solo depende del puerto.
 */
export class AsignarPlantillaARutaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(entrada: {
    plantillaId: string;
    rutaId: string;
  }): Promise<ResultadoAsignarPlantilla> {
    const plantilla = await this.plantillas.buscarPorId(entrada.plantillaId);
    if (plantilla === null) {
      return { exito: false, motivo: 'PLANTILLA_NO_ENCONTRADA' };
    }
    if (!plantilla.activa) {
      return { exito: false, motivo: 'PLANTILLA_INACTIVA' };
    }

    const ruta = await this.plantillas.buscarRuta(entrada.rutaId);
    if (ruta === null || !ruta.activa) {
      return { exito: false, motivo: 'RUTA_NO_ENCONTRADA' };
    }

    const actualizadas = await this.plantillas.asignarARuta(
      entrada.rutaId,
      entrada.plantillaId,
    );
    if (actualizadas === 0) {
      return { exito: false, motivo: 'RUTA_SIN_ASIGNACION_VIGENTE' };
    }
    return { exito: true, asignacionesActualizadas: actualizadas };
  }
}
