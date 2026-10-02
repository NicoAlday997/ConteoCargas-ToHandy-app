import { EstadoCarga, TipoCarga } from '@prisma/client';
import { z } from 'zod';

import { fechaOperativaDesdeDia } from '../../cargas/domain/fecha-operativa';

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
 * Un dia de fecha operativa. Lo normal es `aaaa-mm-dd` (como lo manda la app),
 * que se lee como ese dia en la zona del negocio: la fecha operativa se guarda
 * como el inicio del dia, asi que `fechaFin=2026-09-20` incluye ese dia. Se
 * sigue aceptando un instante ISO completo con zona por compatibilidad; nada
 * mas laxo, para que un dia inexistente (`2026-02-30`) no se acomode en marzo.
 */
const diaOperativo = z.union(
  [
    z.iso.date().transform((dia) => fechaOperativaDesdeDia(dia)),
    z.iso.datetime({ offset: true }).transform((iso) => new Date(iso)),
  ],
  { error: 'La fecha debe tener formato aaaa-mm-dd' },
);

/**
 * Query params de `GET /historial` (RF-23). `fechaInicio`/`fechaFin` filtran
 * por fecha operativa. Todos se combinan con "y". `vendedorUsuarioAppId` solo
 * estrecha: al rol VENDEDOR se le ignora y ve lo suyo (`vendedorEfectivo`).
 */
export const FiltrosHistorialSchema = z.object({
  vendedorUsuarioAppId: z.cuid('El vendedor no es valido').optional(),
  rutaId: z.cuid('La ruta no es valida').optional(),
  fechaInicio: diaOperativo.optional(),
  fechaFin: diaOperativo.optional(),
  estado: z.enum(EstadoCarga).optional(),
  conDiscrepancia: booleanDeQuery.optional(),
  tipo: z.enum(TipoCarga).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type FiltrosHistorialDto = z.infer<typeof FiltrosHistorialSchema>;
