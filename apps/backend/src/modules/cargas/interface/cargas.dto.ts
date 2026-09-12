import { TipoCarga, UbicacionConteo } from '@prisma/client';
import { z } from 'zod';

/**
 * Esquemas de validacion de la capa HTTP del modulo de cargas
 * (`docs/04-api-interna.md` §1.4). El cuerpo entrante se valida con
 * `ZodValidationPipe`, que ante un fallo responde el error estandar
 * `{ statusCode, mensaje, detalle }` (docs/04 §1.7).
 *
 * TODOS los identificadores del sistema son CUID, no UUID (ver `schema.prisma`):
 * por eso se usa `z.cuid` y nunca `z.uuid`.
 */

/** Id de un `EventoCarga` o de una `SesionConteo`: siempre un CUID. */
export const IdSchema = z.cuid('El identificador no es valido');

/**
 * Body de `POST /eventos-carga` (RF-12). El vendedor no elige ruta —sale de su
 * asignacion vigente—, solo el tipo de operacion.
 */
export const IniciarCargaSchema = z.object({
  tipo: z.enum(TipoCarga),
});

/** Cantidad capturada de un producto: entero no negativo. */
const cantidadCapturada = z
  .number()
  .int('La cantidad debe ser un numero entero')
  .min(0, 'La cantidad no puede ser negativa');

/**
 * Body de `PATCH /eventos-carga/:id/sesiones/:sesionId/items`. Reemplaza por
 * completo las cantidades capturadas de la sesion; un `items` vacio deja la
 * sesion sin ningun producto.
 */
export const GuardarItemsSchema = z.object({
  items: z.array(
    z.object({
      productoCode: z
        .string()
        .trim()
        .min(1, 'El codigo de producto es obligatorio'),
      cantidad: cantidadCapturada,
    }),
  ),
});

/**
 * Body de `POST /eventos-carga/:id/sesiones` (docs/04 §1.4). `ubicacion` solo
 * aplica al segundo conteo de una recarga —almacen o camioneta de refuerzo en
 * calle (docs/06 §3.7)— y es puramente informativa para trazabilidad: no cambia
 * permisos ni el flujo, de ahi que sea opcional.
 */
export const FinalizarSesionSchema = z.object({
  ubicacion: z.enum(UbicacionConteo).optional(),
});

/** Body de `POST /eventos-carga/:id/discrepancias/:productoCode/capturar`. */
export const CapturarCantidadSchema = z.object({
  cantidadFinal: cantidadCapturada,
});

/** Motivo obligatorio que debe dar el supervisor al rechazar o modificar. */
const motivoSupervisor = z
  .string()
  .trim()
  .min(3, 'El motivo debe tener al menos 3 caracteres');

/**
 * Body de `POST /eventos-carga/:id/rechazar-productos`. El supervisor marca
 * productos puntuales de la autorizacion como incorrectos (CLAUDE.md): cada
 * uno vuelve a quedar sin resolver para un nuevo conteo/confirmacion, sin
 * devolver la carga entera.
 */
export const RechazarProductosSchema = z.object({
  productos: z
    .array(
      z.object({
        productoCode: z
          .string()
          .trim()
          .min(1, 'El codigo de producto es obligatorio'),
        motivo: motivoSupervisor,
      }),
    )
    .min(1, 'Debes indicar al menos un producto a rechazar'),
});

/**
 * Body de `POST /eventos-carga/:id/productos/:productoCode/modificar`. El
 * supervisor propone una cantidad nueva, que queda pendiente de confirmacion
 * cruzada por otra persona (CLAUDE.md): el supervisor no puede confirmar su
 * propia modificacion.
 */
export const ModificarCantidadSchema = z.object({
  cantidadNueva: cantidadCapturada,
  motivo: motivoSupervisor,
});

export type IniciarCargaDto = z.infer<typeof IniciarCargaSchema>;
export type GuardarItemsDto = z.infer<typeof GuardarItemsSchema>;
export type FinalizarSesionDto = z.infer<typeof FinalizarSesionSchema>;
export type CapturarCantidadDto = z.infer<typeof CapturarCantidadSchema>;
export type RechazarProductosDto = z.infer<typeof RechazarProductosSchema>;
export type ModificarCantidadDto = z.infer<typeof ModificarCantidadSchema>;
