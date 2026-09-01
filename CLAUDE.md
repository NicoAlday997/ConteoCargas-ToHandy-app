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

## Reglas clave a respetar siempre

- **Seguridad del token de Handy:** el backend nunca expone el token de integración de Handy al cliente (app); vive únicamente como variable de entorno del servidor.
- **Doble verificación obligatoria:** toda carga inicial y recarga requiere conteo independiente de vendedor y contador.
- **Confirmación cruzada de discrepancias:** ninguna discrepancia puede resolverse sin que una persona capture la cantidad final y una **persona distinta** la confirme con su propio PIN. Rechazar cualquier intento de autoconfirmación.
- **Arquitectura hexagonal:** la lógica de dominio (`apps/backend/src/modules/*/domain`, `.../application`) no debe importar nada de infraestructura (Prisma, HTTP hacia Handy, Firebase). Los detalles técnicos viven solo en `.../infrastructure`.
- **Autenticación propia:** los usuarios de la app (Vendedor, Contador, Supervisor) tienen un sistema de PIN independiente de las cuentas de Handy. Solo el rol Vendedor está vinculado a un `usuario_handy_id` fijo, asignado por un administrador.
- **Auditoría pareja:** cualquier carga debe ser consultable en el historial con el mismo nivel de detalle, tenga o no discrepancia — no restringir el acceso al detalle basado en si "coincidió" el conteo.

## Roles del sistema

| Rol | Puede |
|---|---|
| Vendedor | Iniciar carga inicial y recargas de su ruta asignada. |
| Contador | Verificar (segundo conteo) cargas ya contadas por el vendedor. |
| Supervisor | Todo lo del Contador, más historial completo, revisión tipo stepper sobre cargas cerradas, centro de alertas y administración de usuarios. |

## Stack

Backend: NestJS + TypeScript + PostgreSQL (Prisma). App: React Native + TypeScript (Android + iOS). Ver detalle completo en `docs/02-documento-tecnico-y-diseno.md` y `docs/03-guia-entorno-desarrollo.md`.
