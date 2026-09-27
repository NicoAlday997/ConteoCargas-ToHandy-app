# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Tres roles internos de una distribuidora refresquera familiar con 5 rutas de venta directa (autoventa) a tiendas de conveniencia en García, Nuevo León. Todos entran con su nombre y un PIN de 4 dígitos; no hay auto-registro.

- **Vendedor** (Android, tablet o celular de trabajo): cuenta su carga inicial por la tarde para la siguiente salida, y pide recargas durante el día sobre la ruta que ya tiene abierta en Handy. Su ruta está fija por su perfil.
- **Contador de inventario** (Android, tablet en bodega): hace el segundo conteo, independiente, de lo que el vendedor ya contó. Trabaja de pie, con poca luz y las manos ocupadas. En recargas puede contar en almacén o en la calle (camioneta de refuerzo).
- **Supervisor** (iPhone): la familia dueña del negocio. Autoriza cargas antes de que lleguen a Handy, revisa a su criterio cualquier carga cerrada, atiende alertas y administra personas, plantillas, empaques, colores de familia y días no laborables.

## Product Purpose

Digitalizar el conteo físico de carga inicial y recargas donde ocurre (almacén o calle), conservar y reforzar la doble verificación vendedor + contador, y mandar la carga a Handy por su API REST v2 sin pasar por Excel. Sustituye el flujo papel → Excel → portal de Handy.

El éxito es doble: menos tiempo y trabajo duplicado cada día, y cerrar la puerta al robo hormiga por colusión (ya hubo al menos un caso de vendedor y contador reportando de común acuerdo menos de lo real).

## Positioning

No es una app de inventario genérica ni reemplaza a la app de Handy (el vendedor la sigue usando para aceptar la ruta y hacer su corte). Es el control de entrada de producto al camión: dos conteos independientes, discrepancias que solo se cierran con una segunda persona distinta confirmando con su propio PIN, autorización del supervisor, y un historial donde cada carga, cuadre o no, se audita con el mismo detalle.

## Operating Context

- Uso diario y repetitivo: la carga de mañana se cuenta hoy en la tarde con el camión de hoy aún en la calle.
- Captura por tap sobre un grid de productos agrupado por familia, sin código de barras; teclado numérico grande; paquetes y sueltas según el empaque del producto.
- Conectividad confiable; no se requiere modo offline en el MVP.
- Calendario laboral de lunes a sábado más días no laborables que marca el supervisor; el servidor decide qué fechas operativas se ofrecen.
- Evidencia fotográfica hoy vive en un grupo de WhatsApp externo; la app solo la referencia con texto.
- Handy es la fuente del catálogo de productos y de los vendedores (`usuario_handy_id`); la app replica ese catálogo en solo lectura.

## Capabilities and Constraints

- Estados de una carga: borrador, esperando contador, bloqueada por corte pendiente, diferencias por resolver, en espera de autorización, autorizada, enviada, envío incierto, error de envío, cancelada.
- Resolución de discrepancias: una persona captura la cantidad final y otra, obligatoriamente distinta, la confirma con su PIN. Nunca autoconfirmación.
- Supervisor puede autorizar, rechazar productos (con motivo) o modificar cantidades; rechazar o modificar regresa la carga a resolución cruzada.
- Revisión de supervisor tipo stepper: un producto a la vez, "Correcto" / "No coincide". Una discrepancia genera alerta de urgencia alta (push a supervisores).
- Envío a Handy tolera rechazo parcial por inventario y consulta la ruta abierta antes de reintentar para no duplicar.
- Una sola carga inicial por ruta y día operativo; recargas solo sobre una inicial enviada y abierta en Handy.
- Historial: vendedor solo lo suyo y contador todo, ambos 2 semanas; supervisor sin límite.
- Seguridad: el token de Handy nunca llega al dispositivo. PINs con hash; bloqueo tras 5 intentos.
- Stack: Expo (SDK 57) + Expo Router + React Native + TypeScript en `apps/movil`; NestJS + Prisma + PostgreSQL en `apps/backend`.
- Terminología: carga inicial, recarga, corte de venta, día operativo, día hábil / no laborable, plantilla de carga, familia, empaque (factor), paquetes / sueltas.
- Pendiente por fases: precarga de la última carga, orden por frecuencia, detección de anomalías y evidencia en la app (fases 2 y 3).

## Brand Commitments

Sin marca propia: es una herramienta interna; no hay logo, nombre visible ni colores de la empresa que respetar. El nombre visible está por definir. Toda la interfaz está en español de México, con lenguaje llano de bodega.

## Evidence on Hand

- Documentación completa en `docs/01`–`docs/06` (requisitos, técnica, API, pruebas, UX).
- Nombres de productos reales vienen de Handy (en mayúsculas; la app los muestra con mayúscula inicial).
- No hay testimonios, métricas de uso ni capturas de producción; no deben inventarse.

## Product Principles

1. **Dos personas, dos conteos, siempre.** Nada de la interfaz debe permitir que una persona cierre sola lo que requiere a otra.
2. **Auditoría pareja.** Una carga que cuadró es tan visible y detallada como una que no.
3. **El camino feliz no pide leer.** Cuando todo coincide, no se muestra lo ya validado; solo se muestra lo que requiere acción.
4. **Tap, no teclado.** La captura diaria se optimiza para velocidad con las manos ocupadas.
5. **El servidor decide las reglas.** La app no adivina fechas, permisos ni estados; los pide y los explica.

## Accessibility & Inclusion

Uso en bodega con poca luz, de pie y con las manos ocupadas: objetivos táctiles grandes y mínima escritura. Todo texto cumple 4.5:1 y todo gráfico 3:1 sobre su fondo (verificado en `apps/movil/src/theme/contraste.spec.ts`). El estado nunca se comunica solo con color de texto.
