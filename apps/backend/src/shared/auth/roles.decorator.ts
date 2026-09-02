import { SetMetadata } from '@nestjs/common';
import type { RolApp } from '@prisma/client';

/** Clave bajo la que se guardan los roles requeridos en la metadata del handler. */
export const ROLES_KEY = 'roles';

/**
 * Declara que roles pueden ejecutar un endpoint. Lo lee `RolesGuard`. El
 * backend valida el rol en cada endpoint — la app nunca decide localmente que
 * puede hacer (ver `docs/04-api-interna.md` y la matriz de la seccion 2 de
 * `docs/06-documento-visual-y-experiencia.md`).
 *
 * @example
 * ```ts
 * @Roles('CONTADOR', 'SUPERVISOR')
 * @Get('cola-verificacion')
 * ```
 */
export const Roles = (...roles: RolApp[]) => SetMetadata(ROLES_KEY, roles);
