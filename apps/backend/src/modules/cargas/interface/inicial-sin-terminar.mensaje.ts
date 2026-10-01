import type { InicialSinTerminar } from '../application/consultas-carga.repository';
import { fechaEnPalabras } from '../domain/calendario-laboral';
import {
  etiquetaEstadoCarga,
  permiteCambioFechaDelVendedor,
  permiteCancelacionDelVendedor,
} from '../domain/estados-carga';

/**
 * Que puede hacer el vendedor con la carga que estorba. Solo se le ofrece lo
 * que de verdad puede hacer (las mismas reglas que aplican `CancelarCarga` y
 * `CambiarFechaOperativa`); si no puede ni cancelarla ni moverla, se le manda
 * con su supervisor en vez de pedirle algo que la API le va a rechazar.
 */
function queHacer(estado: InicialSinTerminar['estado']): string {
  const cancela = permiteCancelacionDelVendedor(estado);
  const cambiaFecha = permiteCambioFechaDelVendedor(estado);
  if (cancela && cambiaFecha) {
    return 'Termínala, cancélala o cámbiale la fecha antes de empezar otra.';
  }
  if (cancela) return 'Termínala o cancélala antes de empezar otra.';
  if (cambiaFecha) return 'Termínala o cámbiale la fecha antes de empezar otra.';
  return 'Tú ya no puedes cancelarla ni cambiarle la fecha: pídele a tu supervisor que la revise antes de empezar otra.';
}

/**
 * Por que no se puede empezar otra INICIAL, nombrando la que estorba con fecha
 * y estado en palabras. Sin datos (la base la rechazo por carrera y ya no se
 * encontro) no se inventa la fecha ni se sabe que puede hacer el vendedor:
 * va el mensaje generico con las dos salidas.
 */
export function mensajeInicialSinTerminar(
  carga: InicialSinTerminar | null,
): string {
  if (carga === null) {
    return 'Esta ruta ya tiene una salida sin terminar. Termínala, cancélala o cámbiale la fecha antes de empezar otra; si ya no puedes, pídeselo a tu supervisor.';
  }
  return `Esta ruta ya tiene una salida sin terminar: la del ${fechaEnPalabras(carga.fechaOperativa)}, que está ${etiquetaEstadoCarga(carga.estado)}. ${queHacer(carga.estado)}`;
}
