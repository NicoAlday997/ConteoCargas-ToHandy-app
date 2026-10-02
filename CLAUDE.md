# App de verificación de cargas — contexto del proyecto

Este proyecto digitaliza el conteo físico de carga inicial y recargas de 5 rutas de venta directa, con doble verificación (vendedor + contador) y envío automatizado a la plataforma Handy vía su API REST v2.

## Documentación

Antes de trabajar en este repo, consulta la documentación en `/docs`:

- `docs/01-definicion-y-requisitos.md` — qué hace el proyecto y por qué, alcance por fases, requisitos funcionales y no funcionales.
- `docs/02-documento-tecnico-y-diseno.md` — arquitectura (monolito modular + hexagonal), stack tecnológico, modelo de datos, integración con la API de Handy, seguridad, alertas.
- `docs/03-guia-entorno-desarrollo.md` — cómo levantar el entorno local (Node, Docker/Postgres, NestJS, React Native para Android e iOS).
- `docs/04-api-interna.md` — contrato de endpoints entre el backend propio y la app.
- `docs/05-estrategia-pruebas.md` — qué debe tener pruebas unitarias antes de mergear, y checklist de QA manual.
- `docs/06-documento-visual-y-experiencia.md` — catálogo de pantallas, flujos de UX y matriz de permisos por rol.
- `docs/07-despliegue.md` — despliegue en Render (`render.yaml`), variables de entorno, respaldos y restauración.

## Reglas clave a respetar siempre

- **Seguridad del token de Handy:** el backend nunca expone el token de integración de Handy al cliente (app); vive únicamente como variable de entorno del servidor.
- **Doble verificación obligatoria:** toda carga inicial y recarga requiere conteo independiente de vendedor y contador.
- **Confirmación cruzada de discrepancias:** ninguna discrepancia puede resolverse sin que una persona capture la cantidad final y una **persona distinta** la confirme con su propio PIN. Rechazar cualquier intento de autoconfirmación.
- **Arquitectura hexagonal:** la lógica de dominio (`apps/backend/src/modules/*/domain`, `.../application`) no debe importar nada de infraestructura (Prisma, HTTP hacia Handy, Firebase). Los detalles técnicos viven solo en `.../infrastructure`.
- **Autenticación propia:** los usuarios de la app (Vendedor, Contador, Supervisor) tienen un sistema de PIN independiente de las cuentas de Handy. Solo el rol Vendedor está vinculado a un `usuario_handy_id` fijo, asignado por un administrador.
- **Tablas de solo agregar:** `historiales_restablecimiento_pin`, `historiales_desbloqueo`, `cambios_fecha_operativa`, `cambios_factor_empaque` y `revisiones_supervisor` no se actualizan ni se borran nunca (un trigger en Postgres lo rechaza); una corrección es un renglón nuevo — en `revisiones_supervisor`, una revisión nueva con `reemplazaAId`. `registros_sincronizacion` solo admite cerrar la corrida una vez. Los triggers son SQL manual que Prisma no conoce: si una migración generada trae `DROP TRIGGER`/`DROP FUNCTION` sobre ellos, borra esas líneas. Salida de emergencia en `docs/07-despliegue.md` §13.
- **Dos escrituras que dependen una de otra van en una transacción** dentro del adaptador Prisma (un método del puerto por operación atómica). Ninguna llamada a Handy va dentro de una transacción. Las transiciones de estado de una carga se siguen validando con `puedeTransicionar` (`estados-carga.ts`) en el caso de uso, aunque la escritura ocurra dentro de la transacción.
- **Auditoría pareja:** cualquier carga debe ser consultable en el historial con el mismo nivel de detalle, tenga o no discrepancia — no restringir el acceso al detalle basado en si "coincidió" el conteo.

## Roles del sistema

| Rol | Puede |
|---|---|
| Vendedor | Iniciar carga inicial y recargas de su ruta asignada. |
| Contador | Verificar (segundo conteo) cargas ya contadas por el vendedor. |
| Supervisor | Todo lo del Contador, más historial completo, revisión tipo stepper sobre cargas cerradas, centro de alertas y administración de usuarios. |

## Pruebas

- `npm test` (en `apps/backend` y en `apps/movil`): unitarias, sin base de datos ni Docker.
- `npm run test:db` (solo `apps/backend`): pruebas `*.db-spec.ts` contra Postgres real, en la base aparte `handy_conteo_test`. **Necesita Docker levantado** (`docker compose up -d` en `apps/backend`). Córrela antes de cada commit que toque `prisma/schema.prisma`, una migración (sobre todo SQL manual: triggers, índices parciales, `CHECK`), un `$transaction` de un adaptador Prisma o una tabla de solo agregar. Detalle en `docs/07-despliegue.md` §13.3.

## Stack

Backend: NestJS + TypeScript + PostgreSQL (Prisma). App: React Native + TypeScript (Android + iOS). Ver detalle completo en `docs/02-documento-tecnico-y-diseno.md` y `docs/03-guia-entorno-desarrollo.md`.
