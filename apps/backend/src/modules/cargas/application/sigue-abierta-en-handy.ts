import {
  esHandyNoDisponible,
  type HandyGateway,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';

/**
 * `true` si la ruta que Handy tiene abierta para el vendedor es la de la
 * inicial (`idHandyInicial`), o si Handy no se pudo consultar: no se bloquea al
 * vendedor por la caida de un tercero; el envio dira la ultima palabra.
 *
 * La comparten `IniciarCargaUseCase` y `CambiarFechaOperativaUseCase`: una
 * RECARGA debe cumplir la misma regla al nacer y al moverse de dia.
 */
export async function sigueAbiertaEnHandy(
  handy: Pick<HandyGateway, 'consultarRutaAbierta'>,
  usuarioHandyId: number,
  idHandyInicial: string | null,
): Promise<boolean> {
  let rutaAbierta: RutaHandy | null;
  try {
    rutaAbierta = await handy.consultarRutaAbierta(usuarioHandyId);
  } catch (error) {
    if (esHandyNoDisponible(error)) return true;
    throw error;
  }
  return rutaAbierta !== null && rutaAbierta.id === idHandyInicial;
}
