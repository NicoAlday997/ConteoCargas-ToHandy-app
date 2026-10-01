import type { InicialSinTerminar } from '../application/consultas-carga.repository';
import { fechaEnPalabras } from '../domain/calendario-laboral';
import { etiquetaEstadoCarga } from '../domain/estados-carga';

/**
 * Por que no se puede empezar otra INICIAL, nombrando la que estorba con fecha
 * y estado en palabras. Sin datos (la base la rechazo por carrera y ya no se
 * encontro) no se inventa la fecha: va el mensaje generico.
 */
export function mensajeInicialSinTerminar(
  carga: InicialSinTerminar | null,
): string {
  if (carga === null) {
    return 'Esta ruta ya tiene una salida sin terminar. Termínala, cancélala o cámbiale la fecha antes de empezar otra.';
  }
  return `Esta ruta ya tiene una salida sin terminar: la del ${fechaEnPalabras(carga.fechaOperativa)}, que está ${etiquetaEstadoCarga(carga.estado)}. Termínala, cancélala o cámbiale la fecha antes de empezar otra.`;
}
