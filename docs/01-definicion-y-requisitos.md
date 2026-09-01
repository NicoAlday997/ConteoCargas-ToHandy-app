# Documento de Definición y Requisitos

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Tipo de documento:** Definición y Requisitos (SRS simplificado)

---

## 1. Introducción y contexto

### 1.1 Antecedentes
La empresa es una distribuidora refresquera familiar que opera 5 rutas de venta directa (autoventa) en tiendas de conveniencia en García, Nuevo León. Actualmente el control de venta se apoya en hojas de Excel, y la implementación de Handy (plataforma de gestión de ventas, créditos, rutas, metas e inventario) requiere subir la carga inicial de cada camión mediante una plantilla Excel cargada manualmente al portal.

El conteo físico de la carga inicial se realiza hoy en papel, con doble verificación oral entre el vendedor y el contador de inventario (cada uno cuenta y dicta su resultado al otro).

### 1.2 Problema a resolver
1. **Fricción operativa:** el proceso actual (papel → Excel → carga manual a Handy) es lento y duplica trabajo.
2. **Riesgo de fraude por colusión:** se ha detectado al menos un caso donde vendedor y contador acordaron reportar una cantidad menor a la real durante el conteo de carga inicial, generando faltantes de inventario no cobrados en el corte de venta (robo hormiga).

### 1.3 Objetivo del proyecto
Construir una aplicación propia que:
- Digitalice el conteo físico de carga inicial y recargas, en el punto donde ocurre (almacén / calle).
- Preserve y refuerce el mecanismo de doble verificación (vendedor + contador).
- Automatice el envío de la carga a Handy vía su API REST v2, eliminando el paso de Excel.
- Dé visibilidad total y auditable (no solo de las cargas con discrepancia) a los dueños del negocio, como control adicional contra fraude interno.

## 2. Alcance

### 2.1 Dentro del alcance (fases definidas)

**Fase 1 — MVP**
- Autenticación por PIN (roles: Vendedor, Contador, Supervisor).
- Registro de carga inicial y recarga con doble conteo y comparación automática de discrepancias.
- Resolución de discrepancias mediante captura + confirmación cruzada con PIN.
- Integración con API de Handy: creación de ruta, recarga, sincronización de catálogo de productos y usuarios.
- Historial/auditoría de todas las cargas comparadas (con o sin discrepancia), con campo de evidencia externa.
- Manejo básico de errores (inventario insuficiente, timeout de red).

**Fase 2**
- Precarga de la última carga de cada ruta como sugerencia inicial.
- Ordenamiento del catálogo por frecuencia de uso por ruta.
- Sistema de alertas completo (push + centro de alertas).
- Panel de administración para reasignar vendedor ↔ ruta.

**Fase 3**
- Detección de anomalías estadísticas contra histórico de cada ruta/producto.
- Evidencia fotográfica o de video integrada a la app (hoy sustituida por un grupo de WhatsApp externo).

### 2.2 Fuera del alcance
- Gestión de créditos, metas o cobranza (permanece en Handy).
- Reemplazo de la app móvil oficial de Handy (el vendedor sigue usándola para aceptar la ruta y hacer su corte de venta).
- Procesamiento de pagos o movimientos de efectivo adicionales durante el día (confirmado que no aplica en la operación actual).
- Autenticación de usuarios vía las cuentas nativas de Handy (se definió un sistema de autenticación propio, independiente).

## 3. Actores y roles

| Rol | Descripción | Vínculo con Handy |
|---|---|---|
| Vendedor | Opera una ruta fija (con posibilidad de reasignación administrativa); realiza el primer conteo de carga inicial y recargas. | Vinculado 1:1 a un `usuario_handy_id` fijo, asignado por un administrador. |
| Contador de inventario | Realiza el segundo conteo de verificación, solo sobre cargas donde el vendedor ya terminó. | Sin cuenta en Handy; rol interno de la app. |
| Supervisor | Familia propietaria del negocio; puede verificar cualquier carga (contador + historial + tercer conteo), a discreción. | Sin cuenta en Handy; rol interno con mayor alcance de lectura y auditoría. |

## 4. Requisitos funcionales

### RF — Autenticación y roles
- RF-01: El login debe iniciar con la selección visual del nombre del usuario (lista o tarjetas), no con captura manual de un nombre de usuario.
- RF-02: Tras seleccionar su nombre, el sistema debe permitir login mediante PIN numérico de 4 dígitos, válido en cualquier dispositivo.
- RF-03: El sistema debe bloquear temporalmente el login tras 5 intentos fallidos consecutivos.
- RF-04: Cada `Usuario_App` debe tener un rol único (Vendedor, Contador o Supervisor) que determina las pantallas y acciones disponibles.
- RF-05: Solo un usuario con permiso de administración (recae sobre el rol Supervisor, sin crear un rol adicional) puede modificar la asociación entre un Vendedor y su `usuario_handy_id`.
- RF-06: No debe existir mecanismo de auto-registro; todo usuario debe darse de alta exclusivamente por un administrador.
- RF-07: El alta de un usuario debe capturar nombre completo, rol, y (si es Vendedor) su `usuario_handy_id` seleccionado de la lista sincronizada desde Handy; el PIN inicial es temporal.
- RF-08: Tras un alta o un restablecimiento de PIN, el usuario debe ser forzado a capturar un PIN nuevo en su siguiente login antes de poder usar cualquier otra función.
- RF-09: El restablecimiento de PIN debe ser exclusivamente administrativo (nunca autoservicio): el administrador lo ejecuta desde el panel, el sistema genera un PIN temporal aleatorio, y se marca al usuario para forzar cambio en el siguiente ingreso.
- RF-10: Todo restablecimiento de PIN debe quedar registrado (usuario afectado, administrador que lo ejecutó, fecha) para trazabilidad.
- RF-11: Dar de baja a un usuario debe marcarlo como inactivo (`activo: false`), nunca eliminarlo, para preservar la trazabilidad de sus conteos históricos.

