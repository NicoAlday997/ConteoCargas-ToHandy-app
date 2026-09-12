import { compararConteos } from '../domain/comparar-conteos';
import { puedeTransicionar } from '../domain/estados-carga';
import type {
  CargaRepository,
  Discrepancia,
  EventoCarga,
  SesionConteo,
} from './carga.repository';

/**
 * Caso de uso: el vendedor o el contador cierra su sesion de conteo
 * (docs/04 `POST /eventos-carga/:id/sesiones/:sesionId/finalizar`).
 *
 * - La primera sesion que se cierra deja el evento `EN_ESPERA_CONTADOR`.
 * - Al cerrarse la segunda, se dispara la comparacion automatica (RF-14): el
 *   evento pasa por `EN_COMPARACION`, se guardan las discrepancias y termina en
 *   `EN_ESPERA_AUTORIZACION` (todo coincidio) o `CONFLICTOS_PENDIENTES` (hubo
 *   diferencias). Ni siquiera cuando todo coincide se envia directo: el
 *   supervisor sigue siendo el tercer par de ojos que autoriza el envio.
 *
 * TODA transicion de estado se valida antes con `puedeTransicionar` del dominio:
 * el caso de uso nunca fuerza un salto que la maquina de estados no permita.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

export type ResultadoFinalizarSesion =
  | {
      exito: true;
      evento: EventoCarga;
      sesion: SesionConteo;
      /** Discrepancias del evento tras la comparacion; `[]` si aun no aplica. */
      discrepancias: Discrepancia[];
    }
  | {
      exito: false;
      motivo:
        | 'SESION_NO_ENCONTRADA'
        | 'SESION_AJENA'
        | 'TRANSICION_INVALIDA'
        | 'ESTADO_INCONSISTENTE';
    };

export class FinalizarSesionUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    sesionId: string,
    usuarioAppId: string,
    ahora: Date,
  ): Promise<ResultadoFinalizarSesion> {
    const sesion = await this.cargas.buscarSesionPorId(sesionId);
    if (sesion === null) {
      return { exito: false, motivo: 'SESION_NO_ENCONTRADA' };
    }

    // Solo el dueño de la sesion puede cerrarla.
    if (sesion.usuarioAppId !== usuarioAppId) {
      return { exito: false, motivo: 'SESION_AJENA' };
    }

    await this.cargas.finalizarSesion(sesionId, ahora);

    const evento = await this.cargas.buscarEventoPorId(sesion.eventoCargaId);
    if (evento === null) {
      return { exito: false, motivo: 'ESTADO_INCONSISTENTE' };
    }

    const sesiones = await this.cargas.listarSesionesDeEvento(
      sesion.eventoCargaId,
    );
    const cerradas = sesiones.filter((s) => s.estado === 'CERRADA');

    // --- Caso 1: es la primera (o unica) sesion cerrada del evento. -----------
    if (cerradas.length <= 1) {
      const avanzado = await this.transicionar(evento, 'EN_ESPERA_CONTADOR');
      if (avanzado === null) {
        return { exito: false, motivo: 'TRANSICION_INVALIDA' };
      }
      return {
        exito: true,
        evento: avanzado,
        sesion: await this.recargarSesion(sesionId),
        discrepancias: [],
      };
    }

    // --- Caso 2: ya hay dos sesiones cerradas -> comparacion automatica. ------
    const enComparacion = await this.transicionar(evento, 'EN_COMPARACION');
    if (enComparacion === null) {
      return { exito: false, motivo: 'TRANSICION_INVALIDA' };
    }

    const sesionVendedor = sesiones.find((s) => s.tipo === 'VENDEDOR');
    const sesionSegundoConteo = sesiones.find(
      (s) => s.estado === 'CERRADA' && s.id !== sesionVendedor?.id,
    );
    if (sesionVendedor === undefined || sesionSegundoConteo === undefined) {
      return { exito: false, motivo: 'ESTADO_INCONSISTENTE' };
    }

    const itemsVendedor = await this.cargas.listarItemsDeSesion(
      sesionVendedor.id,
    );
    const itemsSegundoConteo = await this.cargas.listarItemsDeSesion(
      sesionSegundoConteo.id,
    );

    const comparacion = compararConteos(itemsVendedor, itemsSegundoConteo);
    await this.cargas.guardarDiscrepancias(
      enComparacion.id,
      comparacion.discrepancias.map((d) => ({
        productoCode: d.productoCode,
        cantidadVendedorOriginal: d.cantidadA,
        cantidadContadorOriginal: d.cantidadB,
      })),
    );

    const destino = comparacion.coinciden
      ? 'EN_ESPERA_AUTORIZACION'
      : 'CONFLICTOS_PENDIENTES';
    const cerrado = await this.transicionar(enComparacion, destino);
    if (cerrado === null) {
      return { exito: false, motivo: 'TRANSICION_INVALIDA' };
    }

    return {
      exito: true,
      evento: cerrado,
      sesion: await this.recargarSesion(sesionId),
      discrepancias: await this.cargas.listarDiscrepancias(cerrado.id),
    };
  }

  /**
   * Cambia el estado del evento SOLO si la maquina de estados del dominio lo
   * permite. Devuelve el evento actualizado, o `null` si la transicion es
   * invalida.
   */
  private async transicionar(
    evento: EventoCarga,
    destino: EventoCarga['estado'],
  ): Promise<EventoCarga | null> {
    if (!puedeTransicionar(evento.estado, destino)) {
      return null;
    }
    return this.cargas.cambiarEstado(evento.id, destino);
  }

  /** Relee la sesion recien cerrada para devolverla con su estado final. */
  private async recargarSesion(sesionId: string): Promise<SesionConteo> {
    const sesion = await this.cargas.buscarSesionPorId(sesionId);
    if (sesion === null) {
      throw new Error(
        `FinalizarSesionUseCase: la sesion ${sesionId} desaparecio tras cerrarla`,
      );
    }
    return sesion;
  }
}
