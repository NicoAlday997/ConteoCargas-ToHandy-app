import type { TipoCarga } from '../api/cargas';

/**
 * Cierre del conteo. Al finalizar, el conteo vuelve al inicio; sin esto, el
 * vendedor no sabría si su conteo llegó ni qué sigue. El inicio lo toma una
 * sola vez y lo muestra como confirmación.
 */
export interface ConteoFinalizado {
  tipo: TipoCarga | null;
  /** Estado del evento que respondió el servidor al finalizar. */
  estado: string | null;
  productos: number;
}

let aviso: ConteoFinalizado | null = null;

export function avisarConteoFinalizado(datos: ConteoFinalizado): void {
  aviso = datos;
}

/** Lo entrega una sola vez. */
export function tomarAvisoConteoFinalizado(): ConteoFinalizado | null {
  const actual = aviso;
  aviso = null;
  return actual;
}

/** Qué sigue después de finalizar, según el estado en que quedó la carga. */
export function queSigue(estado: string | null): string {
  switch (estado) {
    case 'EN_ESPERA_CONTADOR':
      return 'Sigue el contador: hace su conteo sin ver el tuyo.';
    case 'EN_COMPARACION':
      return 'Se están comparando los dos conteos.';
    case 'EN_ESPERA_AUTORIZACION':
      return 'Los dos conteos coincidieron. Sigue la autorización del supervisor.';
    case 'CONFLICTOS_PENDIENTES':
      return 'Hay diferencias entre los dos conteos: se resuelven entre dos personas.';
    case 'BLOQUEADA_CORTE_PENDIENTE':
      return 'La carga espera el corte de venta pendiente de la ruta.';
    default:
      return 'Puedes seguir su avance en el historial.';
  }
}
