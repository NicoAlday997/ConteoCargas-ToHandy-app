# Estrategia de Pruebas

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Alcance:** Enfoque de calidad y pruebas del sistema (backend, integración con Handy, QA manual)

---

### 2.1 Enfoque general

Dado el tamaño del equipo (un desarrollador principal) y la naturaleza del proyecto, no se busca cobertura exhaustiva de todo el código, sino **cobertura dirigida a lo que representa mayor riesgo de negocio**: la lógica de doble conteo, discrepancias y las validaciones que protegen contra duplicados o fraude.

### 2.2 Pirámide de pruebas

```
        ┌─────────────────────┐
        │  Manual / QA         │  ← flujos completos, poca cantidad, alto valor
        ├─────────────────────┤
        │  Integración         │  ← endpoints del backend, con Handy simulado
        ├─────────────────────┤
        │  Unitarias           │  ← lógica de dominio, la base más grande
        └─────────────────────┘
```

### 2.3 Pruebas unitarias (prioridad alta — capa de dominio y aplicación)

Casos que **deben** tener prueba unitaria antes de considerarse listos para producción:

| Módulo | Casos a probar |
|---|---|
| Comparación de conteos | Coinciden exactamente → sin discrepancias. Difieren en cantidad → discrepancia detectada. Un producto aparece solo en una sesión → tratado como discrepancia (cantidad 0 en la otra). |
| Resolución de discrepancias | `confirmadaPor` igual a `capturadaPor` → debe rechazarse. Cantidad final que no coincide con ninguno de los dos conteos originales → debe generar alerta de urgencia media. Todas las discrepancias resueltas → evento pasa a `LISTA_PARA_ENVIAR`. |
| Corte de venta pendiente | Vendedor con ruta abierta en Handy → evento pasa a `BLOQUEADA_CORTE_PENDIENTE`, sin bloquear el conteo del vendedor. Bloqueo que supera el umbral de horas configurado → escala la alerta de media a alta. |
| Política de inventario insuficiente | Carga inicial con producto rechazado → se aísla el producto, el resto se envía. Recarga forzada con `skipInventoryValidation` → se registra con usuario/timestamp y genera alerta media. |
| Revisión de supervisor | Todos los productos `CORRECTO` → `resultadoVerificacion = COINCIDE`. Al menos uno `INCORRECTO` → `resultadoVerificacion = DISCREPANCIA` y se dispara alerta alta. |
| Reintento tras envío incierto | Debe consultarse `route/current` antes de reintentar; si ya existe ruta creada, no debe reenviarse. |

**Herramienta:** Jest (integrado de forma nativa en proyectos NestJS). Las pruebas de dominio no deben requerir base de datos ni red — se prueban las entidades y casos de uso de forma aislada, sustituyendo los puertos (`HandyGateway`, `RutaRepository`) por dobles de prueba (mocks/fakes).

### 2.4 Pruebas de integración (prioridad media — capa de infraestructura)

- Probar los endpoints del backend contra una base de datos de prueba (puede ser el mismo contenedor Docker con una base separada, ej. `handy_conteo_test`).
- El adaptador `HandyHttpGateway` se prueba con un **servidor HTTP simulado** (mock server) que reproduce las respuestas documentadas de Handy (201, 422 con `prettyMessages`, 401, timeout) — nunca contra el ambiente real de Handy en pruebas automatizadas, para no generar rutas de prueba en el sistema productivo de la compañía.
- Casos mínimos: creación exitosa de ruta, rechazo por inventario insuficiente, token inválido, timeout simulado.

### 2.5 Pruebas manuales (QA) — antes de cada entrega relevante

Checklist de flujos completos a validar manualmente (idealmente contra un ambiente de staging, ver sección 2.6):

- [ ] Alta de usuario nuevo → login con PIN temporal → cambio de PIN forzado.
- [ ] Restablecimiento de PIN por administrador → login → cambio forzado.
- [ ] Carga inicial completa: vendedor cuenta → contador cuenta → sin discrepancia → envío exitoso a Handy.
- [ ] Carga inicial con discrepancia: captura + confirmación cruzada → envío exitoso.
- [ ] Intento de auto-confirmación de discrepancia (mismo usuario) → debe rechazarse.
- [ ] Recarga completa, verificación en almacén y en calle (ambos casos).
- [ ] Corte de venta pendiente: contador ve la carga bloqueada; se resuelve el corte en Handy; la carga se desbloquea automáticamente (verificar también el escalamiento de alerta tras el umbral de horas, en un entorno controlado).
- [ ] Historial: filtros, detalle de una carga sin discrepancia, registro de evidencia externa.
- [ ] Revisión de supervisor: caso todo correcto, y caso con al menos un producto incorrecto (validar que se genera la alerta y la notificación push).
- [ ] Centro de alertas: marcar una alerta como resuelta.

### 2.6 Entornos

| Entorno | Propósito | Notas |
|---|---|---|
| Desarrollo local | Trabajo diario del desarrollador | Base de datos y backend corriendo en Docker local. |
| Staging | Validar flujos completos antes de producción | Idealmente contra un ambiente de pruebas de Handy si está disponible; si no, usar una compañía/ruta de prueba real en Handy claramente identificada, nunca las rutas operativas activas. |
| Producción | Operación real de las 5 rutas | Acceso restringido; cambios solo tras validarse en staging. |

### 2.7 Alcance no cubierto en el MVP
- Pruebas automatizadas end-to-end de la app móvil (Detox u otra herramienta) — se pospone a una fase posterior; el MVP se apoya en el checklist manual de la sección 2.5.
- Pruebas de carga/rendimiento — no son prioritarias dado el volumen (5 rutas, uso diario acotado), pero pueden revisarse si el proyecto escala a más rutas en el futuro.
