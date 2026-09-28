# Documento Visual y de Experiencia (UX)

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Tipo de documento:** Especificación de Experiencia de Usuario y Catálogo de Pantallas

---

## 1. Principios de diseño

1. **Captura por tap, no por escritura.** Sin código de barras; la selección de producto se hace por grid visual con búsqueda de respaldo, no por listas largas o campos de texto libre.
2. **Minimizar la fricción en el camino feliz.** Cuando todo coincide, el usuario no debe leer ni confirmar información redundante (ej. solo se muestran discrepancias, nunca la lista completa ya validada).
3. **La auditoría no debe tener fricción de captura.** La revisión de supervisor se resuelve con dos botones (correcto/incorrecto), no recapturando cantidades.
4. **Todo dato relevante para trazabilidad se captura automáticamente** (usuario, timestamp, ubicación operativa) sin pedirlo explícitamente al usuario salvo cuando aporta valor real (ej. evidencia externa).
5. **El color comunica estado, no decora.** Turquesa (contado/coincide), ámbar (aviso: algo pide atención), rojo (falló/bloqueado/urgente), gris (no lleva/inactivo/en espera sin urgencia). Cada estado se muestra como bloque tintado (fondo claro y texto oscuro del mismo tono) y con forma, glifo o texto que lo acompañe: nunca solo como color de texto.
   - **El ámbar es para avisos, no para lo que falta.** Lo que falta contar es el estado normal al abrir una carga, no una advertencia: si se pintara en ámbar, los 60 productos sin contar pondrían la pantalla entera en color de alarma y el ámbar dejaría de significar algo. Una fila **sin contar** va neutra (fondo blanco, borde de 2 px gris claro `bordeSinContar`, pastilla del factor en `superficieHonda` con texto secundario, total en `textoTerciario`) y el color aparece conforme se avanza (contado en verde, no lleva en gris, tecleando en azul). El ámbar (`discrepancia`) queda solo para avisos reales dentro de la fila —empaque sin confirmar, sueltas que ya completan un paquete, rechazo del servidor—, y por eso destaca: en la lista de conteo es lo único ámbar.
   - **El color de familia identifica; el estado comunica.** El encabezado fijo de cada familia es una banda a todo el ancho en el `tinte` de su color, con el nombre (15 px seminegrita) y el avance (en pastilla blanca) en el `texto` fuerte de ese color y una línea de 3 px del `solido` abajo. Sin color asignado, la banda va en `superficieHonda` con texto normal. El color de familia nunca entra en las filas.
   - **Pantallas con color por estructura, no por relleno.** Los estados vacíos llevan un círculo de 72 px en el tinte del tono (turquesa cuando es "todo en orden", gris cuando es informativo) con un ícono SVG grande en el color fuerte; título de 20 px seminegrita y explicación en texto secundario. Nada de emojis. Cada fila de un menú lleva a la izquierda un cuadro de 40 px (radio 11) en `superficieHonda` con el ícono de su tarea **en tinta**: las tareas se reconocen por su ícono, no por un color (`ICONO_TAREA` en `Icono.tsx`). Todo número que indique trabajo pendiente va en el color de su estado, nunca en gris suelto. Todo color sale de `COLORES` en `tokens.ts` (las ondas de Android, de `ONDA`); ninguna pantalla escribe un color a mano.
6. **Neutro en reposo.** El fondo de pantalla es un gris azulado (`fondo`) y las tarjetas blancas se separan por contorno de 1 px y por el cambio de fondo, sin sombras. Si no cambió nada y no hay nada que hacer, no hay color. Todo texto cumple 4.5:1 sobre su fondo y todo gráfico (chevrons, franja de avance, contornos de control) 3:1 (`apps/movil/src/theme/contraste.spec.ts`).
7. **Regla del azul: un color que está en todo no comunica nada.** El azul de marca queda reservado para tres cosas: (1) la acción principal de la pantalla, **un botón por pantalla** (en listas de varias tarjetas, solo la primera que requiere acción lleva el azul; las demás, secundario); (2) lo que se está editando en este momento (campo activo, fila activa, tecla de avance del teclado, opción elegida en un selector); (3) el encabezado de las pantallas de trabajo (conteo, diferencias, historial, autorización). Todo lo demás es neutro. **El azul nunca significa un estado:** una espera reciente va en gris, no en azul. La regla vive también en la cabecera de `apps/movil/src/theme/tokens.ts`.
8. **Menos mayúsculas.** Los rótulos en mayúsculas (`ROTULO`) quedan solo donde rotulan un número que se captura o se lee rápido: los campos de captura (PAQUETES, SUELTAS) y la unidad de un total (PIEZAS, CAJAS). Los demás rótulos ("Contó", "de 5 por resolver", "esperan") van con mayúscula inicial (`ETIQUETA_DATO` o `etiqueta`). Los nombres de producto que Handy manda en mayúsculas se muestran con mayúscula inicial por palabra, conservando empaques, unidades, siglas cortas y números ("Big Cola 3.030 LT C/6"); la búsqueda y lo que viaja al servidor usan el nombre original.
9. **Sueltas que completan un paquete avisan, no bloquean.** A veces el paquete viene abierto: capturar 9 sueltas de un producto C/8 muestra un aviso ámbar en la fila y en el teclado ("Eso ya es un paquete completo de 8. Si venía cerrado, cuéntalo en Paquetes."), sin impedir la captura. Solo aplica a productos por pieza con empaque confirmado; los que aún no tienen empaque definido se capturan por pieza hasta que el supervisor lo configure.

