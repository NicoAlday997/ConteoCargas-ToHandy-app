/**
 * Candado de la sincronizacion con Handy: entre una sincronizacion y la
 * siguiente deben pasar al menos 2 minutos... salvo que la anterior haya
 * FALLADO, en cuyo caso bastan 20 segundos.
 *
 * Por que: el boton esta en el inicio de los tres roles y hay once
 * dispositivos. Sin candado, alguien ansioso (o varios a la vez a las 6 de la
 * mañana) golpea la API de Handy decenas de veces por minuto, cada vez
 * recorriendo todas las paginas del catalogo. El catalogo no cambia tan
 * rapido: dos minutos bastan para que la segunda persona vea lo mismo que
 * acaba de traer la primera.
 *
 * Si la anterior fallo (Handy caido, token invalido, red) no trajo nada: no
 * hay "lo mismo que acaba de traer" que ver, y castigar dos minutos por una
 * falla ajena no protege nada. Los 20 segundos solo evitan el bucle de quien
 * pulsa sin parar contra un Handy que no responde. El motivo distingue los dos
 * casos para que el mensaje no diga "alguien acaba de sincronizar" cuando no
 * se sincronizo nada.
 *
 * Es GLOBAL, no por usuario: lo que se protege es Handy, y a Handy le da igual
 * quien pregunte. Cuenta desde que la ultima EMPEZO (no desde que termino):
 * una corrida en curso (`exito` aun `null`) ya bloquea a la siguiente con la
 * ventana completa. Tambien cuenta la corrida automatica de las 5:00.
 */

export const VENTANA_CANDADO_MS = 2 * 60 * 1000;
export const VENTANA_CANDADO_TRAS_FALLO_MS = 20 * 1000;

/** La sincronizacion mas reciente, tal como quedo en la bitacora. */
export interface UltimaSincronizacion {
  iniciadaEn: Date;
  /** `null` mientras sigue en curso (o si el proceso murio sin cerrarla). */
  exito: boolean | null;
}

export type MotivoCandado =
  /** La anterior salio bien (o sigue en curso): ya hay datos frescos. */
  | 'SINCRONIZACION_RECIENTE'
  /** La anterior fallo: no se sincronizo nada, solo hay que esperar un poco. */
  | 'SINCRONIZACION_FALLIDA_RECIENTE';

export type ResultadoCandado =
  | { libre: true }
  | {
      libre: false;
      motivo: MotivoCandado;
      /** Desde cuando se puede volver a intentar. */
      reintentarEn: Date;
    };

/** `ultima`: la sincronizacion mas reciente; `null` si nunca hubo. */
export function evaluarCandado(
  ultima: UltimaSincronizacion | null,
  ahora: Date,
): ResultadoCandado {
  if (ultima === null) return { libre: true };
  const fallo = ultima.exito === false;
  const reintentarEn = new Date(
    ultima.iniciadaEn.getTime() +
      (fallo ? VENTANA_CANDADO_TRAS_FALLO_MS : VENTANA_CANDADO_MS),
  );
  // Un reloj que retrocede (la ultima "en el futuro") tambien bloquea: es mas
  // seguro esperar que dejar pasar una rafaga.
  return ahora.getTime() >= reintentarEn.getTime()
    ? { libre: true }
    : {
        libre: false,
        motivo: fallo
          ? 'SINCRONIZACION_FALLIDA_RECIENTE'
          : 'SINCRONIZACION_RECIENTE',
        reintentarEn,
      };
}
