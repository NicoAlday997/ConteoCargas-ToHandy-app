/**
 * Quién puede confirmar una cantidad final, sin React. Funciones puras.
 *
 * La confirmación cruzada tiene dos modalidades que conviven:
 * - Entre dispositivos: cada quien entra a la carga desde su propio teléfono.
 * - En el mismo dispositivo: quien tiene la sesión pasa el teléfono; la otra
 *   persona elige su nombre y teclea SU PIN.
 * En las dos la regla es la misma, y el servidor la valida igual: quien
 * confirma nunca es quien capturó.
 */

/** Una persona que contó en la carga. */
export interface Participante {
  id: string;
  nombre: string;
  /** 'VENDEDOR' | 'CONTADOR'… (el tipo de sesión con que contó). */
  tipoSesion: string | null;
}

/**
 * A quién se ofrece "¿Quién confirma?" en este teléfono: las personas que
 * contaron la carga menos quien capturó la cantidad. Primero quien tiene la
 * sesión (si puede), así el caso más común queda elegido sin buscarlo.
 */
export function candidatosConfirmar(
  participantes: readonly Participante[],
  capturadaPor: string | null,
  usuarioSesionId: string | null,
): Participante[] {
  const candidatos = participantes.filter((p) => p.id !== capturadaPor);
  const propio = candidatos.find((p) => p.id === usuarioSesionId);
  return propio ? [propio, ...candidatos.filter((p) => p !== propio)] : candidatos;
}

/**
 * Quién queda elegido al abrir la confirmación: quien tiene la sesión si
 * puede confirmar; si no, la única otra persona posible. Con varias, nadie:
 * que la persona se elija a sí misma.
 */
export function confirmadorInicial(candidatos: readonly Participante[], usuarioSesionId: string | null): string | null {
  if (candidatos.some((p) => p.id === usuarioSesionId)) return usuarioSesionId;
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/** "Juan Pérez" → "Juan": en botones y avisos cabe y se reconoce. */
export function nombreCorto(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}
