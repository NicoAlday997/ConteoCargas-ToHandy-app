import { z } from 'zod';

import { esColorFamiliaValido } from '../domain/colores-familia';

/** Nombre de familia tal como viene en la URL (Nest ya lo decodifica). */
export const FamiliaParamSchema = z
  .string()
  .trim()
  .min(1, 'La familia no es valida')
  .max(100, 'La familia no es valida');

/**
 * Body de `PUT /admin/familias/:familia/color`. `null` quita el color. El
 * color solo se valida como texto aqui: que este en la paleta lo decide el
 * controlador con `esColorFamiliaValido`, para responder `COLOR_INVALIDO`
 * (y no el 400 generico de validacion) que la app sabe explicar.
 */
export const AsignarColorFamiliaSchema = z
  .object({
    color: z.string().nullable(),
  })
  .strict();

export type AsignarColorFamiliaDto = z.infer<typeof AsignarColorFamiliaSchema>;

/** Si el color del body es aceptable: `null` o una clave de la paleta. */
export function esColorAsignable(color: string | null): boolean {
  return color === null || esColorFamiliaValido(color);
}
