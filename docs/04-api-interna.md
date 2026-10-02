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
| GET | `/auth/usuarios` | Público (pantalla de login) | Lista de nombres/usuarios activos para selección visual (sin exponer PIN ni datos sensibles): `{ id, nombreCompleto, rolApp, fotoUrl }`. `fotoUrl` es la foto de perfil de Handy del vendedor vinculado; `null` si no tiene foto o no tiene cuenta en Handy (contador, supervisor). |
| POST | `/auth/login` | Público | Body: `{ usuarioAppId, pin }`. Devuelve JWT, `debeCambiarPin` y `usuario: { id, nombreCompleto, rolApp, fotoUrl }` (`fotoUrl` igual que en `/auth/usuarios`). |
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
| GET | `/admin/usuarios` | Supervisor (admin) | Lista completa, incluidos inactivos. Cada usuario trae `bloqueo`: `null` si puede entrar, o `{ desde, hasta }` (ISO 8601) si está bloqueado ahora mismo por intentos fallidos de PIN. Un bloqueo ya vencido sale como `null`. `desde` se deduce de `hasta` menos los 15 minutos del bloqueo. Las respuestas de `POST` y `PATCH /admin/usuarios` y de `desbloquear` traen el usuario con la misma forma. |
| POST | `/admin/usuarios` | Supervisor (admin) | Alta de usuario. Body: `{ nombreCompleto, rolApp, usuarioHandyId? }`. Devuelve PIN temporal. |
| PATCH | `/admin/usuarios/:id` | Supervisor (admin) | Editar nombre, rol, `usuarioHandyId`, o `activo`. |
| POST | `/admin/usuarios/:id/restablecer-pin` | Supervisor (admin) | Genera PIN temporal nuevo; marca `debeCambiarPin = true` y quita el bloqueo (`intentosFallidos = 0`, `bloqueadoHasta = null`). PIN y renglón de `historiales_restablecimiento_pin` se escriben en una sola transacción. Errores: **404** `USUARIO_NO_ENCONTRADO`; **400** `MOTIVO_REQUERIDO` (solo posible por línea de comandos, mapeado por si acaso). |
| POST | `/admin/usuarios/:id/desbloquear` | Supervisor (admin) | Quita al instante el bloqueo por intentos fallidos sin tocar el PIN: `intentosFallidos = 0`, `bloqueadoHasta = null`. Registra quién desbloqueó a quién, cuándo y hasta cuándo iba el bloqueo en `historiales_desbloqueo`. Sin body; quien desbloquea sale del JWT. Errores: **404** `USUARIO_NO_ENCONTRADO`; **400** `AUTODESBLOQUEO_PROHIBIDO` el id es el de quien llama (un supervisor bloqueado no puede entrar a hacerlo: necesita a otro supervisor o el procedimiento de docs/07 §12 (Recuperación de acceso)); **409** `NO_BLOQUEADO` no tiene bloqueo vigente (o venció mientras tanto). Respuesta: el usuario. |
| GET | `/admin/usuarios/:id/accesos?page=&pageSize=` | Supervisor (admin) | Historial de acceso de la persona: restablecimientos de PIN y desbloqueos en una sola lista, del más reciente al más antiguo. `pageSize` 20 por defecto, máximo 100. Respuesta `{ items, total, page, pageSize }`; cada renglón `{ id, tipo: "PIN_RESTABLECIDO" \| "BLOQUEO_QUITADO", fecha, origen: "SUPERVISOR" \| "LINEA_COMANDOS", autor: { id, nombreCompleto } \| null, motivo, bloqueadoHasta }`. `autor` es `null` solo en `LINEA_COMANDOS` (no hay sesión: nunca se sabrá quién), y entonces `motivo` trae el porqué; `bloqueadoHasta` solo en `BLOQUEO_QUITADO` (hasta cuándo iba el bloqueo que se quitó). Todos los campos vienen siempre, con `null` donde no aplican. Errores: **404** `USUARIO_NO_ENCONTRADO`. **Solo lectura, siempre**: no existe ni existirá endpoint que edite o borre estos renglones; una corrección se registra como un renglón nuevo. |
| GET | `/admin/usuarios-handy` | Supervisor (admin) | Cuentas de vendedor sincronizadas desde Handy, para vincular en el alta: `[{ idHandy, nombre, fotoUrl, activa, vinculadaA }]`, por nombre. `activa = false` si Handy ya no la lista. `vinculadaA` es `{ id, nombreCompleto }` del usuario **activo** que la ocupa, o `null` si está libre: un usuario dado de baja no la ocupa (cuando un vendedor se va, su cuenta —su ruta— pasa al usuario nuevo de quien llega). La app solo ofrece las activas y libres. |

En `POST /admin/usuarios`, `usuarioHandyId` es obligatorio si `rolApp = VENDEDOR` y prohibido para cualquier otro rol (400). La respuesta `{ usuario, pinTemporal }` y la de `POST /admin/usuarios/:id/restablecer-pin` (`{ pinTemporal }`) son la **única** vez que el PIN temporal existe en claro: el servidor solo guarda su hash y la app no lo persiste. Los rechazos de `PATCH /admin/usuarios/:id` responden `409` con `mensaje` listo para mostrarse tal cual: autodesactivación, cambio del propio rol, o dejar el sistema sin supervisor activo (`codigo: "ULTIMO_SUPERVISOR"`: desactivar al último supervisor activo o quitarle el rol). La regla del último supervisor se evalúa sobre el estado **después** del cambio: el caso de uso valida antes para dar el mensaje, y el adaptador aplica el cambio en una transacción con `pg_advisory_xact_lock`, cuenta los supervisores activos que quedan y la revierte si son cero (así dos supervisores que se desactivan el uno al otro al mismo tiempo no pasan los dos).

