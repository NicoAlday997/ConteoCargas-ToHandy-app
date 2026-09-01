# Especificación de API Interna (Backend ↔ App)

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Alcance:** Contrato de endpoints entre el backend propio y la app (React Native)

---

Todos los endpoints requieren `Authorization: Bearer {JWT}` salvo el login. El JWT contiene `usuario_app_id`, `rol_app` y, si aplica, `usuario_handy_id`. El backend valida el rol en cada endpoint — la app nunca decide localmente qué puede o no hacer.

### 1.1 Autenticación

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/auth/usuarios` | Público (pantalla de login) | Lista de nombres/usuarios activos para selección visual (sin exponer PIN ni datos sensibles). |
| POST | `/auth/login` | Público | Body: `{ usuarioAppId, pin }`. Devuelve JWT y `debeCambiarPin`. |
| POST | `/auth/cambiar-pin` | Autenticado | Body: `{ pinActual, pinNuevo }`. Obligatorio si `debeCambiarPin = true`. |

### 1.2 Administración de usuarios

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/admin/usuarios` | Supervisor (admin) | Lista completa, incluidos inactivos. |
| POST | `/admin/usuarios` | Supervisor (admin) | Alta de usuario. Body: `{ nombreCompleto, rolApp, usuarioHandyId? }`. Devuelve PIN temporal. |
| PATCH | `/admin/usuarios/:id` | Supervisor (admin) | Editar nombre, rol, `usuarioHandyId`, o `activo`. |
| POST | `/admin/usuarios/:id/restablecer-pin` | Supervisor (admin) | Genera PIN temporal nuevo; marca `debeCambiarPin = true`. |
| GET | `/admin/usuarios-handy` | Supervisor (admin) | Lista de usuarios vendedores sincronizados desde Handy, para vincular en el alta. |

### 1.3 Catálogo (solo lectura para la app, sincronizado desde Handy)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/productos?ruta=&q=` | Vendedor, Contador, Supervisor | Catálogo activo, ordenado por frecuencia de uso de la ruta indicada; `q` filtra por búsqueda de texto. |
| POST | `/admin/sincronizacion/productos` | Supervisor (admin) | Fuerza sincronización completa del catálogo. |
| POST | `/admin/sincronizacion/usuarios-handy` | Supervisor (admin) | Fuerza sincronización de usuarios vendedores. |

### 1.4 Cargas (inicial y recarga)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/eventos-carga` | Vendedor | Inicia un evento de carga. Body: `{ tipo: INICIAL\|RECARGA }`. En `RECARGA`, el backend obtiene automáticamente el catálogo ya cargado ese día. |
| POST | `/eventos-carga/:id/sesiones` | Vendedor, Contador | Inicia la sesión de conteo del usuario autenticado sobre ese evento. Body (solo recarga, segundo conteo): `{ ubicacion: ALMACEN\|CALLE }`. |
| PATCH | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Guarda/actualiza cantidades capturadas. Body: `{ items: [{ productoCode, cantidad }] }`. |
| POST | `/eventos-carga/:id/sesiones/:sesionId/finalizar` | Vendedor, Contador (dueño de la sesión) | Cierra la sesión; si ambas sesiones (vendedor y contador) están cerradas, dispara la comparación automática. |
| GET | `/eventos-carga/cola-verificacion` | Contador, Supervisor | Eventos agrupados en `listas`, `bloqueadas_corte_pendiente`, `esperando_vendedor`. |
| GET | `/eventos-carga/:id` | Vendedor (dueño), Contador, Supervisor | Detalle del evento, incluidas ambas sesiones y discrepancias si existen. |
| GET | `/eventos-carga/:id/discrepancias` | Contador, Supervisor | Productos con discrepancia pendiente de resolver. |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/capturar` | Vendedor, Contador | Captura la cantidad final acordada. Body: `{ cantidadFinal }`. |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/confirmar` | Vendedor, Contador | Confirma la cantidad capturada con el PIN del usuario autenticado. El backend rechaza si `confirmadaPor == capturadaPor`. |
| POST | `/eventos-carga/:id/enviar` | Vendedor, Contador, Supervisor | Dispara el envío a Handy (`POST /route` o `/route/recharge` según `tipo`). Solo permitido si no hay discrepancias pendientes. |

### 1.5 Historial y auditoría

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/historial?ruta=&fechaInicio=&fechaFin=&discrepancia=&verificado=` | Supervisor | Listado filtrable de cargas comparadas. |
| GET | `/historial/:id` | Supervisor | Detalle completo, producto por producto. |
| PATCH | `/historial/:id/evidencia-externa` | Supervisor | Body: `{ evidenciaExterna: string }`. |
| POST | `/historial/:id/revision-supervisor` | Supervisor | Inicia la revisión tipo stepper. |
| POST | `/historial/:id/revision-supervisor/:productoCode` | Supervisor | Body: `{ resultado: CORRECTO\|INCORRECTO, cantidadRealEncontrada? }`. |
| POST | `/historial/:id/revision-supervisor/finalizar` | Supervisor | Cierra la revisión; deriva `resultadoVerificacion` y dispara alerta si aplica. |

### 1.6 Alertas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/alertas?estado=&urgencia=` | Supervisor | Listado de alertas. |
| PATCH | `/alertas/:id/resolver` | Supervisor | Marca una alerta como resuelta. |
| POST | `/dispositivos-push` | Cualquier autenticado | Registra o actualiza el `fcmToken` del dispositivo actual. |

### 1.7 Convenciones generales
- Formato de fecha: ISO 8601 (`2026-08-31T14:00:00-06:00`).
- Errores: cuerpo estándar `{ statusCode, mensaje, detalle? }`; nunca exponer mensajes crudos de la API de Handy directamente al usuario final, solo en `detalle` para depuración.
- Paginación: `?page=&pageSize=` en listados que puedan crecer (historial, catálogo).
- Todas las mutaciones devuelven el recurso actualizado completo, no solo un código de éxito — reduce llamadas adicionales desde la app.

---
