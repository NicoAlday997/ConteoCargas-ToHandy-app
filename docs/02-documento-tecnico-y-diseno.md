# Documento Técnico y de Diseño

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Tipo de documento:** Diseño de Arquitectura y Especificación Técnica

---

## 1. Arquitectura general

```
Tablet/Phone (React Native, Android/iOS)
    │  HTTPS + JWT (rol + usuario_handy_id si aplica)
    ▼
Backend propio (NestJS)
    │  valida rol/permisos en cada endpoint
    │  Bearer Token de Handy (solo aquí, en variables de entorno)
    ▼
API de Handy (hub.handy.la/api/v2)
```

**Principio de diseño central:** el dispositivo cliente nunca se comunica directamente con la API de Handy. Todo pasa por el backend propio, que concentra la lógica de negocio, las validaciones de rol, y la única credencial sensible del sistema (el token de Handy).

## 1.1 Estilo arquitectónico y patrón de diseño

**Estilo general: monolito modular.** Con 5 rutas y un equipo de desarrollo pequeño, microservicios agregarían complejidad de infraestructura (orquestación, despliegues múltiples, comunicación entre servicios) sin beneficio real a esta escala. Un solo backend NestJS, dividido internamente en módulos de dominio bien delimitados, da orden sin la carga operativa de microservicios.

**Patrón interno: arquitectura hexagonal (Ports & Adapters).** La lógica de negocio más sensible del proyecto (doble conteo, resolución de discrepancias, políticas de inventario) no debe depender de los detalles de cómo Handy expone su API, ni de qué motor de base de datos se use. Este patrón aísla el dominio de negocio de la infraestructura técnica:

```
Dominio (el núcleo, no conoce HTTP, Handy ni Postgres)
   - Entidades: EventoCarga, SesionConteo, Discrepancia
   - Reglas puras: ¿coinciden los dos conteos?, ¿es una discrepancia atípica?
        │
Aplicación (orquesta el dominio, define casos de uso)
   - CrearCargaInicialUseCase, ResolverDiscrepanciaUseCase, EnviarACargaHandyUseCase
        │
   ┌────┴─────────────────────────────┐
Puertos (interfaces — qué se necesita, no cómo se hace)
   - RutaRepository (guardar/leer EventoCarga)
   - HandyGateway (crear ruta, recargar, consultar catálogo)
   - NotificationGateway (enviar push)
        │
Adaptadores (implementación real, sí conocen los detalles técnicos)
   - PrismaRutaRepository        → habla con PostgreSQL
   - HandyHttpGateway            → habla con hub.handy.la vía HTTP
   - FirebaseNotificationGateway → habla con FCM
```

**Beneficio concreto para este proyecto:** casos de uso como verificar `route/current` antes de reintentar un envío incierto (evitar duplicados) son lógica de negocio; el *cómo* se consulta a Handy es un detalle de infraestructura. El caso de uso solo invoca `handyGateway.tieneRutaAbierta(vendedorId)` — si Handy cambia un endpoint o su formato de respuesta, el cambio se aísla al adaptador correspondiente, sin tocar la lógica de negocio ni sus pruebas.

### Estructura de carpetas del backend

```
apps/backend/src/
├── modules/
│   ├── auth/                    (PIN, JWT, roles)
│   ├── usuarios/                (alta, baja, restablecimiento de PIN)
│   ├── cargas/
│   │   ├── domain/               (entidades y reglas puras)
│   │   ├── application/          (casos de uso)
│   │   ├── infrastructure/
│   │   │   ├── persistence/      (repositorio Prisma)
│   │   │   └── handy/            (adaptador HTTP hacia Handy)
│   │   └── interface/            (controladores REST, DTOs)
│   ├── alertas/
│   └── sincronizacion/           (catálogo y usuarios de Handy)
├── shared/                       (utilidades comunes, DTOs base)
└── main.ts
```

Cada módulo de dominio repite este mismo patrón interno, permitiendo que el proyecto crezca de forma consistente sin importar cuántos módulos se agreguen después.

### Estructura y patrones para la app (React Native)

- **Organización por feature**, no por tipo de archivo — `features/carga-inicial/`, `features/recarga/`, `features/historial/`, en vez de carpetas globales `screens/` y `components/` mezclando todo.
- **TanStack Query (React Query)** para toda comunicación con el backend propio — maneja cache, reintentos y estados de carga/error sin implementarlo a mano.
- **Zustand o Context de React** para el estado global mínimo necesario (sesión del usuario logueado) — no se requiere Redux para el tamaño de este proyecto.

## 2. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| App móvil | React Native + TypeScript | Un solo código para Android (operación) e iOS (supervisión); mismo lenguaje que el backend. |
| Backend | NestJS + TypeScript | Estructura modular apta para lógica de negocio no trivial (comparación de conteos, colas de reintento, integración externa). |
| Base de datos | PostgreSQL + Prisma (ORM) | Modelo inherentemente relacional (productos, rutas, sesiones, discrepancias, historial). |
| Notificaciones push | Firebase Cloud Messaging | Estándar, gratuito, integración directa con React Native. |
| Hosting | Railway / Render | Suficiente para la escala del proyecto (5 rutas); base de datos administrada incluida. |

