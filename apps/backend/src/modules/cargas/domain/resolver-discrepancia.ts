/**
 * Resolucion de discrepancias entre dos conteos (RF-15; regla de negocio 3 de
 * `docs/01-definicion-y-requisitos.md` seccion 6). Funciones puras: sin Prisma,
 * sin HTTP, sin NestJS, sin `new Date()` ni nada del entorno.
 *
 * La regla que da sentido a este modulo: ningun producto puede quedar resuelto
 * sin la confirmacion cruzada de una segunda persona. Una persona captura la
 * cantidad final acordada; otra persona, obligatoriamente distinta, la confirma
 * con su propio PIN. Cualquier intento de autoconfirmacion se rechaza — es LA
 * regla del sistema y no admite excepciones.
 *
 * Como en `comparar-conteos.ts`, "primer" y "segundo" conteo son neutrales: hoy
 * son vendedor y contador; en preventa seran bodeguero y repartidor. Este modulo
 * no asume quien es quien, solo que `capturadaPorId` y `confirmadaPorId` deben
 * ser personas diferentes.
 */

export interface EstadoDiscrepancia {
  productoCode: string;
  /** Cantidad reportada en el primer conteo independiente. */
  cantidadPrimerConteo: number;
  /** Cantidad reportada en el segundo conteo independiente. */
  cantidadSegundoConteo: number;
  /** Cantidad final acordada. Ausente hasta que alguien la captura. */
  cantidadFinal?: number;
  /** Id de la persona que capturo la cantidad final. */
  capturadaPorId?: string;
  /** Id de la persona (distinta) que confirmo la cantidad final. */
  confirmadaPorId?: string;
}

export type MotivoRechazo =
  | 'AUTOCONFIRMACION_PROHIBIDA'
  | 'NO_HAY_CAPTURA_PREVIA'
  | 'YA_CONFIRMADA'
  | 'CANTIDAD_INVALIDA';

/**
 * Union discriminada por `exito`. En caso de exito devuelve un estado nuevo
 * (nunca el recibido); en caso de rechazo devuelve el motivo, sin tocar el
 * estado.
 */
export type ResultadoResolucion =
  | { exito: true; estado: EstadoDiscrepancia }
  | { exito: false; motivo: MotivoRechazo };

/**
 * Paso 1 de la resolucion: una persona captura la cantidad final acordada.
 *
 * - Rechaza `CANTIDAD_INVALIDA` si `cantidadFinal` no es un entero >= 0
 *   (incluye negativos, decimales, `NaN` e `Infinity`).
 * - Rechaza `YA_CONFIRMADA` si la discrepancia ya quedo confirmada: recapturar
 *   sobre algo cerrado obligaria a una segunda confirmacion que se perderia.
 * - En exito devuelve el estado con `cantidadFinal` y `capturadaPorId` puestos.
 *   Se permite recapturar mientras no exista confirmacion (corregir un error de
 *   dedo antes de que la otra persona confirme).
 *
 * No muta `estado`.
 */
export function capturarCantidadFinal(
  estado: EstadoDiscrepancia,
  cantidadFinal: number,
  usuarioId: string,
): ResultadoResolucion {
  if (!Number.isInteger(cantidadFinal) || cantidadFinal < 0) {
    return { exito: false, motivo: 'CANTIDAD_INVALIDA' };
  }
  if (estado.confirmadaPorId !== undefined) {
    return { exito: false, motivo: 'YA_CONFIRMADA' };
  }
  return {
    exito: true,
    estado: { ...estado, cantidadFinal, capturadaPorId: usuarioId },
  };
}

/**
 * Paso 2 de la resolucion: una segunda persona confirma la cantidad capturada.
 *
 * El orden de las validaciones es intencional:
 * 1. `NO_HAY_CAPTURA_PREVIA` si nadie capturo todavia.
 * 2. `AUTOCONFIRMACION_PROHIBIDA` si `usuarioId` es quien capturo. Confirmacion
 *    cruzada obligatoria: la misma persona no cierra su propia captura.
 * 3. `YA_CONFIRMADA` si ya existe `confirmadaPorId`.
 *
 * En exito devuelve el estado con `confirmadaPorId` puesto. No muta `estado`.
 */
export function confirmarCantidadFinal(
  estado: EstadoDiscrepancia,
  usuarioId: string,
): ResultadoResolucion {
  if (estado.capturadaPorId === undefined) {
    return { exito: false, motivo: 'NO_HAY_CAPTURA_PREVIA' };
  }
  if (estado.capturadaPorId === usuarioId) {
    return { exito: false, motivo: 'AUTOCONFIRMACION_PROHIBIDA' };
  }
  if (estado.confirmadaPorId !== undefined) {
    return { exito: false, motivo: 'YA_CONFIRMADA' };
  }
  return {
    exito: true,
    estado: { ...estado, confirmadaPorId: usuarioId },
  };
}

/**
 * Una cantidad final es atipica cuando no coincide con ninguno de los dos
 * conteos originales: si el vendedor conto 10, el contador 12 y acordaron 15,
 * algo no cuadra. Segun `docs/05-estrategia-pruebas.md` esto debe generar una
 * alerta de urgencia media.
 *
 * Devuelve `false` mientras no haya `cantidadFinal` capturada: no hay nada que
 * clasificar todavia.
 */
export function esCantidadAtipica(estado: EstadoDiscrepancia): boolean {
  if (estado.cantidadFinal === undefined) {
    return false;
  }
  return (
    estado.cantidadFinal !== estado.cantidadPrimerConteo &&
    estado.cantidadFinal !== estado.cantidadSegundoConteo
  );
}

/**
 * `true` solo si cada discrepancia tiene `cantidadFinal`, `capturadaPorId` y
 * `confirmadaPorId`. Al resolverse todas, la carga puede pasar a
 * `LISTA_PARA_ENVIAR` (RF-16).
 *
 * Una lista vacia devuelve `true` de forma vacua: una carga sin discrepancias no
 * tiene nada pendiente de resolver.
 */
export function todasResueltas(discrepancias: EstadoDiscrepancia[]): boolean {
  return discrepancias.every(
    (d) =>
      typeof d.cantidadFinal === 'number' &&
      d.capturadaPorId !== undefined &&
      d.confirmadaPorId !== undefined,
  );
}
