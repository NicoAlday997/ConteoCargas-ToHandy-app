import { z } from 'zod';

/**
 * Id de una plantilla o de una ruta. NO se exige CUID: las plantillas que ya
 * existen se crearon por SQL con ids legibles ("plantilla-ruta6").
 */
export const IdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador no es valido')
  .max(100, 'El identificador no es valido');

const nombre = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'El nombre es demasiado largo');

/** Texto vacio = sin descripcion. */
const descripcion = z
  .string()
  .trim()
  .max(300, 'La descripcion es demasiado larga')
  .transform((texto) => (texto === '' ? null : texto));

/** Body de `POST /admin/plantillas`. */
export const CrearPlantillaSchema = z
  .object({
    nombre,
    descripcion: descripcion.nullable().optional(),
  })
  .strict();

/**
 * Body de `PATCH /admin/plantillas/:id`. Todos opcionales pero al menos uno.
 * `descripcion: null` (o texto vacio) la borra.
 */
export const EditarPlantillaSchema = z
  .object({
    nombre: nombre.optional(),
    descripcion: descripcion.nullable().optional(),
    activa: z.boolean().optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

/**
 * Body de `POST /admin/plantillas/:id/productos` y `.../productos/quitar`.
 * El catalogo tiene ~100 productos: 500 es margen de sobra y corta abusos.
 */
export const CodigosProductoSchema = z
  .object({
    codes: z
      .array(z.string().trim().min(1, 'El codigo de producto no es valido'))
      .min(1, 'Debe enviar al menos un producto')
      .max(500, 'Demasiados productos en una sola peticion'),
  })
  .strict();

/** Query de `GET /admin/plantillas`. */
export const ListarPlantillasQuerySchema = z.object({
  incluirInactivas: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

export type CrearPlantillaDto = z.infer<typeof CrearPlantillaSchema>;
export type EditarPlantillaDto = z.infer<typeof EditarPlantillaSchema>;
export type CodigosProductoDto = z.infer<typeof CodigosProductoSchema>;
export type ListarPlantillasQueryDto = z.infer<
  typeof ListarPlantillasQuerySchema
>;
