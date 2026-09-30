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
- RF-17: El vendedor debe poder solicitar una recarga durante el día, solo sobre una salida ya enviada a Handy (regla 7 de la sección 6), con el catálogo filtrado por default a los productos ya incluidos en la carga inicial de ese día (con búsqueda disponible para excepciones).
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
2. No puede salir un camión nuevo con el anterior sin cerrar. El vendedor puede contar sin restricción, incluso si tiene un corte de venta anterior pendiente; el bloqueo aplica únicamente a la verificación del contador, y solo cuando la ruta abierta en Handy **impide la salida nueva**. Lo que importa es de qué día es esa ruta: la carga de mañana se cuenta hoy en la tarde, con el camión de hoy todavía en la calle sin liquidar, y eso es el ciclo normal, no un corte pendiente. Por eso:
   - Ruta abierta de un día anterior a la carga, dentro de la tolerancia de liquidación (un día: sale hoy, liquida mañana; confirmado con el dueño, sept 2026): **no bloquea**; se avisa al supervisor con una alerta de urgencia baja.
   - Ruta abierta del mismo día (o posterior) que la carga: bloquea; sería una segunda salida con la primera sin cerrar.
   - Ruta abierta de más días atrás que la tolerancia: bloquea; el vendedor no está liquidando.
   - Ruta abierta que no salió de esta app: bloquea; no se puede saber de qué día es.
   - Una recarga nunca se bloquea: la ruta abierta es la que se recarga.
3. Ningún producto puede quedar marcado como resuelto en una discrepancia sin la confirmación cruzada de una segunda persona.
4. Las cargas sin discrepancia deben ser igual de auditables que las que sí la tuvieron (no debe existir una restricción de acceso basada en si "cuadró" o no).
5. La verificación de supervisor es completamente discrecional; el sistema no debe forzar ni sugerir automáticamente cuáles cargas revisar (queda para una fase futura como mejora, no como regla del MVP).
6. Solo puede haber una carga inicial por ruta y día operativo (cancelarla libera el día); las recargas pueden ser varias.
7. Una recarga solo se puede iniciar sobre una salida que ya está en Handy: debe existir la carga inicial de la misma ruta y el mismo día operativo en estado `ENVIADA`. La ruta en Handy nace cuando la inicial se envía, y la recarga le suma producto a esa ruta abierta; una inicial en borrador, esperando al contador o a autorización, con error de envío o cancelada todavía no puso nada en Handy. **Pero `ENVIADA` NO implica ruta abierta:** solo dice que esa carga salió hacia Handy alguna vez. Cuando el vendedor liquida (o se cancela la ruta en Handy), Handy la cierra y no nos avisa: el evento sigue `ENVIADA` para siempre. Por eso, además, se le pregunta a Handy (`GET /user/{id}/route/current`) si el vendedor tiene una ruta abierta **ahora**, y esa ruta debe ser justo la de la inicial (`idHandy`); si no hay ruta abierta o la abierta es otra, no se puede recargar: hay que iniciar una carga inicial nueva. Si Handy no se puede consultar (token, error de servidor, sin respuesta), no se bloquea al vendedor por la caída de un tercero: se aplica solo la regla local y la app advierte que no se pudo confirmar. Se valida al **iniciar** la recarga, no al enviarla, para no contar una recarga completa que Handy rechazaría al final con el camión esperando. Por lo mismo, la app no ofrece un calendario libre para la recarga: solo el día de la ruta que el vendedor tiene abierta en Handy (o, si Handy no responde, los días de hoy en adelante con una salida enviada de su ruta).
8. Una carga se puede mover a otro día operativo **sin perder lo contado** (los conteos cuelgan de la sesión, no de la fecha); queda registrado cada cambio con fecha anterior, fecha nueva, quién y por qué. El día nuevo sigue las mismas reglas que al iniciar: nunca un día pasado, una sola inicial por ruta y día, y una recarga solo sobre una salida enviada y abierta en Handy.
   - **Vendedor:** solo su propia carga y solo mientras él cuenta (`BORRADOR`); motivo opcional. Si pudiera mover la fecha después de que el contador contó, tendría una escapatoria cuando el conteo no le cuadra (lo muevo, empiezo otra y ahora sí coincidimos): es la misma razón por la que solo puede cancelar en `BORRADOR`.
   - **Supervisor:** cualquier carga salvo `CANCELADA` (no hay salida que mover) y `ENVIO_INCIERTO` (primero se resuelve); motivo obligatorio (mínimo 5 caracteres), porque mueve trabajo de otros. **`ENVIADA` sí se puede mover:** la `fechaOperativa` es contabilidad nuestra, no de Handy. La ruta en Handy se creó cuando se creó y sigue abierta; cambiar la fecha aquí corrige nuestro registro y no toca Handy. Sin esto, una carga enviada con la fecha equivocada quedaría mal registrada para siempre. La app lo dice antes de confirmar: "Esta carga ya se envió a Handy. Cambiar la fecha corrige tu historial; la ruta en Handy no se modifica."
   - **Contador:** nunca.
