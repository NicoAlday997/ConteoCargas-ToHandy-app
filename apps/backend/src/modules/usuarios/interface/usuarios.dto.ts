import { RolApp } from '@prisma/client';
import { z } from 'zod';

/** Nombre completo: texto no vacio, sin espacios sobrantes en los extremos. */
const nombreCompleto = z
  .string()
  .trim()
  .min(1, 'El nombre completo es obligatorio')
  .max(120, 'El nombre completo es demasiado largo');

/** Rol de la app (RF-04): uno de VENDEDOR, CONTADOR o SUPERVISOR. */
const rolApp = z.enum(RolApp);

/**
 * Id del usuario vendedor en Handy. Se selecciona de la lista sincronizada
 * (RF-07); la API interna lo maneja como entero positivo.
 */
const usuarioHandyId = z
  .number()
  .int('El usuario de Handy no es valido')
  .positive('El usuario de Handy no es valido');

/** Id de un `UsuarioApp`: siempre un CUID (no UUID). */
export const IdUsuarioSchema = z.cuid('El identificador de usuario no es valido');

/** Body de `POST /admin/usuarios` (alta, RF-07). */
export const CrearUsuarioSchema = z.object({
  nombreCompleto,
  rolApp,
  // La regla "vendedor <-> usuarioHandyId" se valida en el caso de uso, que
  // conoce el rol; aqui solo se comprueba la forma del dato.
  usuarioHandyId: usuarioHandyId.optional(),
});

/**
 * Body de `PATCH /admin/usuarios/:id`. Todos los campos son opcionales pero debe
 * venir al menos uno. `usuarioHandyId: null` desvincula al usuario de Handy.
 */
export const EditarUsuarioSchema = z
  .object({
    nombreCompleto: nombreCompleto.optional(),
    rolApp: rolApp.optional(),
    usuarioHandyId: usuarioHandyId.nullable().optional(),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type CrearUsuarioDto = z.infer<typeof CrearUsuarioSchema>;
export type EditarUsuarioDto = z.infer<typeof EditarUsuarioSchema>;
