/**
 * Maquina de estados del evento de carga (docs/02 seccion 3.1). Funciones puras:
 * sin Prisma, sin HTTP, sin NestJS, sin `new Date()` ni nada del entorno. El
 * unico contacto con `@prisma/client` es el tipo `EstadoCarga`, importado solo
 * como tipo — en runtime se trabaja con las cadenas literales.
 *
 * Flujo (docs/02 seccion 3.1):
 *
 *   BORRADOR
 *     -> EN_ESPERA_CONTADOR
 *          -> [BLOQUEADA_CORTE_PENDIENTE] -> (se resuelve el corte) -> EN_ESPERA_CONTADOR
 *          -> EN_COMPARACION
 *               -> CONFLICTOS_PENDIENTES     (hubo discrepancias)
 *               -> EN_ESPERA_AUTORIZACION    (todo coincidio)
 *          CONFLICTOS_PENDIENTES -> EN_ESPERA_AUTORIZACION
 *          EN_ESPERA_AUTORIZACION
 *            -> LISTA_PARA_ENVIAR      (el supervisor autoriza)
 *            -> CONFLICTOS_PENDIENTES  (el supervisor rechaza productos especificos)
 *     LISTA_PARA_ENVIAR
 *       -> ENVIADA           (terminal)
 *       -> ERROR_ENVIO       -> LISTA_PARA_ENVIAR (reintento)
 *       -> ENVIO_INCIERTO    -> LISTA_PARA_ENVIAR (reintento tras GET /route/current)
 *
 * INVARIANTE CRITICA: no existe ninguna transicion que salte la verificacion.
 * BORRADOR jamas alcanza LISTA_PARA_ENVIAR ni ENVIADA — ese salto seria burlar
 * el doble conteo, que es la razon de ser del sistema (docs/01 seccion 6, regla
 * 1). Ademas, desde que se agrego EN_ESPERA_AUTORIZACION, ninguna carga llega a
 * LISTA_PARA_ENVIAR sin pasar por ahi: el doble conteo tiene un punto ciego
 * (que ambos se equivoquen igual, o se pongan de acuerdo) que solo cierra un
 * tercer par de ojos — la autorizacion explicita de un supervisor, lo haya
 * revisado fisicamente o no. El unico camino a LISTA_PARA_ENVIAR pasa por
 * EN_ESPERA_AUTORIZACION, y a esa solo se llega desde EN_COMPARACION o
 * CONFLICTOS_PENDIENTES, que a su vez solo se alcanzan desde EN_ESPERA_CONTADOR,
 * que solo se alcanza desde BORRADOR.
 *
 * CANCELACION: nunca se borra un evento; se marca CANCELADA (terminal) con
 * quien, cuando y por que. Se puede cancelar desde cualquier estado previo al
 * envio, con dos excepciones:
 *   - ENVIO_INCIERTO no cancela: no se sabe si la carga llego a Handy. Primero
 *     se resuelve la incertidumbre (vuelve a LISTA_PARA_ENVIAR) y desde ahi se
 *     cancela.
 *   - ENVIADA -> CANCELADA existe en el mapa, pero SOLO la ejecuta
 *     `CancelarRutaHandyUseCase`, despues de que Handy confirmo el
 *     `DELETE /route/{id}`. Ninguna otra via la usa: `permiteCancelacionDel*`
 *     excluyen ENVIADA, asi que `CancelarCargaUseCase` nunca la alcanza. Una
 *     carga que ya esta en Handy no se da por cancelada solo de este lado.
 * CANCELADA no rompe la invariante de arriba: es un sumidero, no lleva a
 * LISTA_PARA_ENVIAR ni a ENVIADA.
 */

import type { EstadoCarga } from '@prisma/client';

/**
 * Para cada estado, el conjunto de estados a los que puede pasar directamente.
 * Un estado con arreglo vacio es terminal. El tipo `Record<EstadoCarga, ...>`
 * fuerza que esten declarados TODOS los miembros del enum: si Prisma agrega un
 * estado nuevo y no se lista aca, el compilador falla.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoCarga, readonly EstadoCarga[]> = {
  BORRADOR: ['EN_ESPERA_CONTADOR', 'CANCELADA'],
  EN_ESPERA_CONTADOR: ['BLOQUEADA_CORTE_PENDIENTE', 'EN_COMPARACION', 'CANCELADA'],
  // El corte pendiente solo se libera volviendo a la cola del contador; nunca
  // avanza saltandose la comparacion.
  BLOQUEADA_CORTE_PENDIENTE: ['EN_ESPERA_CONTADOR', 'CANCELADA'],
  EN_COMPARACION: ['CONFLICTOS_PENDIENTES', 'EN_ESPERA_AUTORIZACION', 'CANCELADA'],
  CONFLICTOS_PENDIENTES: ['EN_ESPERA_AUTORIZACION', 'CANCELADA'],
  // El supervisor es el tercer par de ojos: autoriza (-> LISTA_PARA_ENVIAR) o
  // rechaza productos especificos, lo que reabre la resolucion de conflictos.
  EN_ESPERA_AUTORIZACION: ['LISTA_PARA_ENVIAR', 'CONFLICTOS_PENDIENTES', 'CANCELADA'],
  LISTA_PARA_ENVIAR: ['ENVIADA', 'ERROR_ENVIO', 'ENVIO_INCIERTO', 'CANCELADA'],
  // Solo via `CancelarRutaHandyUseCase`, con Handy ya cancelado (ver cabecera).
  ENVIADA: ['CANCELADA'],
  ERROR_ENVIO: ['LISTA_PARA_ENVIAR', 'CANCELADA'],
  // Sin CANCELADA a proposito: no se sabe si la carga llego a Handy.
  ENVIO_INCIERTO: ['LISTA_PARA_ENVIAR'],
  CANCELADA: [],
};

/** Todos los estados declarados, derivados del mapa de transiciones. */
export const TODOS_LOS_ESTADOS = Object.keys(TRANSICIONES_VALIDAS) as EstadoCarga[];

