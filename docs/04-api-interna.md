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

**Errores de `POST /auth/login` (RF-03).** Todo fallo responde `401` con este cuerpo:

```json
{ "statusCode": 401, "codigo": "PIN_INCORRECTO", "mensaje": "PIN incorrecto. Te quedan 3 intentos antes del bloqueo temporal.", "intentosRestantes": 3, "bloqueadoHasta": null }
```

| `codigo` | Cuándo | `intentosRestantes` | `bloqueadoHasta` |
|---|---|---|---|
| `PIN_INCORRECTO` | PIN equivocado sin llegar al bloqueo | número | `null` |
| `USUARIO_BLOQUEADO` | Este intento activó el bloqueo, o ya estaba bloqueado | `0` | ISO 8601 |
| `USUARIO_INACTIVO` | Usuario dado de baja | `null` | `null` |
| `CREDENCIALES_INVALIDAS` | Usuario inexistente o PIN mal formado | `null` | `null` |

Revelar intentos restantes no abre enumeración de usuarios porque `GET /auth/usuarios` ya los lista públicamente. `POST /admin/usuarios/:id/restablecer-pin` también levanta el bloqueo.

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
| GET | `/admin/sincronizacion/factores-pendientes` | Supervisor (admin) | Productos activos sin factor de empaque confirmado: `[{ code, nombre, familia, modalidadVenta, piezasPorPaqueteSugerido }]`. `modalidadVenta` (`COMPLETO` \| `POR_PIEZA`) es la guardada hoy, aún sin confirmar. El sugerido sale del nombre (`C/12`, `X 12`, `12 pack`) o es `null` si hay que capturarlo; solo aplica si el producto se vende por pieza (en un dulce, `c/70` NO es factor). |
| PATCH | `/admin/sincronizacion/productos/:code/factor` | Supervisor (admin) | Confirma cómo se vende el producto y, si aplica, sus piezas por paquete. Body: `{ modalidadVenta: "COMPLETO" }` (el paquete es la unidad de venta: cuenta 1 a 1 y el factor queda en `null`) o `{ modalidadVenta: "POR_PIEZA", piezasPorPaquete }` (entero 1–500). Guarda quién y cuándo; desde ahí la sincronización ya no lo modifica. |

`POST /admin/sincronizacion/productos` devuelve además `factoresPendientesDeConfirmar`: cuántos productos activos siguen sin factor confirmado.

