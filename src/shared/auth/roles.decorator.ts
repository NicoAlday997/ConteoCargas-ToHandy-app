import { SetMetadata } from '@nestjs/common';
import type { RolApp } from '@prisma/client';

/** Clave de metadata donde `RolesGuard` busca los roles permitidos. */
export const ROLES_KEY = 'roles';

/**
 * Declara que roles pueden acceder a un endpoint (o a todo un controller).
 * Sin este decorador, `RolesGuard` deja pasar a cualquier usuario autenticado.
 * La matriz de permisos por rol esta en docs/06 seccion 2.
 */
export const Roles = (...roles: RolApp[]) => SetMetadata(ROLES_KEY, roles);
