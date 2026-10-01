# Despliegue en Render

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Septiembre 2026
**Alcance:** Subir el backend (NestJS + Postgres) a Render y conectar la app móvil a él.

Esta guía asume que nunca has desplegado nada. Síguela en orden la primera vez.

---

## 1. Qué vamos a tener al final

| Pieza | Qué es | Nombre en Render |
|---|---|---|
| Servicio web | El backend NestJS, siempre encendido, con HTTPS | `conteo-cargas-backend` |
| Base de datos | Postgres 16 administrado, con copias de seguridad | `conteo-cargas-db` |

Todo está descrito en `render.yaml`, en la raíz del repositorio (Render lo llama *Blueprint*). Render lo lee y crea ambas piezas; tú solo escribes los secretos.

Cómo arranca el servidor en Render, en cada despliegue:

1. **Build:** `npm ci --include=dev && npx prisma generate && npm run build` → instala dependencias, genera el cliente de Prisma y compila a `dist/main.js`.
2. **Start:** `npm run start:prod` → `prisma migrate deploy` (aplica migraciones pendientes; nunca `migrate dev`) y luego `node dist/main`.
3. Antes de levantar Nest, el servidor revisa las variables de entorno. Si falta alguna, se detiene con un mensaje como este (solo nombres, nunca valores):
   ```
   El servidor no arranca: revisa las variables de entorno.
   Faltan: JWT_SECRET, HANDY_API_TOKEN.
   ```
4. Render consulta `GET /salud` y solo manda tráfico a la versión nueva cuando responde 200. Si la nueva versión no arranca, **la anterior sigue funcionando**.

---

## 2. Crear la cuenta y conectar GitHub

1. Entra a <https://render.com> y pulsa **Get Started**. Regístrate **con tu cuenta de GitHub** (así ya queda conectada).
2. Render te pedirá crear un *workspace*. Ponle el nombre del negocio.
3. Agrega un método de pago en **Workspace Settings → Billing** (los planes que usamos son de pago; ver sección 10).
4. Dale acceso al repositorio: **Workspace Settings → Git Providers → GitHub → Configure**. En GitHub elige *Only select repositories* y marca `ConteoCargas-ToHandy-app`.

---

## 3. Crear todo desde el Blueprint

1. En el panel de Render: **New + → Blueprint**.
2. Elige el repositorio `ConteoCargas-ToHandy-app` y la rama `main`.
3. Render lee `render.yaml` y muestra lo que va a crear: el servicio `conteo-cargas-backend` y la base `conteo-cargas-db`.
4. Te pide el valor de las dos variables secretas (`JWT_SECRET` y `HANDY_API_TOKEN`). Ve a la sección 4 para saber qué escribir en cada una.
5. Pulsa **Apply**. Render crea la base primero y luego el servicio. El primer despliegue tarda unos minutos.
6. Cuando termine, el servicio tendrá una dirección como `https://conteo-cargas-backend.onrender.com` (la ves arriba en la página del servicio). Pruébala en el navegador:
   ```
   https://conteo-cargas-backend.onrender.com/salud
   ```
   Debe responder algo como `{"estado":"ok","version":"0.0.1","baseDeDatos":"ok"}`.

> **Despliegue automático:** desde ahora, cada `git push` a `main` vuelve a desplegar y aplica las migraciones nuevas. Si prefieres desplegar a mano, en el servicio ve a **Settings → Build & Deploy → Auto-Deploy** y ponlo en *No*; entonces despliegas con **Manual Deploy → Deploy latest commit**.

### 3.1 Crear el primer supervisor

La base nueva está vacía. Para entrar a la app necesitas un supervisor:

1. En el servicio `conteo-cargas-backend`, abre la pestaña **Shell**.
2. Escribe:
   ```bash
   SEED_SUPERVISOR_NOMBRE="Tu Nombre" npx prisma db seed
   ```
3. El comando imprime **una sola vez** el PIN temporal del supervisor. Cópialo. Al entrar por primera vez la app te pedirá cambiarlo.
4. Entra a la app como supervisor y pulsa **Sincronizar con Handy** para traer productos y vendedores (o espera a la sincronización automática de las 5:00).

---

## 4. Variables de entorno

Las ves y las cambias en el servicio → **Environment**. Después de cambiar una, Render vuelve a desplegar solo.