**Una cuenta de Handy, un solo usuario activo.** `POST` y `PATCH /admin/usuarios` responden **409** `{ statusCode, codigo: "CUENTA_HANDY_YA_ASIGNADA", mensaje, asignadaA: { id, nombreCompleto } }` si la cuenta de Handy que quedaría vinculada a un usuario **activo** ya la tiene otro usuario activo: al vincular una cuenta y también al **reactivar** a alguien cuya cuenta pasó a otra persona. `mensaje`: *"La cuenta de Handy de [nombre de la cuenta en Handy] ya está asignada a [nombre del otro usuario]. Desactiva a esa persona primero."* Los usuarios inactivos no ocupan la cuenta. La garantía real es un índice único parcial en `usuarios_app` (`usuarioHandyId` donde `activo = true`), creado con SQL a mano en la migración `cuenta_handy_unica_activa`; la validación del caso de uso solo da el mensaje.

### 1.2.1 Plantillas de carga

Una plantilla decide qué productos ve el vendedor de una ruta en su grid de conteo. La plantilla vive en la asignación vigente de la ruta (`AsignacionRutaVendedor.plantillaId`) y cada evento de carga guarda la suya como snapshot al crearse. Ids de plantilla y ruta: texto no vacío (las plantillas históricas tienen ids legibles creados por SQL, no CUID). Toda mutación responde la plantilla completa (mismo cuerpo que `GET /admin/plantillas/:id`).

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/admin/plantillas?incluirInactivas=` | Supervisor (admin) | Plantillas activas (todas con `incluirInactivas=true`): `[{ id, nombre, descripcion, activa, totalProductos, rutas: [{ id, nombre, codigo }] }]`. `rutas` = rutas con alguna asignación vigente que la usa. |
| GET | `/admin/plantillas/rutas` | Supervisor (admin) | Rutas activas con lo que usan hoy: `[{ id, nombre, codigo, vendedores: [nombre], plantillas: [{ id, nombre }], sinPlantilla }]`. `sinPlantilla` = algún vendedor vigente sin plantilla (ve el catálogo completo). |
| GET | `/admin/plantillas/:id` | Supervisor (admin) | Detalle: lo del listado más `familias: [{ familia, productos: [{ code, nombre, familia, modalidadVenta, piezasPorPaquete, factorConfirmado, activo }] }]`, en el mismo orden que el grid de conteo. Incluye productos desactivados en Handy (`activo: false`), que el grid no muestra. |
| POST | `/admin/plantillas` | Supervisor (admin) | Crea una plantilla vacía y activa. Body: `{ nombre, descripcion? }`. 409 `NOMBRE_DUPLICADO` si ya existe una con el mismo nombre (sin distinguir mayúsculas ni acentos, incluidas las inactivas). |
| PATCH | `/admin/plantillas/:id` | Supervisor (admin) | Renombrar, cambiar descripción (`null` o vacío la borra), activar o desactivar. Body: `{ nombre?, descripcion?, activa? }`, al menos uno. 409 `PLANTILLA_EN_USO` al desactivar una plantilla asignada a alguna ruta vigente; 409 `NOMBRE_DUPLICADO`. |
| POST | `/admin/plantillas/:id/productos` | Supervisor (admin) | Agrega varios productos. Body: `{ codes: [code] }`. Los que ya estaban se ignoran. Si algún código no existe en el catálogo no se agrega ninguno: 400 `PRODUCTOS_NO_ENCONTRADOS` con `productos: [code]`. Responde además `agregados` y `yaEstaban`. |
| POST | `/admin/plantillas/:id/productos/quitar` | Supervisor (admin) | Quita varios productos. Body: `{ codes: [code] }`; los que no estaban se ignoran. Responde además `quitados`. No afecta cargas ya creadas: el historial se lee de los conteos y `GET /eventos-carga/:id/productos` sigue incluyendo los productos que el evento ya contó. |
| PUT | `/admin/plantillas/:id/rutas/:rutaId` | Supervisor (admin) | La ruta pasa a usar esta plantilla: cambia `plantillaId` en todas sus asignaciones vigentes. Solo afecta cargas nuevas. 409 `PLANTILLA_INACTIVA`, 404 `RUTA_NO_ENCONTRADA` (inexistente o inactiva), 409 `RUTA_SIN_ASIGNACION_VIGENTE` (sin vendedor asignado). |

### 1.2.2 Colores de familia

El supervisor le da a cada familia del catálogo un color para ubicarla más rápido en el grid de conteo. La familia es el texto `Producto.familia` que llega de Handy; el color vive aparte en `ColorFamilia` (por nombre de familia, con quién lo asignó). **Por omisión ninguna familia tiene color.** El color es una clave de una paleta cerrada de 10 (`rojo`, `naranja`, `ambar`, `verde`, `turquesa`, `azul`, `indigo`, `violeta`, `rosa`, `cafe`), definida en `apps/backend/src/modules/catalogo/domain/colores-familia.ts` con su espejo en `apps/movil/src/theme/colores-familia.ts`; nunca un hex libre (ver docs/06 §1).

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/admin/familias` | Supervisor (admin) | Familias de los productos activos: `[{ familia, color: string \| null, productos }]`, ordenadas por nombre. Los productos sin familia no se listan. |
| PUT | `/admin/familias/:familia/color` | Supervisor (admin) | Body: `{ color: string \| null }`. Asigna el color (o lo reemplaza); `null` borra la asignación (idempotente). Responde `{ familia, color }`. 400 `COLOR_INVALIDO` si el color no está en la paleta; 404 `FAMILIA_NO_ENCONTRADA` si ningún producto activo tiene esa familia. `:familia` va codificada en la URL (`encodeURIComponent`). |