### 1.4 Cargas (inicial y recarga)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/eventos-carga` | Vendedor | Inicia un evento de carga. Body: `{ tipo: INICIAL\|RECARGA, fechaOperativa: "aaaa-mm-dd" }`. `fechaOperativa` es el día para el que sale el camión (distinto de `fechaConteo`); la app siempre propone mañana (hora de México; contar para hoy es la excepción, p. ej. camión descompuesto), pero el usuario decide y hoy se elige igual de fácil. **400** `FECHA_OPERATIVA_INVALIDA` si es un día pasado. Solo puede haber **una** carga `INICIAL` por ruta y `fechaOperativa` (en cualquier estado); una segunda responde **409** `YA_TIENE_CARGA_ABIERTA` con `eventoId` de la existente para que la app ofrezca continuarla. Además, una `INICIAL` no arranca si el vendedor tiene una ruta sin liquidar en Handy (`GET /user/{id}/route/current`): **409** `RUTA_ANTERIOR_SIN_LIQUIDAR` con `rutaHandyId`, salvo que la ruta tenga un permiso vigente del supervisor (ver `/admin/permisos-carga`), que se consume al crear el evento; el evento queda con `rutaHandySinLiquidarId`. Si Handy no responde no se bloquea: el evento se crea con `liquidacionNoVerificada: true`. La regla de fecha se revisa primero, así que una `INICIAL` existente siempre se puede continuar. Las `RECARGA` pueden ser varias por día y no pasan por ninguna de las dos reglas. En `RECARGA`, el backend obtiene automáticamente el catálogo ya cargado ese día. |
| POST | `/admin/permisos-carga` | Supervisor | Permiso puntual para que una ruta inicie su carga `INICIAL` con la ruta anterior del vendedor sin liquidar en Handy. Body: `{ rutaId, motivo }` (motivo de al menos 5 caracteres). Vence a las 24 h y es de un solo uso. **409** `YA_EXISTE_PERMISO_VIGENTE` (con `permisoId`) si la ruta ya tiene uno sin usar; **404** si la ruta no existe. Respuesta: `{ permiso }`. |
| GET | `/admin/permisos-carga` | Supervisor | Permisos cuya ventana de 24 h no ha vencido, **usados o no**, del que vence antes al que vence después: `{ permisos: [{ id, rutaId, rutaNombre, otorgadoPorId, otorgadoPorNombre, motivo, fechaOtorgado, fechaExpiracion, usado, eventoCargaId }] }`. Un permiso usado ya no sirve para otra carga; se lista para que el supervisor vea que se gastó. |
| GET | `/admin/permisos-carga/rutas` | Supervisor | Rutas activas para elegir al otorgar un permiso, por nombre: `{ rutas: [{ id, nombre, codigo, vendedorNombre }] }` (`vendedorNombre` es el de la asignación vigente, o `null`). |
| POST | `/eventos-carga/:id/sesiones` | Vendedor, Contador | Inicia la sesión de conteo del usuario autenticado sobre ese evento. Body (solo recarga, segundo conteo): `{ ubicacion: ALMACEN\|CALLE }`. |
| GET | `/eventos-carga/:id/productos` | Vendedor, Contador, Supervisor | Productos para el grid de conteo: los activos de la plantilla snapshot del evento (o el catálogo activo completo si no tiene plantilla). Respuesta: `{ plantillaId, familias: [{ familia, productos: [{ code, nombre, unidadCode, unidadDescripcion, familia, modalidadVenta, piezasPorPaquete, factorConfirmado }] }] }`, familias en orden alfabético (sin familia al final) y productos por nombre. |
| PATCH | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Guarda/actualiza lo contado (reemplazo total). Body: `{ items: [{ productoCode, paquetes, sueltas, capturadoEn? }] }`; `cantidad` (total en unidades de venta) la calcula el backend y se rechaza si llega: `paquetes * piezasPorPaquete + sueltas` si el producto se vende `POR_PIEZA`, o `paquetes` tal cual si se vende `COMPLETO` (ahí `sueltas` debe ser 0; si no, 409 `SUELTAS_EN_PRODUCTO_COMPLETO`). `capturadoEn` (ISO 8601, opcional) es la hora del dispositivo al capturar —la app cuenta sin conexión—; se guarda junto a `recibidoEn` (hora de llegada al servidor), que no cambia si el item llega idéntico en un reenvío. Responde cada item con `paquetes`, `sueltas`, `cantidad`, `capturadoEn`, `recibidoEn` y `sueltasExcedenPaquete`. 409 si se mandan paquetes de un producto sin factor confirmado y 404 si un producto no existe; ambos traen `productos: [codigos]` con los afectados. |
| GET | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Lo guardado en la sesión: `{ items: [{ productoCode, paquetes, sueltas, cantidad, capturadoEn, recibidoEn }] }`. La app lo usa al reabrir un conteo para reconciliar su copia local antes de volver a enviar. |
| POST | `/eventos-carga/:id/sesiones/:sesionId/finalizar` | Vendedor, Contador (dueño de la sesión) | Cierra la sesión; si ambas sesiones (vendedor y contador) están cerradas, dispara la comparación automática. |
| GET | `/eventos-carga/pendientes-verificacion` | Contador, Supervisor | Cola del contador: eventos en `EN_ESPERA_CONTADOR` o `BLOQUEADA_CORTE_PENDIENTE`, del más antiguo al más reciente. Cada fila: `{ id, rutaNombre, vendedorNombre, tipo, fechaConteo, totalProductos, bloqueadaPorCorte, fechaBloqueoCortePendiente, estadoVerificacion: LISTA\|BLOQUEADA_CORTE_PENDIENTE\|EN_CURSO_PROPIA\|EN_CURSO_OTRO, miSesionId, verificandoPor }`. `totalProductos` es cuántos productos registró el primer conteo; nunca se exponen sus cantidades (el segundo conteo es a ciegas). Aún no incluye las cargas que el vendedor sigue contando (grupo gris de docs/06 §3.3). |
| GET | `/eventos-carga/conflictos-pendientes` | Vendedor, Contador | Eventos en `CONFLICTOS_PENDIENTES` donde el usuario autenticado contó: `[{ id, rutaNombre, tipo, fechaConteo, totalDiscrepancias, resueltas }]`. |
| GET | `/eventos-carga/:id` | Vendedor (dueño), Contador, Supervisor | Detalle del evento, incluidas ambas sesiones y discrepancias si existen. |
| GET | `/eventos-carga/:id/discrepancias` | Vendedor (participante), Contador, Supervisor | Productos con discrepancia (pendientes o resueltas), por nombre de producto: `[{ productoCode, productoNombre, unidadDescripcion, modalidadVenta, piezasPorPaquete, factorConfirmado, cantidadVendedorOriginal, cantidadContadorOriginal, cantidadFinal, capturadaPor, capturadaPorNombre, fechaCaptura, confirmadaPor, confirmadaPorNombre, fechaConfirmacion, primerConteo, segundoConteo }]`. `primerConteo`/`segundoConteo` = `{ tipoSesion, paquetes, sueltas }`: el tipo de la sesión que hizo ese conteo (la app etiqueta por rol, nunca por nombre) y lo tecleado en bodega; `paquetes`/`sueltas` son `null` si ya no corresponden a la cantidad original (p. ej. una reapertura del supervisor). |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/capturar` | Vendedor (participante), Contador | Captura la cantidad final acordada, en piezas. Body: `{ cantidadFinal }`. Mientras no esté confirmada se puede recapturar (quien recaptura pasa a ser quien capturó). |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/confirmar` | Vendedor (participante), Contador | Confirma la cantidad capturada. Body: `{ cantidadFinal, pin }`: `cantidadFinal` es la que la persona ve en pantalla (si alguien la recapturó mientras tanto responde **409** `CANTIDAD_CAMBIO`, sin verificar el PIN); el PIN del usuario autenticado se verifica en ese momento con la misma política de intentos y bloqueo del login. Todos los rechazos son **403** (no 401, que la app interpreta como sesión vencida) con `codigo`: `AUTOCONFIRMACION_PROHIBIDA` (quien confirma es quien capturó; se revisa antes que el PIN y no gasta intentos), `PIN_INCORRECTO` (con `intentosRestantes`), `USUARIO_BLOQUEADO` (con `bloqueadoHasta`), `USUARIO_INACTIVO`. Respuesta: `{ discrepancia, enEsperaAutorizacion }`. |
| POST | `/eventos-carga/:id/enviar` | Vendedor, Contador, Supervisor | Dispara el envío a Handy (`POST /route` o `/route/recharge` según `tipo`). Solo permitido si no hay discrepancias pendientes. |

