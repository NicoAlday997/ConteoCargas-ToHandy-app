import { z } from 'zod';

/** Un PIN es siempre exactamente 4 digitos numericos (RF-02 / RF-08). */
const pin = z
  .string()
  .regex(/^[0-9]{4}$/, 'El PIN debe tener exactamente 4 digitos numericos');

/** Body de `POST /auth/login`. */
export const LoginSchema = z.object({
  usuarioAppId: z.cuid('El identificador de usuario no es valido'),
  pin,
});

/** Body de `POST /auth/cambiar-pin`. */
export const CambiarPinSchema = z.object({
  pinActual: pin,
  pinNuevo: pin,
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type CambiarPinDto = z.infer<typeof CambiarPinSchema>;
