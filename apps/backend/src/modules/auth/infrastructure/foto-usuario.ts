/**
 * Resolucion de la foto de perfil de un usuario de la app, sin Nest ni Prisma
 * (se prueba sola). La foto sale del vendedor de Handy vinculado: contador y
 * supervisor no tienen cuenta en Handy, asi que para ellos siempre es `null`.
 */

/** Lo que trae el `select` de Prisma de la relacion `usuarioHandy`. */
export type RelacionFotoHandy = { fotoUrl: string | null } | null;

/**
 * Cambia la relacion anidada por el campo plano `fotoUrl`. La relacion no
 * sale del repositorio: la capa de aplicacion no sabe de `UsuarioHandy`.
 */
export function conFotoDeHandy<T extends { usuarioHandy: RelacionFotoHandy }>(
  registro: T,
): Omit<T, 'usuarioHandy'> & { fotoUrl: string | null } {
  const { usuarioHandy, ...resto } = registro;
  return { ...resto, fotoUrl: usuarioHandy?.fotoUrl ?? null };
}
