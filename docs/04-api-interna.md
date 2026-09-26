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

### 1.3 Catálogo (solo lectura para la app, sincronizado desde Handy)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/productos?ruta=&q=` | Vendedor, Contador, Supervisor | Catálogo activo, ordenado por frecuencia de uso de la ruta indicada; `q` filtra por búsqueda de texto. |
| POST | `/admin/sincronizacion/productos` | Supervisor (admin) | Fuerza sincronización completa del catálogo. |
| POST | `/admin/sincronizacion/usuarios-handy` | Supervisor (admin) | Fuerza sincronización de usuarios vendedores. |
| GET | `/admin/sincronizacion/factores-pendientes` | Supervisor (admin) | Productos activos sin factor de empaque confirmado: `[{ code, nombre, familia, modalidadVenta, piezasPorPaqueteSugerido }]`. `modalidadVenta` (`COMPLETO` \| `POR_PIEZA`) es la guardada hoy, aún sin confirmar. El sugerido sale del nombre (`C/12`, `X 12`, `12 pack`) o es `null` si hay que capturarlo; solo aplica si el producto se vende por pieza (en un dulce, `c/70` NO es factor). |
| GET | `/admin/sincronizacion/factores` | Supervisor (admin) | Todos los productos activos con su empaque actual, confirmado o no (para corregir confirmaciones equivocadas): `[{ code, nombre, familia, modalidadVenta, piezasPorPaquete, factorConfirmado, confirmadoPor, fechaConfirmacionFactor }]`. Sin confirmar, `piezasPorPaquete` es solo la propuesta; `confirmadoPor` es el nombre de quien hizo la última confirmación. |
| GET | `/admin/sincronizacion/productos/:code/factor/cargas-en-curso` | Supervisor (admin) | `{ cargasEnCurso }`: cuántas cargas aún no enviadas a Handy (cualquier estado distinto de `ENVIADA`) tienen conteos del producto. Se consulta antes de cambiar el empaque: esos conteos se calcularon con el factor actual y no se recalculan. |
| PATCH | `/admin/sincronizacion/productos/:code/factor` | Supervisor (admin) | Confirma o corrige cómo se vende el producto y, si aplica, sus piezas por paquete. Body: `{ modalidadVenta: "COMPLETO" }` (el paquete es la unidad de venta: cuenta 1 a 1 y el factor queda en `null`) o `{ modalidadVenta: "POR_PIEZA", piezasPorPaquete }` (entero 1–500). Guarda quién y cuándo en el producto y registra cada cambio (valor anterior y nuevo, aunque ya estuviera confirmado) en la bitácora `cambios_factor_empaque`; desde ahí la sincronización ya no lo modifica. Responde el producto más `cargasEnCurso` (no bloquea el cambio). |

`POST /admin/sincronizacion/productos` devuelve además `factoresPendientesDeConfirmar`: cuántos productos activos siguen sin factor confirmado.

