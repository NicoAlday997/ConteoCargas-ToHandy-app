/** Un motivo obligatorio: si alcanza para confirmar, y el contador que se ve bajo el campo. */
export interface EstadoMotivo {
  /** Ya se puede confirmar: el botón se habilita. */
  suficiente: boolean;
  /** «3/10» mientras falta (hacia el mínimo); «12/200» ya completo (hacia el máximo). */
  contador: string;
}

/**
 * Se cuenta sin los espacios de los extremos, igual que lo valida el servidor:
 * diez espacios no son un motivo. Mientras no llega al mínimo, el contador
 * dice cuánto falta; después, cuánto cabe.
 */
export function estadoMotivo(texto: string, minimo: number, maximo?: number): EstadoMotivo {
  const largo = texto.trim().length;
  const suficiente = largo >= minimo;
  const tope = suficiente ? maximo : minimo;
  return { suficiente, contador: tope === undefined ? String(largo) : `${largo}/${tope}` };
}
