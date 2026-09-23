import type { CapturaGuardada, CargaRepository } from './carga.repository';

/**
 * Caso de uso: leer lo guardado en una sesion de conteo
 * (docs/04 `GET /eventos-carga/:id/sesiones/:sesionId/items`).
 *
 * Lo usa la app al reabrir un conteo para reconciliar su copia local con el
 * servidor: como `PATCH .../items` reemplaza la sesion completa, mandar una
 * copia local incompleta (otro dispositivo, datos borrados) borraria en el
 * servidor lo ya contado.
 *
 * Solo el dueño de la sesion puede leerla: es un conteo independiente y el
 * otro contador no debe ver cifras ajenas antes de terminar el suyo.
 *
 * Capa de aplicacion: solo depende de los puertos.
 */

export type ResultadoListarItemsDeSesion =
  | { exito: true; items: CapturaGuardada[] }
  | { exito: false; motivo: 'SESION_NO_ENCONTRADA' | 'SESION_AJENA' };

export class ListarItemsDeSesionUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(entrada: {
    eventoId: string;
    sesionId: string;
    usuarioAppId: string;
  }): Promise<ResultadoListarItemsDeSesion> {
    const sesion = await this.cargas.buscarSesionPorId(entrada.sesionId);
    if (sesion === null || sesion.eventoCargaId !== entrada.eventoId) {
      return { exito: false, motivo: 'SESION_NO_ENCONTRADA' };
    }
    if (sesion.usuarioAppId !== entrada.usuarioAppId) {
      return { exito: false, motivo: 'SESION_AJENA' };
    }
    return {
      exito: true,
      items: await this.cargas.listarCapturasDeSesion(entrada.sesionId),
    };
  }
}