## 3. Modelo de datos

### 3.1 Entidades principales

```
Usuario_App
- id, nombre_completo, codigo_interno (opcional, solo reportes internos)
- pin_hash, debe_cambiar_pin (bool), fecha_ultimo_cambio_pin
- rol_app (VENDEDOR|CONTADOR|SUPERVISOR)
- usuario_handy_id (solo si rol_app = VENDEDOR, asignación fija por admin)
- activo (nunca se elimina un usuario, solo se desactiva)

Historial_Restablecimiento_PIN
- usuario_app_id, restablecido_por (usuario_app_id del admin), fecha

Usuario_Handy (cache local, solo lectura)
- id_handy, nombre, rol_handy, activo, ultima_sincronizacion

Producto (cache local, sincronizado)
- code (PK, usado en payloads hacia Handy), nombre, precio, activo
- lastUpdated_handy, ultima_sincronizacion_local

Frecuencia_Producto_Ruta
- ruta_id, product_code, veces_usado_ultimos_30_dias

Evento_Carga
- id, ruta, tipo (INICIAL|RECARGA), usuario_handy_id
- estado: BORRADOR → EN_ESPERA_CONTADOR → [BLOQUEADA_CORTE_PENDIENTE]
          → EN_COMPARACION → CONFLICTOS_PENDIENTES → LISTA_PARA_ENVIAR
          → ENVIADA | ERROR_ENVIO | ENVIO_INCIERTO
- fecha_conteo, fecha_bloqueo_corte_pendiente, fecha_desbloqueo
- fecha_programada_envio, fecha_envio_real, id_handy (tras éxito)

Sesion_Conteo
- id, evento_carga_id, tipo (VENDEDOR|CONTADOR|REFUERZO|SUPERVISOR)
- usuario_app_id, dispositivo_id, estado

Conteo_Item
- sesion_id, producto_code, cantidad

Discrepancia_Resuelta
- evento_carga_id, producto_code
- cantidad_vendedor_original, cantidad_contador_original, cantidad_final
- capturada_por (usuario_app_id), fecha_captura
- confirmada_por (usuario_app_id, ≠ capturada_por), fecha_confirmacion

Comparacion_Carga (vista de auditoría por evento de carga)
- evento_carga_id, vendedor, contador, total_productos, productos_con_discrepancia
- evidencia_externa (texto libre)
- verificado_supervisor (bool), resultado_verificacion (COINCIDE|DISCREPANCIA)
- supervisor_usuario_app_id, fecha_verificacion

Revision_Supervisor
- comparacion_carga_id, producto_code
- resultado (CORRECTO|INCORRECTO), cantidad_real_encontrada (si INCORRECTO)
- fecha_revision

Alerta
- tipo, urgencia (ALTA|MEDIA|BAJA), entidad_relacionada, mensaje
- estado (PENDIENTE|RESUELTA|IGNORADA), resuelta_por, fecha_resolucion

Dispositivo_Push
- usuario_app_id, fcm_token, plataforma (ANDROID|IOS)
```

### 3.2 Reglas de integridad relevantes
- `confirmada_por` en `Discrepancia_Resuelta` nunca puede ser igual a `capturada_por` (regla de aplicación, no solo de UI).
- Los productos deshabilitados en Handy no se eliminan de `Producto`, solo se marcan `activo=false`, para preservar referencias en el historial.
- `code` de producto es la llave primaria local porque es el identificador que exige la API de Handy en los payloads — debe tratarse como inmutable en el cache.

## 4. Integración con API de Handy (REST v2)

### 4.1 Endpoints utilizados

**Crear carga inicial**
```
POST /api/v2/user/{userId}/route?prettyMessages=true
Body: { products: [{product, quantity}], initialAmount, skipInventoryValidation }
```

**Recarga (sobre ruta ya abierta)**
```
POST /api/v2/user/{userId}/route/recharge?prettyMessages=true
Body: { items: [{product, quantity}] }
```

**Consultar ruta abierta actual**
```
GET /api/v2/user/{userId}/route/current
```

**Sincronizar catálogo de productos**
```
GET /api/v2/product?enabled=true&page={n}&max=100
GET /api/v2/product?enabled=true&filterWithDate=lastUpdated&start={ts}&end={ts}  (incremental)
```

**Sincronizar usuarios vendedores**
```
GET /api/v2/user?role={id_rol_vendedor}&enabled=true
```

### 4.2 Notas de comportamiento de Handy relevantes al diseño
- `dateForDelivery` aplica solo a pedidos de preventa (`salesOrders`); no controla cuándo "abre" operativamente una ruta de autoventa.
- Una ruta creada queda en estatus "Abierta" hasta que el vendedor la acepta desde la app móvil oficial de Handy — esto permite contar la carga la noche anterior sin distorsionar el día operativo real.
- Mientras la ruta no sea aceptada, puede editarse (agregar/quitar cantidades) vía API.
- El Bearer Token se genera a nivel compañía (no por usuario) — toda llamada usa el mismo token; la identidad del vendedor solo se expresa vía el parámetro `{userId}` en la URL.