/**
 * `true` si `desde -> hacia` es una transicion declarada en
 * `TRANSICIONES_VALIDAS`. Un estado desconocido nunca transiciona.
 */
export function puedeTransicionar(desde: EstadoCarga, hacia: EstadoCarga): boolean {
  const alcanzables = TRANSICIONES_VALIDAS[desde];
  return alcanzables !== undefined && alcanzables.includes(hacia);
}

/**
 * Copia de los estados alcanzables directamente desde `desde` (arreglo vacio si
 * es terminal o desconocido). Se devuelve una copia para que quien la reciba no
 * pueda mutar el mapa interno.
 */
export function estadosAlcanzables(desde: EstadoCarga): EstadoCarga[] {
  return [...(TRANSICIONES_VALIDAS[desde] ?? [])];
}

/** `true` si el estado no tiene ninguna transicion de salida (CANCELADA). */
export function esTerminal(estado: EstadoCarga): boolean {
  return (TRANSICIONES_VALIDAS[estado] ?? []).length === 0;
}

/**
 * `true` si el vendedor puede registrar su conteo en este estado. Segun docs/01
 * seccion 6 regla 2, el vendedor cuenta sin restriccion incluso con corte de
 * venta anterior pendiente: el bloqueo por corte aplica solo a la verificacion
 * del contador. Deja de tener sentido una vez que la carga entro a comparacion.
 */
export function permiteConteoDelVendedor(estado: EstadoCarga): boolean {
  return (
    estado === 'BORRADOR' ||
    estado === 'EN_ESPERA_CONTADOR' ||
    estado === 'BLOQUEADA_CORTE_PENDIENTE'
  );
}

/**
 * `true` si el contador puede registrar su verificacion (segundo conteo) en este
 * estado. Solo en EN_ESPERA_CONTADOR. En BLOQUEADA_CORTE_PENDIENTE es `false`
 * por diseno (docs/02 seccion 4.5): el corte pendiente bloquea exactamente esta
 * accion.
 */
export function permiteVerificacionDelContador(estado: EstadoCarga): boolean {
  return estado === 'EN_ESPERA_CONTADOR';
}

/**
 * `true` si la carga esta esperando la autorizacion del supervisor (el tercer
 * par de ojos) antes de poder enviarse a Handy. Solo en EN_ESPERA_AUTORIZACION.
 */
export function requiereAutorizacion(estado: EstadoCarga): boolean {
  return estado === 'EN_ESPERA_AUTORIZACION';
}

/**
 * `true` si el vendedor puede cancelar su propia carga. Solo en BORRADOR: una
 * vez que finaliza su sesion la carga pasa a EN_ESPERA_CONTADOR y el contador
 * puede estar trabajando. Si el vendedor pudiera cancelar despues de que el
 * contador conto, tendria una salida para cuando el conteo no le cuadra
 * (cancelo, vuelvo a contar y ahora si coincidimos) — justo el agujero que el
 * doble conteo existe para tapar.
 */
export function permiteCancelacionDelVendedor(estado: EstadoCarga): boolean {
  return estado === 'BORRADOR';
}

/**
 * `true` si el supervisor puede cancelar la carga desde la app. Todo salvo:
 * - ENVIADA: ya esta en Handy; se cancela alla primero (`CancelarRutaHandyUseCase`).
 * - CANCELADA: ya es terminal.
 * - ENVIO_INCIERTO: no se sabe si llego a Handy; primero se resuelve.
 */
export function permiteCancelacionDelSupervisor(estado: EstadoCarga): boolean {
  return (
    estado !== 'ENVIADA' &&
    estado !== 'CANCELADA' &&
    estado !== 'ENVIO_INCIERTO' &&
    puedeTransicionar(estado, 'CANCELADA')
  );
}
