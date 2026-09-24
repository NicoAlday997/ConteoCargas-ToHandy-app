import { TipoCarga, UbicacionConteo } from '@prisma/client';
import { z } from 'zod';

import { fechaOperativaDesdeDia } from '../domain/fecha-operativa';

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
 * asignacion vigente—: solo el tipo de operacion y la fecha operativa (dia para
 * el que sale el camion, `aaaa-mm-dd`). Que no sea un dia pasado lo valida el
 * caso de uso, no este esquema.
 */
export const IniciarCargaSchema = z.object({
  tipo: z.enum(TipoCarga),
  fechaOperativa: z.iso
    .date('fechaOperativa debe ser un dia con formato aaaa-mm-dd')
    .transform((dia) => fechaOperativaDesdeDia(dia)),
});

/** Cantidad capturada de un producto: entero no negativo. */
const cantidadCapturada = z
  .number()
  .int('La cantidad debe ser un numero entero')
  .min(0, 'La cantidad no puede ser negativa');

/** Paquetes o piezas sueltas contados: entero no negativo. */
const conteoEmpaque = (campo: string) =>
  z
    .number()
    .int(`${campo} debe ser un numero entero`)
    .min(0, `${campo} no puede ser negativo`);

/**
 * Body de `PATCH /eventos-carga/:id/sesiones/:sesionId/items`. Reemplaza por
 * completo lo capturado en la sesion; un `items` vacio deja la sesion sin
 * ningun producto.
 *
 * Se reciben `paquetes` y `sueltas` (lo que se cuenta en bodega). El total en
 * piezas lo calcula el backend: `cantidad` NO se acepta del cliente
 * (`z.strictObject` rechaza el campo si llega).
 *
 * `capturadoEn` (opcional, ISO 8601) es la hora del dispositivo al capturar:
 * la app puede contar sin conexion y enviar despues. Se guarda tal cual junto
 * a la hora de llegada al servidor.
 */
export const GuardarItemsSchema = z.object({
  items: z
    .array(
      z.strictObject({
        productoCode: z
          .string()
          .trim()
          .min(1, 'El codigo de producto es obligatorio'),
        paquetes: conteoEmpaque('Los paquetes').default(0),
        sueltas: conteoEmpaque('Las piezas sueltas').default(0),
        capturadoEn: z.iso
          .datetime({
            offset: true,
            message: 'capturadoEn debe ser una fecha ISO 8601',
          })
          .transform((valor) => new Date(valor))
          .optional(),
      }),
    )
    .refine(
      (items) =>
        new Set(items.map((i) => i.productoCode)).size === items.length,
      'Un producto no puede venir mas de una vez',
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

/**
 * Body de `POST /eventos-carga/:id/discrepancias/:productoCode/confirmar`. Quien
 * confirma teclea SU PIN en ese momento: la sesion abierta en el dispositivo no
 * basta para probar quien confirma (CLAUDE.md, confirmacion cruzada).
 */
export const ConfirmarCantidadSchema = z.object({
  /** La cantidad final que la persona tiene a la vista al confirmar. */
  cantidadFinal: cantidadCapturada,
  pin: z
    .string()
    .regex(/^[0-9]{4}$/, 'El PIN debe tener exactamente 4 digitos numericos'),
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
export type ConfirmarCantidadDto = z.infer<typeof ConfirmarCantidadSchema>;
export type RechazarProductosDto = z.infer<typeof RechazarProductosSchema>;
export type ModificarCantidadDto = z.infer<typeof ModificarCantidadSchema>;