### 1.4 Cargas (inicial y recarga)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/eventos-carga` | Vendedor | Inicia un evento de carga. Body: `{ tipo: INICIAL\|RECARGA, fechaOperativa: "aaaa-mm-dd" }`. `fechaOperativa` es el día para el que sale el camión (distinto de `fechaConteo`); la app siempre propone mañana (hora de México; contar para hoy es la excepción, p. ej. camión descompuesto), pero el usuario decide y hoy se elige igual de fácil. **400** `FECHA_OPERATIVA_INVALIDA` si es un día pasado. Solo puede haber **una** carga `INICIAL` por ruta y `fechaOperativa` (en cualquier estado salvo `CANCELADA`: cancelar la inicial libera el día); una segunda responde **409** `YA_TIENE_CARGA_ABIERTA` con `eventoId` de la existente para que la app ofrezca continuarla. La liquidación de la ruta anterior en Handy **no** se revisa aquí: el vendedor puede iniciar y contar siempre (a veces hay que cargar un camión sin liquidar, p. ej. para moverlo en la bodega). El bloqueo vive en la verificación del contador (ver `POST /eventos-carga/:id/sesiones`). Las `RECARGA` pueden ser varias por día, pero cada una exige que la ruta tenga su carga `INICIAL` de esa misma `fechaOperativa` en estado `ENVIADA` (la ruta en Handy nace al enviar la inicial y `/route/recharge` le suma producto a esa ruta abierta; docs/01 §6 regla 7): si no existe, o existe en cualquier otro estado, responde **409** `SIN_SALIDA_ENVIADA` y no se crea nada. `ENVIADA` **no** implica que la ruta siga abierta (Handy la cierra al liquidar o cancelar y no nos avisa), así que además se consulta a Handy la ruta abierta del vendedor: si no tiene, o la abierta no es la de esa inicial (`idHandy`), responde **409** `SIN_RUTA_ABIERTA_EN_HANDY` y no se crea nada. Si Handy no se puede consultar (401, 5xx, sin respuesta, estado inesperado) no se bloquea: pasa con la regla local. La app no deja elegir la fecha de una recarga libremente: la toma de `GET /eventos-carga/dias-recargables`. En `RECARGA`, el backend obtiene automáticamente el catálogo ya cargado ese día. |
| POST | `/eventos-carga/:id/sesiones` | Vendedor, Contador | Inicia la sesión de conteo del usuario autenticado sobre ese evento. Body (solo recarga, segundo conteo): `{ ubicacion: ALMACEN\|CALLE }`. Solo si quien la abre es el **Contador**, antes se revisa en Handy que la ruta anterior del vendedor esté liquidada (docs/01 §6 regla 2): si no, el evento pasa a `BLOQUEADA_CORTE_PENDIENTE` y responde **409** `CORTE_PENDIENTE`; si el evento ya estaba bloqueado, responde lo mismo sin consultar Handy (se libera con `POST /eventos-carga/:id/desbloquear`). La sesión del Vendedor nunca pasa por esta revisión, y una carga `RECARGA` tampoco: su ruta abierta en Handy es justamente la que se recarga. **409** `CARGA_CANCELADA` si el evento está cancelado. |
| GET | `/eventos-carga/:id/productos` | Vendedor, Contador, Supervisor | Productos para el grid de conteo: los activos de la plantilla snapshot del evento (o el catálogo activo completo si no tiene plantilla). Respuesta: `{ plantillaId, familias: [{ familia, color, productos: [{ code, nombre, unidadCode, unidadDescripcion, familia, modalidadVenta, piezasPorPaquete, factorConfirmado }] }] }`, familias en orden alfabético (sin familia al final) y productos por nombre. `color`: el color de familia asignado por el supervisor (§1.2.2) o `null`; siempre `null` en el grupo sin familia. |
| PATCH | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Guarda/actualiza lo contado (reemplazo total). Body: `{ items: [{ productoCode, paquetes, sueltas, capturadoEn? }] }`; `cantidad` (total en unidades de venta) la calcula el backend y se rechaza si llega: `paquetes * piezasPorPaquete + sueltas` si el producto se vende `POR_PIEZA`, o `paquetes` tal cual si se vende `COMPLETO` (ahí `sueltas` debe ser 0; si no, 409 `SUELTAS_EN_PRODUCTO_COMPLETO`). `capturadoEn` (ISO 8601, opcional) es la hora del dispositivo al capturar —la app cuenta sin conexión—; se guarda junto a `recibidoEn` (hora de llegada al servidor), que no cambia si el item llega idéntico en un reenvío. Responde cada item con `paquetes`, `sueltas`, `cantidad`, `capturadoEn`, `recibidoEn` y `sueltasExcedenPaquete`. 409 si se mandan paquetes de un producto sin factor confirmado y 404 si un producto no existe; ambos traen `productos: [codigos]` con los afectados. **409** `CARGA_CANCELADA` si el evento se canceló (p. ej. la cola offline de un teléfono que envía tarde): no se escribe nada. |
| GET | `/eventos-carga/:id/sesiones/:sesionId/items` | Vendedor, Contador (dueño de la sesión) | Lo guardado en la sesión: `{ items: [{ productoCode, paquetes, sueltas, cantidad, capturadoEn, recibidoEn }] }`. La app lo usa al reabrir un conteo para reconciliar su copia local antes de volver a enviar. |
| POST | `/eventos-carga/:id/sesiones/:sesionId/finalizar` | Vendedor, Contador (dueño de la sesión) | Cierra la sesión; si ambas sesiones (vendedor y contador) están cerradas, dispara la comparación automática. |
| GET | `/eventos-carga/dias-recargables` | Vendedor | Día en que el vendedor puede iniciar una recarga. Se le pregunta a Handy (`route/current`), porque el estado `ENVIADA` **no** implica ruta abierta: solo dice que la carga salió alguna vez. Respuesta: `{ dias: [{ fechaOperativa, eventoInicialId }], motivo?, verificadoConHandy }`; `fechaOperativa` es el inicio de ese día en hora de México (ISO 8601), igual que en el evento. Casos: Handy sin ruta abierta → `{ dias: [], motivo: "SIN_RUTA_ABIERTA", verificadoConHandy: true }`; ruta abierta cuyo id coincide con el `idHandy` de una `INICIAL` `ENVIADA` de la ruta del vendedor → `{ dias: [ese día], verificadoConHandy: true }` (siempre uno solo; la fecha la manda Handy, sin filtrar por hoy); ruta abierta que no salió de esta app → `{ dias: [], motivo: "RUTA_NO_RECONOCIDA", verificadoConHandy: true }`; Handy no se puede consultar → las `INICIAL` `ENVIADA` de su ruta con `fechaOperativa` de hoy en adelante, en orden, con `verificadoConHandy: false` (la app deja contar pero advierte). Sin asignación vigente: `{ dias: [], motivo: "SIN_RUTA_ASIGNADA", verificadoConHandy: false }` sin consultar Handy. **409** si el usuario no está vinculado a Handy. La app ofrece solo estos días: con cero no deja iniciar la recarga, con uno pide solo confirmación, con varios muestra únicamente esos. |
| GET | `/eventos-carga/pendientes-verificacion` | Contador, Supervisor | Cola del contador: eventos en `EN_ESPERA_CONTADOR` o `BLOQUEADA_CORTE_PENDIENTE`, del más antiguo al más reciente. Cada fila: `{ id, rutaNombre, vendedorNombre, tipo, fechaConteo, totalProductos, bloqueadaPorCorte, fechaBloqueoCortePendiente, estadoVerificacion: LISTA\|BLOQUEADA_CORTE_PENDIENTE\|EN_CURSO_PROPIA\|EN_CURSO_OTRO, miSesionId, verificandoPor }`. `totalProductos` es cuántos productos registró el primer conteo; nunca se exponen sus cantidades (el segundo conteo es a ciegas). Aún no incluye las cargas que el vendedor sigue contando (grupo violeta de docs/06 §3.3). |
| GET | `/eventos-carga/conflictos-pendientes` | Vendedor, Contador | Eventos en `CONFLICTOS_PENDIENTES` donde el usuario autenticado contó: `[{ id, rutaNombre, tipo, fechaConteo, totalDiscrepancias, resueltas }]`. |
| GET | `/eventos-carga/:id` | Vendedor (dueño), Contador, Supervisor | Detalle del evento, incluidas ambas sesiones y discrepancias si existen. |
| GET | `/eventos-carga/:id/discrepancias` | Vendedor (participante), Contador, Supervisor | Productos con discrepancia (pendientes o resueltas), por nombre de producto: `[{ productoCode, productoNombre, unidadDescripcion, modalidadVenta, piezasPorPaquete, factorConfirmado, cantidadVendedorOriginal, cantidadContadorOriginal, cantidadFinal, capturadaPor, capturadaPorNombre, fechaCaptura, confirmadaPor, confirmadaPorNombre, fechaConfirmacion, primerConteo, segundoConteo }]`. `primerConteo`/`segundoConteo` = `{ tipoSesion, paquetes, sueltas }`: el tipo de la sesión que hizo ese conteo (la app etiqueta por rol, nunca por nombre) y lo tecleado en bodega; `paquetes`/`sueltas` son `null` si ya no corresponden a la cantidad original (p. ej. una reapertura del supervisor). |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/capturar` | Vendedor (participante), Contador | Captura la cantidad final acordada, en piezas. Body: `{ cantidadFinal }`. Mientras no esté confirmada se puede recapturar (quien recaptura pasa a ser quien capturó). |
| POST | `/eventos-carga/:id/discrepancias/:productoCode/confirmar` | Vendedor (participante), Contador | Confirma la cantidad capturada. Body: `{ cantidadFinal, pin }`: `cantidadFinal` es la que la persona ve en pantalla (si alguien la recapturó mientras tanto responde **409** `CANTIDAD_CAMBIO`, sin verificar el PIN); el PIN del usuario autenticado se verifica en ese momento con la misma política de intentos y bloqueo del login. Todos los rechazos son **403** (no 401, que la app interpreta como sesión vencida) con `codigo`: `AUTOCONFIRMACION_PROHIBIDA` (quien confirma es quien capturó; se revisa antes que el PIN y no gasta intentos), `PIN_INCORRECTO` (con `intentosRestantes`), `USUARIO_BLOQUEADO` (con `bloqueadoHasta`), `USUARIO_INACTIVO`. Respuesta: `{ discrepancia, enEsperaAutorizacion }`. |
| POST | `/eventos-carga/:id/enviar` | Vendedor, Contador, Supervisor | Dispara el envío a Handy (`POST /route` o `/route/recharge` según `tipo`). Solo permitido si no hay discrepancias pendientes. |
| POST | `/eventos-carga/:id/cancelar` | Vendedor, Supervisor | Cancela una carga no enviada. Nunca se borra: queda `CANCELADA` con quién, cuándo y motivo, se cierran sus sesiones abiertas y sigue visible en el historial. Body: `{ motivo?: string }` (máx. 500). **Vendedor:** solo su propia carga (su `usuarioHandyId`) y solo en `BORRADOR`; motivo opcional. **Supervisor:** cualquier carga salvo `ENVIADA`, `CANCELADA` y `ENVIO_INCIERTO`; motivo obligatorio, mínimo 5 caracteres. Errores: **404** no existe; **403** contador o carga ajena; **409** `ESTADO_INVALIDO` el estado no lo admite para ese rol; **400** `MOTIVO_REQUERIDO`. Respuesta: `{ evento }`. |
| POST | `/eventos-carga/:id/cancelar-en-handy` | Supervisor | Cancela en Handy una carga `ENVIADA` (`DELETE /route/{idHandy}`) y, **solo si Handy lo confirma**, la marca `CANCELADA`. Body: `{ motivo: string }`, obligatorio (mínimo 5), validado antes de llamar a Handy. Errores: **404** no existe; **409** `ESTADO_INVALIDO` no está `ENVIADA` o no tiene `idHandy`; **400** `MOTIVO_REQUERIDO`; **409** `HANDY_RECHAZO` Handy ya no permite cancelarla (lo más probable, el vendedor ya la aceptó en su celular) — la carga sigue `ENVIADA`; **502** Handy no respondió — no cambió nada. Respuesta: `{ evento }`. |

### 1.5 Historial y auditoría

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/historial?rutaId=&fechaInicio=&fechaFin=&estado=&conDiscrepancia=&tipo=&page=&pageSize=` | Vendedor, Contador, Supervisor | Listado filtrable, ordenado por `fechaOperativa` (las fechas filtran sobre ella). Alcance por rol, decidido desde el JWT y nunca por parámetros: Vendedor solo las cargas que él contó, Contador las de todos; ambos hasta 14 días atrás (una `fechaInicio` anterior se ignora). Supervisor: todo, sin límite. Incluye las cargas `CANCELADAS` (es donde se auditan); cada fila trae además `canceladaPorNombre`, `fechaCancelacion` y `motivoCancelacion` (`null` si no está cancelada). |
| GET | `/historial/:id` | Vendedor, Contador, Supervisor | Detalle completo, producto por producto, agrupado por familia; cada producto trae `unidadDescripcion`, `modalidadVenta`, `piezasPorPaquete` y `factorConfirmado` para mostrar la cantidad en paquetes (o en su unidad, si se vende completo). Mismo alcance que el listado: una carga fuera de él responde **403** `FUERA_DE_ALCANCE`. El `evento` trae `canceladaPorNombre`, `fechaCancelacion` y `motivoCancelacion`. |
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
