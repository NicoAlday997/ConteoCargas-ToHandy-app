import { peticion } from './cliente';

/**
 * Colores de familia (docs/04 §1.2.2). Solo Supervisor. El color es una clave
 * de la paleta cerrada (`theme/colores-familia.ts`), nunca un hex libre.
 */

/** Código de 400 con un color fuera de la paleta. */
export const CODIGO_COLOR_INVALIDO = 'COLOR_INVALIDO';

/** Fila de `GET /admin/familias`. */
export interface FamiliaColorApi {
  familia: string | null;
  color: string | null;
  productos: number | null;
}

const base = '/admin/familias';

export function listarFamilias(): Promise<FamiliaColorApi[] | null> {
  return peticion<FamiliaColorApi[] | null>(base);
}

/** `color: null` quita el color. */
export function asignarColorFamilia(
  familia: string,
  color: string | null,
): Promise<{ familia: string | null; color: string | null } | null> {
  return peticion(`${base}/${encodeURIComponent(familia)}/color`, { method: 'PUT', cuerpo: { color } });
}