## 2. Matriz de permisos por rol

| Pantalla / acción | Vendedor | Contador | Supervisor |
|---|---|---|---|
| Iniciar carga inicial / recarga (su ruta) | ✅ | ❌ | ❌ |
| Verificar carga (2º conteo) | ❌ | ✅ | ✅ |
| Confirmar resolución de discrepancia (PIN cruzado) | ✅ | ✅ | ✅ |
| Ver cola de verificación | ❌ | ✅ | ✅ |
| Ver historial de cargas | ✅ solo las suyas, 2 semanas | ✅ todas, 2 semanas | ✅ todas, sin límite |
| Iniciar revisión de supervisor sobre carga cerrada | ❌ | ❌ | ✅ |
| Autorizar carga, rechazar productos o modificar una cantidad | ❌ | ❌ | ✅ |
| Enviar a Handy una carga autorizada (desde la app) | ❌ | ❌ | ✅ |
| Ver centro de alertas | ❌ | ❌ | ✅ |
| Administrar plantillas de carga (productos y rutas) | ❌ | ❌ | ✅ |

## 3. Catálogo de pantallas

### 3.1 Login
- Único punto de entrada, igual para todos los roles y dispositivos.
- Paso 1: selección visual del nombre del usuario (lista o tarjetas con iniciales), sin captura manual de texto.
- Paso 2: PIN numérico de 4 dígitos con teclado grande.
- Sin selección de rol: el rol viene determinado por el perfil de la persona seleccionada.
- Si el usuario tiene `debe_cambiar_pin = true` (tras alta o restablecimiento), se le solicita definir un nuevo PIN antes de continuar a cualquier otra pantalla.

### 3.2 Inicio — Vendedor
- Sin selector de ruta (ya resuelta por su perfil vinculado a `usuario_handy_id`).
- Dos acciones: "Carga inicial de hoy" y "Solicitar recarga".

### 3.3 Inicio — Contador
- Cola agrupada en tres estados visuales:
  - **Verde — Listas para verificar:** vendedor completó su conteo, sin bloqueo.
  - **Ámbar — Bloqueadas por corte pendiente:** vendedor completó, pero la ruta anterior de ese vendedor sigue sin corte de venta en Handy.
  - **Violeta — Esperando al vendedor:** el vendedor sigue contando, no accionable.

### 3.4 Captura de productos (grid)
- Grid de productos con búsqueda superior, ordenado por frecuencia de uso de esa ruta específica.
- Productos ya capturados se resaltan visualmente (verde); los que faltan quedan neutros, sin ámbar (ver §1.5).
- En recarga: por default solo muestra los productos ya incluidos en la carga inicial de ese día; búsqueda disponible para el caso excepcional.
- Al tocar un producto, teclado numérico propio (nunca el del sistema), en forma de numpad: dígitos a la izquierda y, en la columna del pulgar, **Borrar**, **No lleva** (marca el producto en 0 y pasa al siguiente) y la tecla de avance en azul sólido y de doble alto. Arriba, el producto y un selector **Paquetes | Sueltas** que dice por forma qué campo se captura. El recorrido: con paquetes tecleados, "Siguiente" salta al siguiente producto (las sueltas vacías cuentan como 0); con Paquetes vacío, va a Sueltas. "Listo" solo cierra el teclado y es la tecla más callada.

### 3.5 Resumen de sesión
- Confirmación de cierre del conteo de una persona (vendedor o contador) antes de disparar la comparación automática.

