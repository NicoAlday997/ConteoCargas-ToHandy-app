import { EstadoCarga, TipoCarga } from '@prisma/client';
import { z } from 'zod';

/**
 * Esquemas de validacion de la capa HTTP del modulo de historial
 * (`docs/04-api-interna.md` seccion 1.5). El query entrante se valida con
 * `ZodValidationPipe`, que ante un fallo responde el error estandar
 * `{ statusCode, mensaje, detalle }` (docs/04 seccion 1.7).
 *
 * TODOS los identificadores del sistema son CUID, no UUID (ver `schema.prisma`):
 * por eso se usa `z.cuid` y nunca `z.uuid`.
 */

/** Id de un `EventoCarga`: siempre un CUID. */
export const IdSchema = z.cuid('El identificador no es valido');

/**
 * Un booleano de query string llega como texto ("true"/"false"), no como
 * `boolean`: se acepta solo esa forma explicita en lugar de coercionar
 * cualquier string no vacio a `true`.
 */
const booleanDeQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/**
 * Query params de `GET /historial` (RF-23). `fechaInicio`/`fechaFin` filtran
 * por fecha operativa. No hay parametro de vendedor: a quien ve cada rol lo
 * decide la politica de alcance, no el cliente.
 */
export const FiltrosHistorialSchema = z.object({
  rutaId: z.cuid('La ruta no es valida').optional(),
  fechaInicio: z.coerce.date().optional(),
  fechaFin: z.coerce.date().optional(),
  estado: z.enum(EstadoCarga).optional(),
  conDiscrepancia: booleanDeQuery.optional(),
  sinLiquidar: booleanDeQuery.optional(),
  tipo: z.enum(TipoCarga).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type FiltrosHistorialDto = z.infer<typeof FiltrosHistorialSchema>;