### RF — Carga inicial
- RF-12: El vendedor debe poder capturar el conteo de productos de su carga inicial mediante un grid con búsqueda, sin necesidad de seleccionar su ruta (ya determinada por su perfil).
- RF-13: El contador debe poder ver una cola de cargas agrupadas en: listas para verificar, bloqueadas por corte de venta pendiente, y esperando al vendedor.
- RF-14: El sistema debe comparar automáticamente el conteo del vendedor contra el del contador, mostrando solo los productos con discrepancia.
- RF-15: La resolución de una discrepancia requiere que una persona capture la cantidad final y la otra persona (obligatoriamente distinta) la confirme con su propio PIN.
- RF-16: Al resolverse todas las discrepancias, el sistema debe enviar la carga a Handy mediante el endpoint de creación de ruta.

### RF — Recarga
- RF-17: El vendedor debe poder solicitar una recarga durante el día, con el catálogo filtrado por default a los productos ya incluidos en la carga inicial de ese día (con búsqueda disponible para excepciones).
- RF-18: El segundo conteo de una recarga debe registrar si ocurrió en almacén o en calle (camioneta de refuerzo), sin que esto cambie el permiso del usuario.
- RF-19: El envío de una recarga debe usar el endpoint de recarga de Handy, distinto al de creación de ruta.

### RF — Validaciones e integración con Handy
- RF-20: Antes de reintentar un envío tras un error de red, el sistema debe consultar el estatus de ruta abierta actual en Handy para evitar duplicados.
- RF-21: Si Handy rechaza uno o más productos por inventario insuficiente, el sistema debe aislar esos productos sin bloquear el envío del resto de la carga.
- RF-22: El catálogo de productos y de usuarios vendedores debe sincronizarse periódicamente desde Handy (completa e incremental).

### RF — Auditoría y supervisión
- RF-23: El supervisor debe poder consultar el historial completo de cargas comparadas, con o sin discrepancia, filtrable por fecha, ruta y estado de verificación.
- RF-24: El supervisor debe poder registrar una referencia de evidencia externa (texto libre) por carga.
- RF-25: El supervisor debe poder iniciar una revisión tipo "stepper" sobre cualquier carga ya enviada, confirmando o marcando como incorrecta la cantidad de cada producto, con campo opcional de cantidad real encontrada.
- RF-26: Si la revisión de supervisor detecta al menos una discrepancia, el sistema debe generar una alerta de urgencia alta.

### RF — Alertas
- RF-27: El sistema debe generar alertas categorizadas por tipo y urgencia (alta, media, baja) ante los eventos definidos (token inválido, envío incierto, inventario insuficiente, corte pendiente, validación forzada, discrepancia en revisión de supervisor, fallo de sincronización).
- RF-28: Las alertas de urgencia alta deben enviarse como notificación push a los dispositivos de los usuarios con rol Supervisor.
- RF-29: Toda alerta debe quedar visible en un centro de alertas dentro de la app, con posibilidad de marcarse como resuelta.

## 5. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Seguridad | El token de integración de Handy nunca debe residir en el dispositivo cliente; solo en el backend, como variable de entorno. |
| Seguridad | Los PINs deben almacenarse con hash (bcrypt/argon2), nunca en texto plano. |
| Disponibilidad | La app debe operar de forma consistente en un entorno con conectividad confiable (no se requiere modo offline en el MVP). |
| Usabilidad | La captura de conteo debe optimizarse para velocidad (tap sobre teclado), dado su uso diario y repetitivo. |
| Auditabilidad | Todo registro de conteo, discrepancia y resolución debe conservar usuario y timestamp, sin excepción. |
| Compatibilidad | La app debe funcionar en dispositivos Android (operación) e iOS (supervisión). |
| Mantenibilidad | El modelo de datos debe distinguir claramente entre catálogo replicado de Handy (solo lectura) y datos propios del sistema. |

## 6. Reglas de negocio clave

1. El doble conteo (vendedor + contador) es obligatorio tanto en carga inicial como en recarga.
2. El vendedor puede contar sin restricción, incluso si tiene un corte de venta anterior pendiente; el bloqueo aplica únicamente a la verificación del contador.
3. Ningún producto puede quedar marcado como resuelto en una discrepancia sin la confirmación cruzada de una segunda persona.
4. Las cargas sin discrepancia deben ser igual de auditables que las que sí la tuvieron (no debe existir una restricción de acceso basada en si "cuadró" o no).
5. La verificación de supervisor es completamente discrecional; el sistema no debe forzar ni sugerir automáticamente cuáles cargas revisar (queda para una fase futura como mejora, no como regla del MVP).

## 7. Glosario

- **Carga inicial:** inventario con el que un vendedor sale a vender al inicio de su jornada.
- **Recarga:** inventario adicional asignado a una ruta durante el día, tras la carga inicial.
- **Corte de venta:** cierre de la ruta en Handy, donde se liquida el inventario y dinero de la jornada.
- **Colusión:** acuerdo entre dos partes (en este caso, vendedor y contador) para reportar información falsa de común acuerdo.
- **`usuario_handy_id`:** identificador del usuario vendedor dentro de la plataforma Handy, requerido para asignar cargas vía API.