### 3.6 Resolución de conflictos
- Solo se listan los productos con discrepancia (nunca los que coincidieron).
- El encabezado dice de qué carga se trata: "Diferencias · Ruta 3", "Carga inicial · Sale mañana…" y quiénes contaron ("Irvin (vendedor) · Juan (contador)"). Al llegar desde el segundo conteo, la pantalla abre diciendo qué pasó ("Tu conteo y el de Irvin no coinciden en 3 productos. Resuélvanlo juntos.").
- Flujo de dos pasos: una persona captura la cantidad final acordada; la segunda persona (obligatoriamente distinta) la confirma ingresando su propio PIN.
- **Dos modalidades de confirmación que conviven.** *Entre dispositivos:* cada quien entra a la carga desde su teléfono (Inicio → "Resolver diferencias" de la ruta) y confirma con su PIN. *En el mismo dispositivo:* quien capturó pasa el teléfono ("Confirma Juan aquí"); la hoja pregunta "¿Quién confirma?" con los nombres de quienes contaron (nunca quien capturó) y la persona elegida teclea **su** PIN. El servidor valida las dos igual: PIN de quien confirma, que haya contado la carga y que no sea quien capturó.
- Una sola acción azul: la de la primera diferencia que falta; las demás tarjetas llevan sus botones en secundario.
- El envío a Handy permanece deshabilitado hasta que todas las discrepancias tengan captura y confirmación.

### 3.7 Recarga — selección de ubicación del segundo conteo
- Pregunta simple antes de iniciar la verificación: "Almacén" o "En calle" (camioneta de refuerzo) — solo para trazabilidad, sin cambiar permisos.

### 3.8 Historial
- Vendedor ve solo sus cargas y Contador las de todos, ambos hasta 2 semanas atrás; Supervisor ve todo sin límite (el alcance lo decide el backend).
- Organizado por fecha operativa (día para el que salió el camión), no por fecha de conteo.
- Tabla filtrable por fecha, ruta, presencia de discrepancia y estado de verificación.
- Todas las filas son accesibles a detalle, incluidas las que no tuvieron discrepancia (principio de auditoría pareja, sección 1).
- Fila resaltada en ámbar cuando hubo discrepancia durante el conteo original (informativo, no restrictivo).
- Detalle de cada fila incluye desglose producto por producto, campo de evidencia externa (texto libre) y botón para iniciar revisión de supervisor.

### 3.9 Revisión de supervisor (stepper)
- Un producto a la vez, mostrando la cantidad ya registrada.
- Dos botones grandes: ✅ Correcto (avanza automáticamente) / ❌ No coincide (despliega campo opcional de cantidad real encontrada antes de avanzar).
- Al finalizar, resumen de cuántos productos coincidieron y el detalle de los que no.

### 3.9.1 Autorización de cargas (Supervisor)
- Acceso primero en el inicio del supervisor, con el número de cargas esperando y el color de la que más lleva esperando.
- Cola de cargas en `EN_ESPERA_AUTORIZACION`, ordenada por espera (la más detenida primero). La espera se mide desde el último cierre de conteo o la última diferencia confirmada, nunca desde la fecha de conteo. Ámbar desde 20 min, rojo ("Detenida") desde 45 min.
- Debajo, las cargas autorizadas que aún no llegan a Handy (lista para enviar, envío sin confirmar, error de envío).
- Detalle: primero la lectura ("Cuadró" en turquesa, o "3 productos no cuadraron" en ámbar), debajo solo los productos que tuvieron discrepancia, y la lista completa plegada tras "Ver los 70 que coincidieron" (misma vista consolidada del historial, con el mismo detalle: se pliega, no se esconde).
- Acción principal: **Autorizar y enviar** en una sola hoja con productos y piezas; dentro, "Solo autorizar" como salida secundaria (la deja lista para enviar después). Tras "Más acciones": **Rechazar productos** (solo los marcados, cada uno con motivo de mínimo 3 caracteres; nunca la carga completa), **Modificar cantidad** (un producto por ronda, con el teclado de conteo), cambiar fecha y cancelar. Con la bandeja abierta, la acción principal se retira.
- Modificar avisa antes de guardar que la cantidad no queda aplicada: el vendedor o el contador la confirman con su PIN. Rechazar y modificar devuelven la carga a diferencias por resolver; la app regresa a la cola y lo explica.
- Enviada, el cierre es una lectura grande ("Enviada a Handy", productos, piezas y ruta) con háptica de éxito. Autorizada sin enviar, "Enviar a Handy" en el mismo detalle. Respuestas: enviada (con el id de ruta; si Handy rechazó productos por inventario se listan y el resto sí se envió), inventario insuficiente total (no se creó ruta), envío sin confirmar (reintentar es seguro: antes se consulta si la ruta ya existe) y token inválido (requiere al administrador).