9. **Calendario laboral.** El negocio trabaja de **lunes a sábado**; el domingo no se trabaja. Además hay días sueltos que no se trabajan (festivos, paros, clima) y periodos completos (Navidad y Año Nuevo, a veces una semana), que un supervisor marca como **días no laborables**. El domingo **no** se marca: ya está fuera de la semana laboral (`DIAS_HABILES_SEMANA` en `domain/calendario-laboral`); la lista de días no laborables es solo para los días sueltos y los cierres. Un día es **hábil** si es de lunes a sábado y no está marcado.
   - **Vendedor:** al iniciar una carga (inicial o recarga) o al moverla de día, la fecha operativa solo puede ser **hoy, si hoy es hábil** (el camión se descompuso y se carga hoy para salir hoy), o **el siguiente día hábil** (lo normal: se cuenta por la tarde para la siguiente salida). A lo mucho dos opciones. Ejemplos: sábado → sábado o lunes; domingo → solo lunes; viernes → viernes o sábado; 24 de diciembre con el 25 de diciembre al 1 de enero marcados → 24 de diciembre o 2 de enero. Nunca un domingo, un día marcado, ni una carga para dentro de varios días.
   - **Supervisor:** al mover una carga puede elegir **cualquier día hábil de hoy en adelante** (lo necesita para recorrer cargas cuando no se trabajó un día), pero nunca un día no hábil.
   - Estas reglas se **suman** a la de nunca un día pasado; no la reemplazan.
   - La app **no calcula** qué días ofrecer: se los pide al servidor, que conoce el calendario, junto con la etiqueta del día ("Hoy, sábado 26 de septiembre" / "El lunes 28 de septiembre"). Nunca dice "mañana" si la siguiente salida no es mañana (el sábado, la siguiente salida es el lunes). Sin respuesta del servidor no se ofrecen fechas adivinadas.
   - Si los días marcados no dejan ningún día hábil en los siguientes 30 días, es un error de configuración: el servidor lo dice explícitamente en vez de inventar una fecha.
   - Solo un supervisor marca o quita días no laborables, y solo de hoy en adelante (los pasados se quedan como registro de por qué no hubo salida).
10. **Recorrer las cargas de un día no trabajado.** Pasa que los camiones amanecen cargados y el día no ocurre (frío, paro, clima). En Handy no hay nada que mover: la ruta sigue abierta y al día siguiente el vendedor sale con la misma carga física. Lo que queda mal es **nuestra** fecha operativa, y hay que corregirla por dos razones: el historial mentiría, y la regla del corte pendiente (regla 2) empezaría a contar días de retraso que no son reales. Por eso el supervisor puede recorrer **todas** las cargas de un día a otro día hábil de una sola vez:
    - **Alcance:** todas las cargas de esa fecha operativa que **no** estén `CANCELADA` ni `ENVIO_INCIERTO`. **Las `ENVIADA` también se mueven**, y son el caso típico: se contaron y se enviaron para un día que no se trabajó. Moverlas corrige nuestro registro; la ruta en Handy no se toca (mismo criterio que la regla 8).
    - **Destino:** un día hábil (regla 9) posterior al día de origen y que no haya pasado. Por defecto, el siguiente día hábil; el supervisor puede elegir otro.
    - **Motivo** obligatorio (mínimo 5 caracteres), el mismo para todas; cada carga deja su renglón en la bitácora de cambios de fecha (fecha anterior, nueva, quién y por qué). Lo contado no se toca.
    - **Todo o nada:** se mueven todas en una sola transacción. Un recorrido a medias partiría el día en dos y nadie sabría cuáles faltan.
    - **Una inicial por ruta y día** (regla 6): si alguna ruta ya tiene carga inicial en el día destino, **no se mueve ninguna** y se dice cuál ruta choca ("La Ruta 3 ya tiene una carga inicial para el lunes 5. Resuélvela antes de recorrer las demás.").
    - Las recargas se mueven junto con la inicial de su ruta, así que no pasan por la regla 7 al recorrer.
    - En la app, al marcar un día no laborable que ya tiene cargas se ofrece recorrerlas enseguida (con la lista: ruta, vendedor, estado y productos); también se puede arrancar desde un día ya marcado.

## 7. Glosario

- **Carga inicial:** inventario con el que un vendedor sale a vender al inicio de su jornada.
- **Recarga:** inventario adicional asignado a una ruta durante el día, tras la carga inicial.
- **Día hábil:** lunes a sábado que no está marcado como día no laborable. Solo en días hábiles sale un camión.
- **Día no laborable:** día suelto o parte de un periodo (festivo, paro, clima, cierre) que un supervisor marca para que ninguna carga salga ese día. El domingo no se marca: nunca es hábil.
- **Corte de venta:** cierre de la ruta en Handy, donde se liquida el inventario y dinero de la jornada.
- **Colusión:** acuerdo entre dos partes (en este caso, vendedor y contador) para reportar información falsa de común acuerdo.
- **`usuario_handy_id`:** identificador del usuario vendedor dentro de la plataforma Handy, requerido para asignar cargas vía API.
