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
5. **El color comunica estado, no decora.** Verde (listo/coincide), ámbar (atención/discrepancia resuelta o pendiente), rojo (bloqueado/urgente), violeta (inactivo/en espera/revisado en cero). Cada estado se muestra como bloque tintado (fondo claro, borde y texto oscuro del mismo tono), nunca solo como texto de color.
6. **El color es la base, no el adorno.** Alto contraste no significa gris y blanco: significa que los elementos se distingan entre sí. El fondo de pantalla es azul de marca tintado y las tarjetas blancas flotan encima; la marca va en barras superiores, encabezados de sección y acción principal. El gris queda solo para texto secundario y divisores. Todo texto cumple 4.5:1 sobre su fondo (`apps/movil/src/theme/contraste.spec.ts`).
7. **Sueltas que completan un paquete se bloquean.** En bodega los paquetes se arman al contar: capturar 9 sueltas de un producto C/8 siempre es error de dedo. El campo no lo acepta y ofrece "Convertir a 1 paquete y 1 suelta". Solo aplica a productos por pieza con empaque confirmado; los que aún no tienen empaque definido se capturan por pieza hasta que el supervisor lo configure.

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
- Productos ya capturados se resaltan visualmente.
- En recarga: por default solo muestra los productos ya incluidos en la carga inicial de ese día; búsqueda disponible para el caso excepcional.
- Al tocar un producto, teclado numérico grande para capturar cantidad.

### 3.5 Resumen de sesión
- Confirmación de cierre del conteo de una persona (vendedor o contador) antes de disparar la comparación automática.

### 3.6 Resolución de conflictos
- Solo se listan los productos con discrepancia (nunca los que coincidieron).
- Flujo de dos pasos: una persona captura la cantidad final acordada; la segunda persona (obligatoriamente distinta) la confirma ingresando su propio PIN.
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
- Detalle: la misma vista consolidada del historial y tres acciones: **Autorizar** (pregunta antes: después se envía a Handy), **Rechazar productos** (solo los marcados, cada uno con motivo de mínimo 3 caracteres; nunca la carga completa) y **Modificar cantidad** (un producto por ronda, con el teclado de conteo).
- Modificar avisa antes de guardar que la cantidad no queda aplicada: el vendedor o el contador la confirman con su PIN. Rechazar y modificar devuelven la carga a diferencias por resolver; la app regresa a la cola y lo explica.
- Ya autorizada, "Enviar a Handy" en el mismo detalle. Respuestas: enviada (con el id de ruta; si Handy rechazó productos por inventario se listan y el resto sí se envió), inventario insuficiente total (no se creó ruta), envío sin confirmar (reintentar es seguro: antes se consulta si la ruta ya existe) y token inválido (requiere al administrador).

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
