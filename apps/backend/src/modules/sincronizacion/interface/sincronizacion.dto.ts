import { z } from 'zod';

import {
  PIEZAS_POR_PAQUETE_MAXIMO,
  PIEZAS_POR_PAQUETE_MINIMO,
} from '../domain/factor-empaque';

/** `code` de un producto de Handy (llave primaria del cache local). */
export const CodeProductoSchema = z
  .string()
  .trim()
  .min(1, 'El codigo de producto no es valido');

/**
 * Body de `PATCH /admin/sincronizacion/productos/:code/factor`. Primero la
 * modalidad; las piezas por paquete solo existen si se vende por pieza.
 */
export const ConfirmarFactorSchema = z.discriminatedUnion('modalidadVenta', [
  z.object({ modalidadVenta: z.literal('COMPLETO') }).strict(),
  z.object({
    modalidadVenta: z.literal('POR_PIEZA'),
    // El caso de uso vuelve a validar el rango; aqui se rechaza la forma.
    piezasPorPaquete: z
      .number()
      .int('Las piezas por paquete deben ser un numero entero')
      .min(PIEZAS_POR_PAQUETE_MINIMO)
      .max(PIEZAS_POR_PAQUETE_MAXIMO),
  }),
]);

export type ConfirmarFactorDto = z.infer<typeof ConfirmarFactorSchema>;