### 1.5 Historial y auditoría

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/historial?rutaId=&fechaInicio=&fechaFin=&estado=&conDiscrepancia=&sinLiquidar=&tipo=&page=&pageSize=` | Vendedor, Contador, Supervisor | Listado filtrable, ordenado por `fechaOperativa` (las fechas filtran sobre ella). Cada fila trae `inicioSinLiquidar` (`null`, o `{ rutaHandyId, permisoOtorgadoPorNombre, permisoMotivo }` si la `INICIAL` arrancó con la ruta anterior sin liquidar) y `liquidacionNoVerificada`; `sinLiquidar=true` filtra solo esas cargas. Alcance por rol, decidido desde el JWT y nunca por parámetros: Vendedor solo las cargas que él contó, Contador las de todos; ambos hasta 14 días atrás (una `fechaInicio` anterior se ignora). Supervisor: todo, sin límite. |
| GET | `/historial/:id` | Vendedor, Contador, Supervisor | Detalle completo, producto por producto, agrupado por familia; cada producto trae `unidadDescripcion`, `modalidadVenta`, `piezasPorPaquete` y `factorConfirmado` para mostrar la cantidad en paquetes (o en su unidad, si se vende completo). El evento trae `inicioSinLiquidar` y `liquidacionNoVerificada` como en el listado. Mismo alcance que el listado: una carga fuera de él responde **403** `FUERA_DE_ALCANCE`. |
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