### 3.9.2 Plantillas de carga (Supervisor)
- Acceso desde el inicio del supervisor ("Plantillas de carga").
- Lista: cada plantilla con su nombre, cuántos productos tiene y qué rutas la usan. Las desactivadas van aparte, al final, para poder reactivarlas. "Crear plantilla" pide nombre y descripción y abre la plantilla nueva (vacía).
- Detalle: nombre y descripción en el encabezado ("Editar" los cambia), rutas que la usan y los productos por familia en el mismo orden que el grid de conteo, cada uno con cómo se vende y su factor. Los desactivados en Handy se marcan: siguen en la plantilla pero no aparecen al contar.
- Agregar: selector a pantalla completa con todo el catálogo por familia, búsqueda por nombre y selección múltiple (también "Marcar todos" por familia). Lo que ya está en la plantilla se ve marcado como "Ya está en la plantilla" y no se puede elegir otra vez.
- Quitar: modo de selección múltiple en rojo; antes de quitar se confirma con la lista de productos y se aclara que las cargas iniciadas y el historial no cambian.
- Rutas: "Cambiar" muestra todas las rutas activas con lo que usan hoy; "Asignar" mueve la ruta desde su plantilla anterior tras confirmar. No hay "quitar" suelto (dejaría al vendedor viendo todo el catálogo): se le asigna otra plantilla.
- Desactivar va al final del detalle y solo se permite si ninguna ruta la usa; si alguna la usa, se dice cuáles y qué hacer primero.

### 3.10 Centro de alertas (Supervisor)
- Lista de alertas filtrable por estado (pendiente/todas/resueltas) y urgencia.
- Alertas de urgencia alta se destacan en rojo con ícono de campana; incluyen botón de "marcar como resuelta".
- Alertas de urgencia media en ámbar; de baja urgencia atenuadas visualmente (usualmente autoresueltas).

### 3.11 Administración de usuarios (Supervisor con permiso de admin)
- Listado de usuarios activos e inactivos, con nombre, rol y (si aplica) `usuario_handy_id` vinculado.
- Alta de usuario: nombre completo, rol, `usuario_handy_id` (solo si es Vendedor, seleccionado de la lista sincronizada de Handy), y PIN temporal generado por el sistema.
- Edición: reasignar `usuario_handy_id` de un Vendedor, o desactivar un usuario (nunca eliminar).
- Botón de "Restablecer PIN": genera un PIN temporal nuevo y lo muestra una sola vez en pantalla para comunicarlo a la persona.

## 4. Mapa de flujo general

```
Login (PIN)
   │
   ├── Vendedor → Captura carga → Termina conteo
   │                                    │
   │                     ¿Corte de venta pendiente? (consulta a Handy)
   │                          │                    │
   │                     Bloqueada              Lista para verificar
   │                    (alerta media→alta)            │
   │                                          Contador cuenta (independiente)
   │                                                    │
   │                                              Comparación automática
   │                                          │                        │
   │                                    Coincide                 Discrepancia
   │                                       │                  (captura + confirma
   │                                       │                     PIN cruzado)
   │                                       └───────────┬────────────────┘
   │                                                    ▼
   │                                       Autorización del supervisor
   │                                    │             │               │
   │                               Autoriza   Rechaza productos   Modifica cantidad
   │                                    │      (vuelven a resolverse con PIN cruzado)
   │                                    ▼
   │                            POST a Handy (ruta/recarga)
   │
   └── Supervisor → Historial (todas las cargas) → Revisión stepper (opcional, a discreción)
                                                          │
                                              Discrepancia detectada → Alerta alta
```

## 5. Consideraciones de dispositivo y contexto de uso

- Los vendedores y el contador usan **Android** (tablets o el celular de trabajo); los supervisores usan **iPhone** — la app debe ser multiplataforma desde el diseño de UI, no solo de lógica.
- La captura ocurre en almacén o en calle: botones grandes, mínima escritura, sin dependencia de códigos de barras.
- Conectividad confiable confirmada — no se requiere diseño offline-first en el MVP.

## 6. Fuera de alcance visual (por ahora)

- Evidencia fotográfica o de video integrada a la app (se mantiene el flujo actual por WhatsApp, solo referenciado por texto en el historial).
- Visualizaciones de detección de anomalías (fase 3, pendiente de diseño una vez exista suficiente histórico).