| Variable | ¿Quién la pone? | Valor |
|---|---|---|
| `DATABASE_URL` | Render (automática) | La conexión interna a `conteo-cargas-db`. No la toques. |
| `NODE_ENV` | `render.yaml` | `production` |
| `TZ` | `render.yaml` | `America/Mexico_City`. Los servidores de Render corren en hora UTC; sin esto, las cargas contadas en la noche quedarían en el día siguiente. El servidor no arranca con otro valor. |
| `HANDY_API_BASE_URL` | `render.yaml` | `https://hub.handy.la/api/v2` |
| `SINCRONIZACION_AUTOMATICA` | `render.yaml` | `true` (sincroniza con Handy todos los días a las 5:00, hora de México) |
| `JWT_SECRET` | **Tú, a mano** | Ver 4.1 |
| `HANDY_API_TOKEN` | **Tú, a mano** | Ver 4.2 |
| `PORT` | Render (automática) | No la pongas: Render la asigna y el servidor la usa. |

Los valores de `JWT_SECRET` y `HANDY_API_TOKEN` **nunca** se escriben en `render.yaml`, en `.env.example`, en un chat ni en un commit.

### 4.1 `JWT_SECRET`: el secreto que firma las sesiones

Es una cadena aleatoria con la que el servidor firma los tokens de sesión de la app. Quien la conozca podría fabricar sesiones de cualquier usuario. Debe tener **al menos 32 caracteres** (si no, el servidor no arranca).

Genérala en la Terminal de tu Mac con:

```bash
openssl rand -base64 48
```

Copia lo que imprime (64 caracteres) y pégalo en Render. Usa uno **distinto** al de tu `.env` local.

Si algún día la cambias, todos los usuarios tendrán que volver a iniciar sesión (sus tokens dejan de valer). Es lo que hay que hacer si sospechas que se filtró.

### 4.2 `HANDY_API_TOKEN`: el token de integración de Handy

Es el token de la compañía con el que el backend habla con la API de Handy. La app móvil nunca lo ve.

