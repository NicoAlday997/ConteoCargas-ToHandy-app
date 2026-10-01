/**
 * Candado de la sincronizacion con Handy: entre una sincronizacion y la
 * siguiente deben pasar al menos 2 minutos.
 *
 * Por que: el boton esta en el inicio de los tres roles y hay once
 * dispositivos. Sin candado, alguien ansioso (o varios a la vez a las 6 de la
 * mañana) golpea la API de Handy decenas de veces por minuto, cada vez
 * recorriendo todas las paginas del catalogo. El catalogo no cambia tan
 * rapido: dos minutos bastan para que la segunda persona vea lo mismo que
 * acaba de traer la primera.
 *
 * Es GLOBAL, no por usuario: lo que se protege es Handy, y a Handy le da igual
 * quien pregunte. Cuenta desde que la ultima EMPEZO (no desde que termino):
 * una corrida en curso ya bloquea a la siguiente. Tambien cuenta la corrida
 * automatica de las 5:00 y las que fallaron: un intento fallido tambien pego
 * contra Handy.
 */

export const VENTANA_CANDADO_MS = 2 * 60 * 1000;

export type ResultadoCandado =
  | { libre: true }
  | {
      libre: false;
      /** Desde cuando se puede volver a intentar. */
      reintentarEn: Date;
    };

/** `ultimaIniciadaEn`: inicio de la sincronizacion mas reciente; `null` si nunca hubo. */
export function evaluarCandado(
  ultimaIniciadaEn: Date | null,
  ahora: Date,
): ResultadoCandado {
  if (ultimaIniciadaEn === null) return { libre: true };
  const reintentarEn = new Date(
    ultimaIniciadaEn.getTime() + VENTANA_CANDADO_MS,
  );
  // Un reloj que retrocede (la ultima "en el futuro") tambien bloquea: es mas
  // seguro esperar dos minutos que dejar pasar una rafaga.
  return ahora.getTime() >= reintentarEn.getTime()
    ? { libre: true }
    : { libre: false, reintentarEn };
}