### 4.3 Política de inventario insuficiente

| Escenario | Comportamiento |
|---|---|
| Carga inicial, producto rechazado por stock | `skipInventoryValidation: false` (default). Se aísla el producto, se notifica al admin, se envía el resto sin ese ítem. |
| Recarga, producto rechazado por stock | Se permite forzar con `skipInventoryValidation: true` (más accesible por la urgencia del vendedor en calle), quedando registrado con usuario/timestamp y generando alerta de urgencia media. |

### 4.4 Manejo de errores

| Caso | Tratamiento |
|---|---|
| Timeout / sin respuesta | Estado `ENVIO_INCIERTO`. Antes de reintentar, `GET /route/current` para descartar duplicado. |
| 422 — producto rechazado (inventario o código inválido) | Aislar el ítem específico usando `prettyMessages=true`; no bloquear el resto del envío. |
| 401 — token inválido/expirado | Alerta de urgencia alta al administrador; no es recuperable por el usuario operativo. |
| 5xx | Reintento con backoff. |

### 4.5 Validación de corte de venta pendiente
- Se detecta mediante `GET /route/current`; si regresa una ruta abierta de un ciclo anterior, la carga nueva pasa a `BLOQUEADA_CORTE_PENDIENTE` (bloqueando solo la verificación del contador, no el conteo del vendedor).
- Verificación híbrida: on-demand al abrir la cola del contador, más un job en background cada 15-30 minutos.
- Escalamiento: si el bloqueo persiste más de 3-4 horas, la alerta sube de urgencia media a alta.

## 5. Seguridad

- **Token de Handy:** exclusivamente en variables de entorno del backend; nunca en el cliente, el código fuente ni el repositorio. Rotación recomendada cada 6-12 meses.
- **Identificación de usuario:** el login inicia con selección visual del nombre (lista/tarjetas), no con captura de un nombre de usuario escrito — reduce fricción y no requiere definir una convención de username visible.
- **PIN:** 4 dígitos, almacenado con hash (bcrypt/argon2), nunca en texto plano. Se considera suficiente dado que el universo de usuarios es cerrado y pequeño, complementado con rate limiting (bloqueo tras 5 intentos fallidos) y expiración de sesión por inactividad. El modelo de amenaza principal no es un ataque externo de fuerza bruta, sino el descuido interno (alguien ve el PIN de otro) — mitigado por política de no compartir/anotar PINs, no por longitud adicional del PIN.
- **Alta de usuarios:** no existe auto-registro. Todo usuario se crea desde un panel de administración (permiso que recae sobre el rol Supervisor). El PIN inicial es temporal; el usuario es forzado a definir uno nuevo en su primer login (`debe_cambiar_pin: true`).
- **Restablecimiento de PIN:** exclusivamente administrativo, nunca autoservicio. El administrador genera un PIN temporal aleatorio desde el panel; el usuario es forzado a definir uno nuevo en su siguiente login. Cada restablecimiento queda registrado (`Historial_Restablecimiento_PIN`) para trazabilidad.
- **Baja de usuarios:** se marca `activo: false`; nunca se elimina el registro, para preservar la trazabilidad de sus conteos históricos.
- **Comunicación app↔backend:** HTTPS obligatorio; JWT de sesión con rol y `usuario_handy_id` embebidos; el backend valida permisos en cada endpoint según el rol del JWT, no confía en el cliente.
- **Separación de responsabilidad por rol:** el vendedor nunca puede seleccionar a qué `usuario_handy_id` asigna una carga (viene fijo en su perfil), reduciendo superficie de error o fraude de asignación.

## 6. Sistema de alertas

| Alerta | Urgencia | Canal |
|---|---|---|
| Token de Handy inválido/expirado | Alta | Push + centro de alertas |
| Envío incierto (timeout) | Alta | Push + centro de alertas |
| Discrepancia en revisión de supervisor | Alta | Push + centro de alertas |
| Inventario insuficiente | Media | Centro de alertas |
| Corte de venta pendiente (escalable a alta) | Media → Alta | Centro de alertas / Push |
| Validación de inventario forzada en recarga | Media | Centro de alertas |
| Fallo de sincronización | Baja | Centro de alertas |

## 7. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Duplicación de rutas por reintento tras timeout | Verificación obligatoria de `route/current` antes de cualquier reintento. |
| Desfase entre catálogo local y Handy | Sincronización incremental automática + botón de sincronización completa manual. |
| El doble conteo y la confirmación cruzada no detectan colusión | Compensado por historial completo auditable + revisión de supervisor + fase futura de detección de anomalías. |
| Dependencia de comportamiento no documentado de Handy (ej. mensaje exacto de error por ruta duplicada) | Validar directamente contra el ambiente de pruebas de Handy o soporte antes de definir el manejo de error final. |

## 8. Pendientes técnicos abiertos

1. Confirmar con soporte de Handy el comportamiento exacto (código/mensaje de error) al intentar crear una ruta cuando el usuario ya tiene una abierta.
2. Definir la estructura de módulos de NestJS (organización de carpetas, separación entre integración con Handy y lógica de negocio propia).