1. Entra a Handy con un usuario administrador.
2. Abre la edición de tu usuario y pulsa el botón verde para **crear tu token personal de API** (ver la [guía de Handy](https://api.handy.la/guides/)). Si ya tienes uno funcionando en tu `.env` local, puedes usar ese mismo.
3. Antes de pegarlo en Render, compruébalo desde la Terminal (cambia `TU_TOKEN`):
   ```bash
   curl -H "Authorization: Bearer TU_TOKEN" https://hub.handy.la/api/v2/user
   ```
   Si responde con una lista de usuarios, el token sirve. Si responde 401, no.
4. Pégalo en Render como `HANDY_API_TOKEN`.

Si el token caduca o lo revocas en Handy, la app genera una alerta de urgencia alta; generas uno nuevo y lo cambias en **Environment**. Se recomienda rotarlo cada 6-12 meses.

---

## 5. Antes de la primera migración: el índice de cargas iniciales sin terminar

La migración `20261002120000_inicial_sin_terminar_unica` crea un índice único que impide que una ruta tenga **dos cargas iniciales sin terminar** (cualquier estado que no sea `ENVIADA` ni `CANCELADA`). Si la base ya tuviera datos que lo violan, la migración falla con `could not create unique index` y el servidor no arranca.

### 5.1 Si la base de Render es nueva (el caso normal)

No hay nada que revisar: está vacía y el primer arranque crea todas las tablas y el índice. Solo confirma después (5.3) que el índice existe.

### 5.2 Si vas a pasar datos de tu Mac a producción

Antes de copiar nada, corre esta consulta en la base **de origen** (tu Postgres local):

```bash
docker exec -it handy_conteo_db psql -U handy_app -d handy_conteo -c "
SELECT \"rutaId\", COUNT(*) AS iniciales_sin_terminar
FROM eventos_carga
WHERE tipo = 'INICIAL' AND estado NOT IN ('ENVIADA', 'CANCELADA')
GROUP BY \"rutaId\"
HAVING COUNT(*) > 1;"
```

- **0 filas:** todo bien.
- **Alguna fila:** esa ruta tiene más de una carga inicial abierta. Termina o cancela las sobrantes desde la app (como supervisor) y vuelve a correr la consulta hasta que salga vacía.

Después deja que Render cree el esquema (primer despliegue) y copia **solo los datos** (`pg_dump --data-only`), nunca el esquema de tu Mac encima del de producción.

### 5.3 Confirmar que el índice existe en producción

Conéctate a la base de producción (sección 7.1) y corre:

```sql
SELECT indexname FROM pg_indexes
WHERE indexname = 'evento_carga_inicial_sin_terminar_unica';
```

Debe salir una fila. Si no sale, no uses la app hasta resolverlo: sin el índice, dos solicitudes simultáneas podrían dejar dos salidas abiertas.

### 5.4 Reglas para siempre

- En producción **nunca** se usa `prisma migrate dev`, `prisma migrate reset` ni `prisma db push`. Solo `prisma migrate deploy`, que ya corre solo al arrancar.
- Prisma no conoce este índice (es parcial). Si una migración generada en el futuro trae `DROP INDEX "evento_carga_inicial_sin_terminar_unica"`, **borra esa línea** antes de hacer commit.

---

## 6. Copias de seguridad y cómo restaurarlas

Una copia de seguridad que nunca se ha restaurado no está probada. Haz la prueba de la sección 6.3 **antes** de usar la app en producción y repítela cada 3 meses.

### 6.1 Qué respaldos hace Render

En la base `conteo-cargas-db` → pestaña **Recovery** verás dos cosas:

- **Point-in-Time Recovery (recuperación a un punto en el tiempo):** Render guarda continuamente los cambios y puede crear una copia de la base **tal como estaba en cualquier momento** de los últimos 3 días (workspace *Hobby*) o 7 días (workspace *Professional* o superior). Viene activada en las bases de pago; no hay que encender nada.
- **Exports (respaldos lógicos):** un archivo descargable con toda la base. Se crean con el botón **Create export** y Render los guarda 7 días.

### 6.2 Verificar que están activos

1. Abre `conteo-cargas-db` → **Recovery**.
2. En **Point-in-Time Recovery** debe aparecer la ventana disponible (desde cuándo hasta cuándo se puede restaurar). Si dice que no está disponible, revisa que la base esté en un plan de pago.
3. Pulsa **Create export**. Cuando termine, aparece en la lista con su fecha y un botón para descargarlo. Descárgalo y guárdalo fuera de Render (por ejemplo, en un disco o en Drive). Hazlo una vez por semana: es tu respaldo si algo le pasa a la cuenta de Render.

### 6.3 Ensayo de restauración (hazlo de verdad)

Restaurar **no sobreescribe** la base actual: Render crea una base **nueva** con los datos del momento que elijas. Así puedes ensayar sin riesgo.

1. Anota cuántas cargas hay ahora en producción (ver 7.1 para conectarte):
   ```sql
   SELECT COUNT(*), MAX("creadoEn") FROM eventos_carga;
   ```
2. `conteo-cargas-db` → **Recovery** → **Point-in-Time Recovery** → **Restore Database**.
3. Ponle de nombre `conteo-cargas-db-ensayo` y elige una hora de hace al menos 10 minutos (Render no deja elegir algo más reciente).
4. Pulsa **Start Recovery** y espera a que el estado pase de *Recovery In Progress* a *Available*.
5. Conéctate a `conteo-cargas-db-ensayo` (igual que en 7.1, con **sus** datos de conexión) y corre la misma consulta del paso 1. Debe coincidir con lo que había en producción a la hora elegida.
6. Revisa también que el índice esté (consulta de 5.3).
7. Borra la base de ensayo: `conteo-cargas-db-ensayo` → **Settings → Delete Database**. Mientras exista se cobra.

Ensayo del export (respaldo fuera de Render), en tu Mac:

```bash
# Descomprime el export que bajaste en 6.2
mkdir -p ~/respaldo-render && tar -xzf ~/Downloads/NOMBRE_DEL_EXPORT.dir.tar.gz -C ~/respaldo-render
# Crea una base vacía de ensayo en tu Postgres local
docker exec -it handy_conteo_db createdb -U handy_app ensayo_restauracion
# Restaura (ajusta la ruta a la carpeta que salió del tar)
pg_restore --no-owner --no-privileges -h localhost -p 5433 -U handy_app \
  -d ensayo_restauracion ~/respaldo-render/CARPETA_DEL_EXPORT
# Comprueba
psql -h localhost -p 5433 -U handy_app -d ensayo_restauracion -c 'SELECT COUNT(*) FROM eventos_carga;'
# Bórrala al terminar
docker exec -it handy_conteo_db dropdb -U handy_app ensayo_restauracion
```

### 6.4 Restauración real (si se perdieron datos)

1. Haz el paso 6.3 hasta el 5, eligiendo la hora **justo antes** del problema, con nombre `conteo-cargas-db-restaurada`.
2. Comprueba que los datos están bien.
3. En `render.yaml`, cambia `conteo-cargas-db` por `conteo-cargas-db-restaurada` en `databases` y en el `fromDatabase` de `DATABASE_URL`; haz commit y push. Render vuelve a desplegar apuntando a la base restaurada.
4. Cuando todo funcione, suspende o borra la base vieja.

---

## 7. Conectarte a la base de producción desde tu Mac

La base solo acepta conexiones de los servicios de Render (`ipAllowList: []` en `render.yaml`). Para consultas de revisión:

### 7.1 Abrir el acceso temporalmente

1. Averigua tu IP pública: `curl -s https://api.ipify.org`
2. `conteo-cargas-db` → **Info** → **Access Control** → **Add source** → pega tu IP con `/32` al final (por ejemplo `201.141.10.20/32`).
3. En la misma página copia **External Database URL** (la que termina en `.render.com/handy_conteo`). Es una contraseña: no la pegues en ningún lado.
4. Conéctate:
   ```bash
   psql "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL"
   ```
5. Al terminar, **borra tu IP** de Access Control. (Además, Render la quita sola la próxima vez que sincronice el Blueprint.)

---

## 8. Apuntar la app móvil a Render

La app lee la dirección del backend de `EXPO_PUBLIC_API_URL`, en `apps/movil/.env`.

1. Abre `apps/movil/.env`. Hoy tiene algo como `EXPO_PUBLIC_API_URL=http://192.168.x.x:3000` (tu Mac en la red local).
2. Cámbialo por la dirección de Render, **con https y sin barra al final**:
   ```
   EXPO_PUBLIC_API_URL=https://conteo-cargas-backend.onrender.com
   ```
3. Expo mete ese valor en la app al empaquetarla, así que hay que reiniciar limpiando la caché:
   ```bash
   cd apps/movil
   npx expo start --clear
   ```
4. Para volver a desarrollar contra tu Mac, regresa el valor a tu IP local y repite el paso 3.

Si más adelante generas instaladores con EAS Build, ese valor también hay que ponerlo en el perfil de build (en `eas.json` o como variable de entorno de EAS), porque el build no usa tu `.env` local.

---

## 9. Ver los registros (logs) cuando algo falle

| Qué pasó | Dónde mirar |
|---|---|
| El despliegue falló | Servicio → **Events** → el despliegue en rojo → **View logs**. Si falló en el *build*, el error está ahí (dependencias, TypeScript). |
| El servidor no arranca | Servicio → **Logs**. Busca `El servidor no arranca: revisa las variables de entorno` (falta una variable) o errores de `prisma migrate deploy` (una migración falló; ver sección 5). |
| La app dice que no hay conexión | Abre `/salud` en el navegador. `503` con `"baseDeDatos":"sin respuesta"` = problema con la base; revisa la base en el panel. |
| La sincronización de las 5:00 | Servicio → **Logs**, busca `Sincronizacion automatica`. También aparece en el centro de alertas de la app. |
| Un usuario dice "Demasiadas solicitudes" | Servicio → **Logs**, busca `429`. Qué hacer: sección 9.1. |

En **Logs** puedes filtrar por texto y por rango de fechas. Los registros nunca muestran el token de Handy ni el `JWT_SECRET`.

### 9.1 Límites de peticiones

Todos los teléfonos de la bodega salen a internet con **una sola IP pública** (y con datos celulares varios pueden compartir la del operador). Por eso los límites por IP son techos holgados para toda la empresa junta, y el que frena a una persona va por usuario.

| Límite | Cuánto | Llave | Por qué ese número |
|---|---|---|---|
| Global | 1000 por minuto | IP | Un conteo de 60 productos hace ~70 peticiones (un guardado por producto, más abrir y finalizar); contando rápido, ~60 por minuto por teléfono. Las cinco rutas contando a la vez, con vendedor y contador cada una (diez teléfonos), más las consultas automáticas del resto (~4 por minuto por teléfono en el inicio, ~14 el supervisor con discrepancias abiertas) dan ~700 por minuto en el pico: con 600 quedaba muy justo. Es una red contra abuso desde fuera, no un control de capacidad: la protección real es la autenticación y el límite por usuario. |
| PIN por usuario | 20 por minuto | Usuario cuyo PIN se prueba | Aplica a `POST /auth/login`, `POST /auth/cambiar-pin` y la confirmación de discrepancias. Nadie teclea 20 PIN legítimos en un minuto; quien machaca el suyo no frena a sus compañeros. |
| PIN por IP | 150 por minuto | IP | Los mismos endpoints. Red de seguridad contra alguien probando PIN de muchos usuarios desde fuera. |

Ninguno de estos sustituye el **bloqueo a los 5 PIN fallidos**, que es la protección real contra adivinar un PIN. `/salud` no tiene límite.

**Dónde se cambian:** `apps/backend/src/shared/limites/limites-peticiones.ts` (`LIMITE_GLOBAL`, `LIMITE_CREDENCIALES_USUARIO`, `LIMITE_CREDENCIALES_IP`). Cambiar el número, correr `npm test`, hacer commit y push: Render vuelve a desplegar solo. Los contadores viven en memoria del servidor y se reinician con cada despliegue.

**Si en la mañana alguien reporta "Demasiadas solicitudes":**

1. Servicio → **Logs**, busca `429`. Cada rechazo deja una línea de advertencia como:
   `429 POST /auth/login limite=credenciales-usuario (20 por 60s) llave=usuario:ckx…`
   (nunca incluye PIN ni token).
2. Según `limite=`:
   - `credenciales-usuario`: una sola persona tecleó demasiados PIN en un minuto. Que espere un minuto; no afecta a nadie más. Si se repite sin razón, revisar qué hace ese teléfono.
   - `global` o `credenciales-ip`, con la IP de la bodega en `llave=`: la bodega entera llegó al techo. Sube ese límite (por ejemplo al doble) y despliega. Mientras tanto, se libera solo en un minuto; el conteo no se pierde porque la app lo guarda en el teléfono y reintenta el envío sola.
   - `global` o `credenciales-ip` con una IP desconocida y muchas líneas seguidas: alguien de fuera está machacando el servidor. El límite está haciendo su trabajo; no lo subas.

---

## 10. Costo mensual aproximado

Precios de referencia de Render en septiembre de 2026, en dólares (confírmalos en <https://render.com/pricing> antes de contratar):

| Concepto | Plan | USD/mes |
|---|---|---|
| Servicio web siempre encendido | `0.5c-512mb` (0.5 CPU, 512 MB) | ~7 |
| Postgres | `0.1c-256mb` (0.1 CPU, 256 MB) | ~6 |
| Disco de Postgres | 5 GB × ~0.30 | ~1.50 |
| Workspace | Hobby (1 persona) | 0 |
| **Total** | | **~15 USD/mes** |

Notas:

- Con el workspace *Hobby* la recuperación a un punto en el tiempo cubre 3 días. Si quieres 7 días (o agregar a otra persona al panel), el workspace *Professional* cuesta extra por miembro.
- Una base de ensayo de restauración (6.3) se cobra solo el tiempo que exista; si la borras el mismo día cuesta centavos.
- Si la app se siente lenta o la base se queda sin memoria, el siguiente paso es Postgres `0.5c-1g` (~19 USD/mes). Se cambia en `render.yaml` (`plan`) o en el panel.

---

## 11. Lista de verificación del primer despliegue

- [ ] `https://…onrender.com/salud` responde `{"estado":"ok", …, "baseDeDatos":"ok"}`
- [ ] El índice `evento_carga_inicial_sin_terminar_unica` existe (5.3)
- [ ] Supervisor inicial creado y su PIN cambiado (3.1)
- [ ] Sincronización con Handy corrida sin errores
- [ ] Recovery muestra la ventana de Point-in-Time Recovery (6.2)
- [ ] Ensayo de restauración hecho y base de ensayo borrada (6.3)
- [ ] Primer export descargado y guardado fuera de Render (6.2)
- [ ] La app móvil apunta a Render y permite iniciar sesión (8)
- [ ] Tu IP quitada de Access Control (7.1)