### 1.2.3 Días no laborables

Días sueltos o periodos que no se trabajan (festivos, paros, clima, Navidad), en la tabla `dias_no_laborables` (fecha normalizada al inicio del día en hora de México, motivo, quién y cuándo). El **domingo no se guarda aquí**: nunca es hábil porque sale de `DIAS_HABILES_SEMANA` (`apps/backend/src/modules/cargas/domain/calendario-laboral.ts`). Ver docs/01 §6 regla 9.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/admin/dias-no-laborables?desde=&hasta=` | Supervisor | Días marcados entre `desde` y `hasta` (ambos `aaaa-mm-dd`, inclusive, opcionales), en orden. Sin `desde`, desde hoy; sin `hasta`, un año después de `desde`. 400 si `desde` es posterior a `hasta`. Respuesta: `{ dias: [{ fecha: "aaaa-mm-dd", motivo, creadoPorNombre, creadoEn }] }`. |
| POST | `/admin/dias-no-laborables` | Supervisor | Body: `{ fecha: "aaaa-mm-dd", motivo: string }` (motivo mínimo 3 caracteres sin contar espacios, máx. 200). **400** `FECHA_PASADA` si ya pasó; **400** `DOMINGO` si no es hábil por la semana (ya está considerado); **400** `MOTIVO_REQUERIDO`; **409** `YA_MARCADO` si ese día ya estaba. **201** `{ dia }`. |
| DELETE | `/admin/dias-no-laborables/:fecha` | Supervisor | Quita el día (`:fecha` = `aaaa-mm-dd`): vuelve a ser hábil. **400** `FECHA_PASADA` (los pasados se quedan como registro); **404** si no estaba marcado. Responde `{ fecha }`. |
| GET | `/admin/dias-no-laborables/:fecha/cargas` | Supervisor | Previsualización antes de recorrer las cargas de ese día (`:fecha` = `aaaa-mm-dd`, marcado o no). Respuesta: `{ fecha, cargas: [CargaDelDia], excluidas: [CargaDelDia], destinoSugerido: "aaaa-mm-dd" \| null }`, con `CargaDelDia = { id, rutaNombre, vendedorNombre, tipo, estado, fechaOperativa: "aaaa-mm-dd", totalProductos }`. `cargas` son las que se moverían (todas salvo `CANCELADA` y `ENVIO_INCIERTO`, **`ENVIADA` incluidas**); `excluidas`, las que se quedan. `destinoSugerido` es el siguiente día hábil después de `:fecha` (`null` si no hay ninguno en 30 días). Ver docs/01 §6 regla 10. |
| POST | `/admin/cargas/recorrer` | Supervisor | Recorre **todas** las cargas de un día a otro día hábil, en **una sola transacción** (o se mueven todas o ninguna). Body: `{ fechaOrigen: "aaaa-mm-dd", fechaDestino: "aaaa-mm-dd", motivo: string }` (motivo mínimo 10 caracteres, máx. 500; el mismo para todas). Se mueven todas las de `fechaOrigen` salvo `CANCELADA` y `ENVIO_INCIERTO`; **las `ENVIADA` también** (corrige nuestro registro; la ruta en Handy no se toca). Por carga cambia `fechaOperativa` y escribe su renglón en `cambios_fecha_operativa`; sesiones e items no se tocan. Las recargas viajan con la inicial de su ruta (no se revisa la regla de recarga). Errores: **400** `MOTIVO_REQUERIDO`; **400** `FECHA_DESTINO_INVALIDA` el destino no es posterior al origen o ya pasó; **409** `FECHA_NO_DISPONIBLE` el destino no es día hábil; **409** `CONFLICTO_EN_DESTINO` alguna ruta ya tiene carga inicial en el destino: **no se mueve ninguna**, y trae `rutas: [{ rutaId, rutaNombre, eventoIdEnDestino }]`; **409** `SIN_DIAS_HABILES`. Respuesta: `{ movidas: number, eventos: [CargaDelDia] }` (ya con la fecha nueva; `movidas: 0` si el día no tenía nada que mover). |

### 1.3 Catálogo (solo lectura para la app, sincronizado desde Handy)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/productos?ruta=&q=` | Vendedor, Contador, Supervisor | Catálogo activo, ordenado por frecuencia de uso de la ruta indicada; `q` filtra por búsqueda de texto. |
| POST | `/admin/sincronizacion` | Vendedor, Contador, Supervisor | Sincronización completa con Handy: productos y luego vendedores. Es el mismo caso de uso que corre solo cada día a las 5:00 (docs/02 §4.6). Candado global: 2 minutos tras un éxito, 20 s tras un fallo (429). Ver detalle abajo. |
| GET | `/admin/sincronizacion/estado` | Vendedor, Contador, Supervisor | Cuándo fue la última sincronización y cómo quedó el cache. Ver detalle abajo. |
| GET | `/admin/sincronizacion/factores-pendientes` | Supervisor (admin) | Productos activos sin factor de empaque confirmado: `[{ code, nombre, familia, modalidadVenta, piezasPorPaqueteSugerido }]`. `modalidadVenta` (`COMPLETO` \| `POR_PIEZA`) es la guardada hoy, aún sin confirmar. El sugerido sale del nombre (`C/12`, `X 12`, `12 pack`) o es `null` si hay que capturarlo; solo aplica si el producto se vende por pieza (en un dulce, `c/70` NO es factor). |
| GET | `/admin/sincronizacion/factores` | Supervisor (admin) | Todos los productos activos con su empaque actual, confirmado o no (para corregir confirmaciones equivocadas): `[{ code, nombre, familia, modalidadVenta, piezasPorPaquete, factorConfirmado, confirmadoPor, fechaConfirmacionFactor }]`. Sin confirmar, `piezasPorPaquete` es solo la propuesta; `confirmadoPor` es el nombre de quien hizo la última confirmación. |
| GET | `/admin/sincronizacion/productos/:code/factor/cargas-en-curso` | Supervisor (admin) | `{ cargasEnCurso }`: cuántas cargas aún no enviadas a Handy (cualquier estado distinto de `ENVIADA`) tienen conteos del producto. Se consulta antes de cambiar el empaque: esos conteos se calcularon con el factor actual y no se recalculan. |
| PATCH | `/admin/sincronizacion/productos/:code/factor` | Supervisor (admin) | Confirma o corrige cómo se vende el producto y, si aplica, sus piezas por paquete. Body: `{ modalidadVenta: "COMPLETO" }` (el paquete es la unidad de venta: cuenta 1 a 1 y el factor queda en `null`) o `{ modalidadVenta: "POR_PIEZA", piezasPorPaquete }` (entero 1–500). Guarda quién y cuándo en el producto y registra cada cambio (valor anterior y nuevo, aunque ya estuviera confirmado) en la bitácora `cambios_factor_empaque`; desde ahí la sincronización ya no lo modifica. Responde el producto más `cargasEnCurso` (no bloquea el cambio). |

