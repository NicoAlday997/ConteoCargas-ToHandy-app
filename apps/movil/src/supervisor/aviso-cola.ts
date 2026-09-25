/**
 * Lo que la cola debe explicar al volver del detalle: modificar o rechazar
 * saca la carga de la cola (vuelve a diferencias por resolver) y, sin aviso,
 * parecería que desapareció. Vive en memoria: solo sirve para ese regreso.
 */
export type AvisoCola =
  | { tipo: 'modificada'; ruta: string; producto: string; cantidad: string }
  | { tipo: 'rechazada'; ruta: string; productos: number };

let pendiente: AvisoCola | null = null;

export function dejarAviso(aviso: AvisoCola): void {
  pendiente = aviso;
}

/** Lo entrega una sola vez. */
export function tomarAviso(): AvisoCola | null {
  const aviso = pendiente;
  pendiente = null;
  return aviso;
}
