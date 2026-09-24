/**
 * Estado de la resolución de discrepancias, sin React. Funciones puras.
 *
 * La regla que manda en todo el módulo (CLAUDE.md): una persona captura la
 * cantidad final y OTRA DISTINTA la confirma con su propio PIN. La app ni
 * siquiera ofrece confirmar a quien capturó; el servidor lo rechaza igual.
 */

import { factorEfectivo, seVendeCompleto, type CapturaProducto, type ProductoConteo } from '../conteo/estado-conteo';

/** Un lado de la discrepancia: lo que contó una sesión. */
export interface ConteoLado {
  /** Tipo de sesión que devuelve el backend (VENDEDOR, CONTADOR…); `null` si no llegó. */
  tipoSesion: string | null;
  piezas: number;
  /** Lo tecleado en bodega; `null` si el backend no lo tiene o ya no corresponde. */
  paquetes: number | null;
  sueltas: number | null;
}

export interface Discrepancia {
  code: string;
  /** Con la forma del conteo: reutiliza la etiqueta de factor y el teclado de cantidad. */
  producto: ProductoConteo;
  /** Se etiquetan por el rol de la sesión, nunca por nombre de persona. */
  primerConteo: ConteoLado;
  segundoConteo: ConteoLado;
  cantidadFinal: number | null;
  capturadaPor: string | null;
  capturadaPorNombre: string | null;
  confirmadaPor: string | null;
  confirmadaPorNombre: string | null;
}

export type EstadoDiscrepancia = 'sin-capturar' | 'por-confirmar' | 'confirmada';

export function estadoDe(d: Discrepancia): EstadoDiscrepancia {
  if (d.confirmadaPor !== null) return 'confirmada';
  if (d.cantidadFinal === null || d.capturadaPor === null) return 'sin-capturar';
  return 'por-confirmar';
}

/** Solo alguien distinto a quien capturó. Sin usuario conocido, nadie. */
export function puedeConfirmar(d: Discrepancia, usuarioId: string | null): boolean {
  return estadoDe(d) === 'por-confirmar' && usuarioId !== null && d.capturadaPor !== usuarioId;
}

export function diferencia(d: Discrepancia): number {
  return Math.abs(d.primerConteo.piezas - d.segundoConteo.piezas);
}

/** La cantidad final no es ninguno de los dos conteos. Dato útil, no error. */
export function esAtipica(d: Discrepancia): boolean {
  return d.cantidadFinal !== null && d.cantidadFinal !== d.primerConteo.piezas && d.cantidadFinal !== d.segundoConteo.piezas;
}

/**
 * El rol orienta sin acusar: "el contador puso menos" habla de un conteo;
 * con el nombre sería una acusación. En preventa los tipos serán bodeguero y
 * repartidor: se toman del backend, no se asumen.
 */
const ROLES: Record<string, string> = {
  VENDEDOR: 'Vendedor',
  CONTADOR: 'Contador',
  SUPERVISOR: 'Supervisor',
  REFUERZO: 'Refuerzo',
  BODEGUERO: 'Bodeguero',
  REPARTIDOR: 'Repartidor',
};

export function etiquetaRol(lado: ConteoLado, respaldo: string): string {
  const tipo = lado.tipoSesion?.trim().toUpperCase();
  if (!tipo) return respaldo;
  return ROLES[tipo] ?? tipo.charAt(0) + tipo.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function progresoResolucion(discrepancias: readonly Discrepancia[]): { resueltas: number; total: number } {
  return {
    resueltas: discrepancias.filter((d) => estadoDe(d) === 'confirmada').length,
    total: discrepancias.length,
  };
}

/**
 * Piezas a paquetes completos + sueltas, con el mismo factor que el conteo.
 * Sin factor efectivo todo son sueltas. Lo que se vende completo ya está en
 * su unidad: todo va a `paquetes` y no hay sueltas.
 */
export function desglose(piezas: number, producto: ProductoConteo): { paquetes: number | null; sueltas: number | null } {
  if (seVendeCompleto(producto)) return { paquetes: piezas, sueltas: null };
  const factor = factorEfectivo(producto);
  if (factor === null) return { paquetes: null, sueltas: piezas };
  return { paquetes: Math.floor(piezas / factor), sueltas: piezas % factor };
}

/** Punto de partida del teclado al corregir: lo ya capturado, desglosado. */
export function capturaInicial(d: Discrepancia): CapturaProducto {
  if (d.cantidadFinal === null) return { paquetes: null, sueltas: null };
  const { paquetes, sueltas } = desglose(d.cantidadFinal, d.producto);
  return { paquetes, sueltas };
}