#### `POST /admin/sincronizacion`

Sin body. Puede tardar varios segundos (varias páginas contra Handy). Responde qué **cambió**, no cuántos registros se procesaron:

```json
{
  "productos":  { "nuevos": 3, "actualizados": 1, "desactivados": 0, "sinConfirmarEmpaque": 2 },
  "vendedores": { "nuevos": 0, "actualizados": 1, "desactivados": 0 },
  "sincronizadoEn": "2026-09-30T21:00:00.000Z"
}
```

- `nuevos`: no existían en el cache local.
- `actualizados`: existían y cambió algún campo real (productos: nombre, precio, familia, unidad; vendedores: nombre, email, rol, foto) o volvieron a estar habilitados. Si nada cambió no cuentan.
- `desactivados`: estaban activos aquí y Handy ya no los lista como habilitados (se detectan por ausencia, con candados: docs/02 §4.1). Nunca se borran.
- `sinConfirmarEmpaque`: productos activos con `factorConfirmado = false`. **No se pueden contar** hasta que un supervisor confirme cómo se venden.
- La sincronización nunca modifica `modalidadVenta` ni `piezasPorPaquete` de un producto con el empaque confirmado.
- Orden: primero productos, luego vendedores. Si productos falla, vendedores no corre y responde el error. Si productos pasa y vendedores falla, responde **200** con `"vendedores": null` y `"errorVendedores": "<motivo en palabras>"`.
- Errores de Handy → **502** `{ statusCode, codigo, mensaje, detalle }`: `HANDY_NO_DISPONIBLE` (5xx, timeout o sin red: reintentar en un momento), `HANDY_TOKEN_INVALIDO` (401: no se arregla reintentando, lo resuelve el administrador en el servidor), `HANDY_RESPUESTA_INESPERADA`. `detalle` es solo para depuración y nunca contiene el token.

**Quién puede sincronizar (cambio de 2026-09-30).** Los tres roles, por decisión del dueño (antes solo Supervisor). Los endpoints del factor de empaque (`factores`, `factores-pendientes`, `productos/:code/factor…`) siguen siendo **solo Supervisor**: sincronizar no desbloquea nada a vendedor ni contador (confirmar el empaque y armar la plantilla son del supervisor); el botón les sirve para saber que un producto ya llegó y a quién avisarle.

**Candado (2 minutos tras un éxito, 20 segundos tras un fallo).** Si la última sincronización —de quien sea, incluida la automática de las 5:00— **empezó** hace menos de 2 minutos y salió bien (o sigue en curso), responde sin llamar a Handy:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 110

{ "statusCode": 429, "codigo": "SINCRONIZACION_RECIENTE", "mensaje": "Alguien acaba de sincronizar. Espera un momento y vuelve a intentarlo.", "reintentarEn": "2026-09-30T16:02:00.000Z" }
```

Si la última **falló** (Handy caído, token inválido, red), la espera es de solo 20 segundos y el mensaje no dice que alguien sincronizó, porque no se sincronizó nada:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 15

{ "statusCode": 429, "codigo": "SINCRONIZACION_FALLIDA_RECIENTE", "mensaje": "El intento anterior falló. Espera unos segundos y vuelve a intentarlo.", "reintentarEn": "2026-09-30T16:00:20.000Z" }
```

- Los 20 segundos tras un fallo solo evitan que alguien le pegue a Handy en bucle; no castigan por una falla ajena. Se decide con `exito` de la última fila de la bitácora; si quedó sin cerrar (`exito = null`), cuenta como en curso: 2 minutos.
- Es **global**, no por usuario: lo que se protege es la API de Handy, y con once dispositivos alguien ansioso podría golpearla decenas de veces por minuto.
- Cuenta desde el **inicio**: una sincronización en curso ya bloquea a la siguiente. Leer la última y registrar la nueva ocurre de forma atómica (`pg_advisory_xact_lock`), así que dos peticiones simultáneas no pasan las dos.
- Un intento rechazado con 429 no se registra ni alarga el candado.
- La corrida automática de las 5:00 no se frena por el candado, pero se registra y cuenta para él.
- Para la app no es un error: lo muestra como aviso, sin alarma.

**Bitácora.** Cada sincronización deja una fila en `registros_sincronizacion`: `origen` (`MANUAL` | `AUTOMATICA`), `usuarioAppId` (quién la pidió, del JWT; `null` en la automática), `iniciadaEn`, `terminadaEn` y `exito`.

Sustituye a `POST /admin/sincronizacion/productos` y `POST /admin/sincronizacion/usuarios-handy`, que se retiraron: con un solo punto de entrada el botón y la corrida automática no pueden divergir.

#### `GET /admin/sincronizacion/estado`

```json
{ "ultimaSincronizacion": "2026-09-30T11:00:00.000Z", "productosActivos": 104, "vendedoresActivos": 5, "sinConfirmarEmpaque": 2 }
```

`ultimaSincronizacion` es el máximo entre `Producto.ultimaSincronizacionLocal` y `UsuarioHandy.ultimaSincronizacion` (`null` si nunca se ha sincronizado): la última que **trajo** datos. El candado no la usa: se basa en la bitácora `registros_sincronizacion`, que también registra los intentos fallidos.

### 1.4 Cargas (inicial y recarga)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/eventos-carga` | Vendedor | Inicia un evento de carga. Body: `{ tipo: INICIAL\|RECARGA, fechaOperativa: "aaaa-mm-dd" }`. `fechaOperativa` es el día para el que sale el camión (distinto de `fechaConteo`). Sigue el calendario laboral (docs/01 §6 regla 9): tiene que ser una de las opciones de `GET /eventos-carga/fechas-operativas-disponibles` (hoy si es hábil, o el siguiente día hábil), y la app solo ofrece esas. **400** `FECHA_OPERATIVA_INVALIDA` si es un día pasado; **409** `FECHA_NO_DISPONIBLE` ("Solo puedes cargar para hoy o para la siguiente salida.") si no es hoy-hábil ni la siguiente salida (domingo, día no laborable, varios días adelante), en `INICIAL` y en `RECARGA`; **409** `SIN_DIAS_HABILES` si los días no laborables no dejan ningún día hábil en 30 días (configuración imposible). Solo puede haber **una** carga `INICIAL` por ruta y `fechaOperativa` (en cualquier estado salvo `CANCELADA`: cancelar la inicial libera el día); una segunda responde **409** `YA_TIENE_CARGA_ABIERTA` con `eventoId` de la existente para que la app ofrezca continuarla. Además, una ruta no puede tener más de **una** carga `INICIAL` sin terminar (en cualquier estado que no sea `ENVIADA` ni `CANCELADA`), sea de la fecha que sea: el camión es uno. Si ya hay una en **otra** fecha responde **409** `CARGA_INICIAL_SIN_TERMINAR` con `eventoId` de esa carga y un `mensaje` que la nombra con fecha y estado en palabras ("Esta ruta ya tiene una salida sin terminar: la del sábado 3 de octubre, que está en espera del contador. Termínala, cancélala o cámbiale la fecha antes de empezar otra."); si es de la **misma** fecha gana `YA_TIENE_CARGA_ABIERTA`. Si dos solicitudes chocan al mismo tiempo, el índice único parcial `evento_carga_inicial_sin_terminar_unica` rechaza la segunda con el mismo **409**; si para entonces la carga en conflicto ya no se encuentra, `eventoId` es `null` y el mensaje es genérico ("Esta ruta ya tiene una salida sin terminar. …"). Las `RECARGA` no entran en esta regla. La liquidación de la ruta anterior en Handy **no** se revisa aquí: el vendedor puede iniciar y contar siempre (a veces hay que cargar un camión sin liquidar, p. ej. para moverlo en la bodega). El bloqueo vive en la verificación del contador (ver `POST /eventos-carga/:id/sesiones`). Las `RECARGA` pueden ser varias por día, pero cada una exige que la ruta tenga su carga `INICIAL` de esa misma `fechaOperativa` en estado `ENVIADA` (la ruta en Handy nace al enviar la inicial y `/route/recharge` le suma producto a esa ruta abierta; docs/01 §6 regla 7): si no existe, o existe en cualquier otro estado, responde **409** `SIN_SALIDA_ENVIADA` y no se crea nada. `ENVIADA` **no** implica que la ruta siga abierta (Handy la cierra al liquidar o cancelar y no nos avisa), así que además se consulta a Handy la ruta abierta del vendedor: si no tiene, o la abierta no es la de esa inicial (`idHandy`), responde **409** `SIN_RUTA_ABIERTA_EN_HANDY` y no se crea nada. Si Handy no se puede consultar (401, 5xx, sin respuesta, estado inesperado) no se bloquea: pasa con la regla local. La app no deja elegir la fecha de una recarga libremente: la toma de `GET /eventos-carga/dias-recargables`. En `RECARGA`, el backend obtiene automáticamente el catálogo ya cargado ese día. |
| POST | `/eventos-carga/:id/sesiones` | Vendedor, Contador | Inicia la sesión de conteo del usuario autenticado sobre ese evento. Body (solo recarga, segundo conteo): `{ ubicacion: ALMACEN\|CALLE }`. Solo si quien la abre es el **Contador**, antes se revisa en Handy si la ruta abierta del vendedor impide la salida nueva (docs/01 §6 regla 2, docs/02 §4.5): una ruta del día anterior a la carga, dentro de la tolerancia de liquidación, **no** bloquea (solo genera alerta baja al supervisor); una del mismo día o posterior, una más vieja que la tolerancia, o una que no salió de esta app, sí: el evento pasa a `BLOQUEADA_CORTE_PENDIENTE` y responde **409** `CORTE_PENDIENTE`; si el evento ya estaba bloqueado, responde lo mismo sin consultar Handy (se libera con `POST /eventos-carga/:id/desbloquear`). La sesión del Vendedor nunca pasa por esta revisión, y una carga `RECARGA` tampoco: su ruta abierta en Handy es justamente la que se recarga. **409** `CARGA_CANCELADA` si el evento está cancelado. |
| GET | `/eventos-carga/:id/productos` | Vendedor, Contador, Supervisor | Productos para el grid de conteo: los activos de la plantilla snapshot del evento (o el catálogo activo completo si no tiene plantilla). Respuesta: `{ plantillaId, familias: [{ familia, color, productos: [{ code, nombre, unidadCode, unidadDescripcion, familia, modalidadVenta, piezasPorPaquete, factorConfirmado }] }] }`, familias en orden alfabético (sin familia al final) y productos por nombre. `color`: el color de familia asignado por el supervisor (§1.2.2) o `null`; siempre `null` en el grupo sin familia. |
| PATCH | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Guarda/actualiza lo contado (reemplazo total). Body: `{ items: [{ productoCode, paquetes, sueltas, capturadoEn? }] }`; `cantidad` (total en unidades de venta) la calcula el backend y se rechaza si llega: `paquetes * piezasPorPaquete + sueltas` si el producto se vende `POR_PIEZA`, o `paquetes` tal cual si se vende `COMPLETO` (ahí `sueltas` debe ser 0; si no, 409 `SUELTAS_EN_PRODUCTO_COMPLETO`). `capturadoEn` (ISO 8601, opcional) es la hora del dispositivo al capturar —la app cuenta sin conexión—; se guarda junto a `recibidoEn` (hora de llegada al servidor), que no cambia si el item llega idéntico en un reenvío. Responde cada item con `paquetes`, `sueltas`, `cantidad`, `capturadoEn`, `recibidoEn` y `sueltasExcedenPaquete`. 409 si se mandan paquetes de un producto sin factor confirmado y 404 si un producto no existe; ambos traen `productos: [codigos]` con los afectados. **409** `CARGA_CANCELADA` si el evento se canceló (p. ej. la cola offline de un teléfono que envía tarde): no se escribe nada. |
| GET | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Lo guardado en la sesión: `{ items: [{ productoCode, paquetes, sueltas, cantidad, capturadoEn, recibidoEn }] }`. La app lo usa al reabrir un conteo para reconciliar su copia local antes de volver a enviar. |
| POST | `/eventos-carga/:id/sesiones/:sesionId/finalizar` | Vendedor, Contador (dueño de la sesión) | Cierra la sesión; si ambas sesiones (vendedor y contador) están cerradas, dispara la comparación automática. |
| GET | `/eventos-carga/fechas-operativas-disponibles` | Vendedor, Supervisor | Los únicos días que se pueden elegir como `fechaOperativa`, con su etiqueta. Respuesta: `{ opciones: [{ fecha: "aaaa-mm-dd", etiqueta: string, esHoy: boolean }] }`, en orden. **Vendedor:** una o dos: hoy (solo si es hábil) y el siguiente día hábil (sábado → sábado y lunes; domingo → lunes). **Supervisor:** todos los días hábiles de hoy a 30 días; los usa al mover una carga (`PATCH .../fecha-operativa`). La `etiqueta` la arma el servidor porque depende del calendario: `"Hoy, sábado 26 de septiembre"`, `"Mañana, martes 29 de septiembre"` (solo si de verdad es mañana) o `"El lunes 28 de septiembre"`; nunca dice "mañana" si el siguiente día hábil no es mañana. La app no genera fechas por su cuenta: sin esta respuesta no ofrece ninguna. **409** `SIN_DIAS_HABILES` si no hay ningún día hábil en 30 días. |
| GET | `/eventos-carga/dias-recargables` | Vendedor | Día en que el vendedor puede iniciar una recarga. Se le pregunta a Handy (`route/current`), porque el estado `ENVIADA` **no** implica ruta abierta: solo dice que la carga salió alguna vez. Respuesta: `{ dias: [{ fechaOperativa, eventoInicialId }], motivo?, verificadoConHandy }`; `fechaOperativa` es el inicio de ese día en hora de México (ISO 8601), igual que en el evento. Casos: Handy sin ruta abierta → `{ dias: [], motivo: "SIN_RUTA_ABIERTA", verificadoConHandy: true }`; ruta abierta cuyo id coincide con el `idHandy` de una `INICIAL` `ENVIADA` de la ruta del vendedor → `{ dias: [ese día], verificadoConHandy: true }` (siempre uno solo; la fecha la manda Handy, sin filtrar por hoy); ruta abierta que no salió de esta app → `{ dias: [], motivo: "RUTA_NO_RECONOCIDA", verificadoConHandy: true }`; Handy no se puede consultar → las `INICIAL` `ENVIADA` de su ruta con `fechaOperativa` de hoy en adelante, en orden, con `verificadoConHandy: false` (la app deja contar pero advierte). Sin asignación vigente: `{ dias: [], motivo: "SIN_RUTA_ASIGNADA", verificadoConHandy: false }` sin consultar Handy. **409** si el usuario no está vinculado a Handy. La app ofrece solo estos días: con cero no deja iniciar la recarga, con uno pide solo confirmación, con varios muestra únicamente esos. |
| GET | `/eventos-carga/pendientes-verificacion` | Contador, Supervisor | Cola del contador: eventos en `EN_ESPERA_CONTADOR` o `BLOQUEADA_CORTE_PENDIENTE`, del más antiguo al más reciente. Cada fila: `{ id, rutaNombre, vendedorNombre, tipo, fechaConteo, fechaOperativa, totalProductos, bloqueadaPorCorte, fechaBloqueoCortePendiente, estadoVerificacion: LISTA\|BLOQUEADA_CORTE_PENDIENTE\|EN_CURSO_PROPIA\|EN_CURSO_OTRO, miSesionId, verificandoPor }`. `totalProductos` es cuántos productos registró el primer conteo; nunca se exponen sus cantidades (el segundo conteo es a ciegas). Aún no incluye las cargas que el vendedor sigue contando (grupo violeta de docs/06 §3.3). |
| GET | `/eventos-carga/conflictos-pendientes` | Vendedor, Contador | Eventos en `CONFLICTOS_PENDIENTES` donde el usuario autenticado contó: `[{ id, rutaNombre, tipo, fechaConteo, totalDiscrepancias, resueltas }]`. |
| GET | `/eventos-carga/:id` | Vendedor (dueño), Contador, Supervisor | Detalle del evento, incluidas ambas sesiones y discrepancias si existen. |
| GET | `/eventos-carga/:id/discrepancias` | Vendedor (participante), Contador, Supervisor | Productos con discrepancia (pendientes o resueltas), por nombre de producto: `[{ productoCode, productoNombre, unidadDescripcion, modalidadVenta, piezasPorPaquete, factorConfirmado, cantidadVendedorOriginal, cantidadContadorOriginal, cantidadFinal, capturadaPor, capturadaPorNombre, fechaCaptura, confirmadaPor, confirmadaPorNombre, fechaConfirmacion, primerConteo, segundoConteo }]`. `primerConteo`/`segundoConteo` = `{ tipoSesion, paquetes, sueltas }`: el tipo de la sesión que hizo ese conteo (la app etiqueta por rol, nunca por nombre) y lo tecleado en bodega; `paquetes`/`sueltas` son `null` si ya no corresponden a la cantidad original (p. ej. una reapertura del supervisor). |
| GET | `/eventos-carga/:id/participantes` | Vendedor (participante), Contador, Supervisor | De qué carga se trata y quiénes contaron en ella: `{ rutaNombre, tipo, fechaOperativa, participantes: [{ usuarioAppId, nombreCompleto, tipoSesion }] }` (una entrada por persona, en el orden en que empezaron a contar). La pantalla de resolución lo usa para su encabezado y para ofrecer "¿Quién confirma?" en el mismo dispositivo. **404** si el evento no existe. |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/capturar` | Vendedor (participante), Contador | Captura la cantidad final acordada, en piezas. Body: `{ cantidadFinal }`. Mientras no esté confirmada se puede recapturar (quien recaptura pasa a ser quien capturó). |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/confirmar` | Vendedor (participante), Contador | Confirma la cantidad capturada. Body: `{ cantidadFinal, pin }`: `cantidadFinal` es la que la persona ve en pantalla (si alguien la recapturó mientras tanto responde **409** `CANTIDAD_CAMBIO`, sin verificar el PIN); el PIN del usuario autenticado se verifica en ese momento con la misma política de intentos y bloqueo del login. Todos los rechazos son **403** (no 401, que la app interpreta como sesión vencida) con `codigo`: `AUTOCONFIRMACION_PROHIBIDA` (quien confirma es quien capturó; se revisa antes que el PIN y no gasta intentos), `PIN_INCORRECTO` (con `intentosRestantes`), `USUARIO_BLOQUEADO` (con `bloqueadoHasta`), `USUARIO_INACTIVO`, `CONFIRMADOR_NO_PARTICIPA`. Respuesta: `{ discrepancia, enEsperaAutorizacion }`. **Dos modalidades que conviven.** *Entre dispositivos* (sin `confirmaUsuarioAppId`): confirma quien tiene la sesión y el PIN es el suyo. *En el mismo dispositivo* (`confirmaUsuarioAppId` en el body): quien tiene la sesión le pasa el teléfono a otra persona, que elige su nombre y teclea **su** PIN; el servidor verifica el PIN contra `confirmaUsuarioAppId`, exige que esa persona haya contado en la carga (si no, `CONFIRMADOR_NO_PARTICIPA`, sin gastar intentos) y aplica igual la regla de persona distinta: si es quien capturó, `AUTOCONFIRMACION_PROHIBIDA`. |
| POST | `/eventos-carga/:id/enviar` | Vendedor, Contador, Supervisor | Dispara el envío a Handy (`POST /route` o `/route/recharge` según `tipo`). Solo permitido si no hay discrepancias pendientes. |
| POST | `/eventos-carga/:id/cancelar` | Vendedor, Supervisor | Cancela una carga no enviada. Nunca se borra: queda `CANCELADA` con quién, cuándo y motivo, se cierran sus sesiones abiertas y sigue visible en el historial. Body: `{ motivo?: string }` (máx. 500). **Vendedor:** solo su propia carga (su `usuarioHandyId`) y solo en `BORRADOR`; motivo opcional. **Supervisor:** cualquier carga salvo `ENVIADA`, `CANCELADA` y `ENVIO_INCIERTO`; motivo obligatorio, mínimo 10 caracteres. Errores: **404** no existe; **403** contador o carga ajena; **409** `ESTADO_INVALIDO` el estado no lo admite para ese rol; **400** `MOTIVO_REQUERIDO`. Respuesta: `{ evento }`. |
| PATCH | `/eventos-carga/:id/fecha-operativa` | Vendedor, Supervisor | Mueve la carga a otro día operativo **sin tocar lo contado** (sesiones e items quedan igual: cuelgan de la sesión, no de la fecha). En una transacción actualiza `fechaOperativa` y registra el cambio en `cambios_fecha_operativa` (fecha anterior, nueva, quién, motivo). Body: `{ fechaOperativa: "aaaa-mm-dd", motivo?: string }` (motivo máx. 500). **Vendedor:** solo su propia carga y solo en `BORRADOR`; motivo opcional (docs/01 §6 regla 8: después de que el contador contó, mover la fecha sería una escapatoria). **Supervisor:** cualquier carga salvo `CANCELADA` y `ENVIO_INCIERTO`; motivo obligatorio, mínimo 10 caracteres. Una `ENVIADA` **sí** se mueve: corrige nuestro registro y la ruta en Handy no se toca (docs/01 §6 regla 8). **Contador:** nunca. El día nuevo sigue las reglas de `POST /eventos-carga`, con el calendario laboral por rol (docs/01 §6 regla 9): el **vendedor** solo a hoy (si es hábil) o al siguiente día hábil; el **supervisor** a cualquier día hábil de hoy en adelante. Errores: **404** `NO_ENCONTRADA`; **403** `NO_PERMITIDO` contador o carga ajena; **409** `ESTADO_INVALIDO`; **400** `FECHA_OPERATIVA_INVALIDA` día pasado; **409** `FECHA_NO_DISPONIBLE` el calendario no lo permite (vendedor: "Solo puedes cargar para hoy o para la siguiente salida."; supervisor: "Ese día no se trabaja."); **409** `SIN_DIAS_HABILES`; **400** `MISMA_FECHA` ya es para ese día; **400** `MOTIVO_REQUERIDO`; **409** `YA_TIENE_CARGA_ABIERTA` (inicial) la ruta ya tiene otra inicial no cancelada ese día, con su `eventoId`; **409** `SIN_SALIDA_ENVIADA` / `SIN_RUTA_ABIERTA_EN_HANDY` (recarga) el día nuevo no tiene salida enviada y abierta en Handy (si Handy no responde, pasa con la regla local). Respuesta: `{ evento }`. |
| POST | `/eventos-carga/:id/cancelar-en-handy` | Supervisor | Cancela en Handy una carga `ENVIADA` (`DELETE /route/{idHandy}`) y, **solo si Handy lo confirma**, la marca `CANCELADA`. Body: `{ motivo: string }`, obligatorio (mínimo 10), validado antes de llamar a Handy. Errores: **404** no existe; **409** `ESTADO_INVALIDO` no está `ENVIADA` o no tiene `idHandy`; **400** `MOTIVO_REQUERIDO`; **409** `HANDY_RECHAZO` Handy ya no permite cancelarla (lo más probable, el vendedor ya la aceptó en su celular) — la carga sigue `ENVIADA`; **502** Handy no respondió — no cambió nada. Respuesta: `{ evento }`. |

### 1.5 Historial y auditoría

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/historial?rutaId=&fechaInicio=&fechaFin=&estado=&conDiscrepancia=&tipo=&page=&pageSize=` | Vendedor, Contador, Supervisor | Listado filtrable, ordenado por `fechaOperativa` (las fechas filtran sobre ella). Alcance por rol, decidido desde el JWT y nunca por parámetros: Vendedor solo las cargas que él contó, Contador las de todos; ambos hasta 14 días atrás (una `fechaInicio` anterior se ignora). Supervisor: todo, sin límite. Incluye las cargas `CANCELADAS` (es donde se auditan); cada fila trae además `canceladaPorNombre`, `fechaCancelacion` y `motivoCancelacion` (`null` si no está cancelada). |
| GET | `/historial/:id` | Vendedor, Contador, Supervisor | Detalle completo, producto por producto, agrupado por familia; cada producto trae `unidadDescripcion`, `modalidadVenta`, `piezasPorPaquete` y `factorConfirmado` para mostrar la cantidad en paquetes (o en su unidad, si se vende completo). Mismo alcance que el listado: una carga fuera de él responde **403** `FUERA_DE_ALCANCE`. El `evento` trae `canceladaPorNombre`, `fechaCancelacion` y `motivoCancelacion`, y `cambiosFecha: [{ fechaAnterior, fechaNueva, cambiadaPorNombre, motivo, creadoEn }]` (del más antiguo al más reciente; vacío si nunca se movió de día). |
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

### 1.6.1 Salud del servicio

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/salud` | Público (sin JWT, sin límite de peticiones) | `200 { estado: "ok", version, baseDeDatos: "ok" }` si la base responde a un `SELECT 1` en menos de 3 s; si no, `503 { estado: "error", version, baseDeDatos: "sin respuesta" }`. Render lo usa como health check. Nunca devuelve variables de entorno, cadena de conexión ni nada del token de Handy. |

### 1.7 Convenciones generales
- Formato de fecha: ISO 8601 (`2026-08-31T14:00:00-06:00`).
- Errores: cuerpo estándar `{ statusCode, mensaje, detalle? }`; nunca exponer mensajes crudos de la API de Handy directamente al usuario final, solo en `detalle` para depuración.
- Límites de peticiones: 1000 por minuto por IP en total; `POST /auth/login`, `POST /auth/cambiar-pin` y la confirmación de discrepancias con PIN comparten además un límite de 20 por minuto **por usuario** (el del PIN que se prueba: `usuarioAppId` o `confirmaUsuarioAppId` del cuerpo, o el de la sesión) y un techo de 150 por minuto por IP. Al pasarse: `429 { statusCode, codigo: "DEMASIADAS_SOLICITUDES", mensaje }`. Se suman al bloqueo por intentos fallidos de PIN. Detalle y cómo ajustarlos: docs/07 §9.1.
- Paginación: `?page=&pageSize=` en listados que puedan crecer (historial, catálogo).
- Todas las mutaciones devuelven el recurso actualizado completo, no solo un código de éxito — reduce llamadas adicionales desde la app.

---
