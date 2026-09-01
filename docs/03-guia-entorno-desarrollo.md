# Guía de Entorno de Desarrollo

**Proyecto:** App para verificación de cargas de rutas — Integración con API Handy
**Versión:** 1.0
**Fecha:** Agosto 2026
**Alcance:** Configuración del entorno en macOS (MacBook) para desarrollo del backend (NestJS) y la app (React Native, Android + iOS)

---

## 1. Resumen de herramientas a instalar

| Herramienta | Uso |
|---|---|
| Homebrew | Gestor de paquetes de macOS, base para instalar casi todo lo demás |
| Git | Control de versiones |
| Cuenta de GitHub | Repositorio remoto del proyecto |
| Node.js (vía nvm) | Runtime de backend y tooling de la app |
| Docker Desktop | Contenedor de PostgreSQL local (y opcionalmente el backend) |
| PostgreSQL (vía Docker) | Base de datos |
| NestJS CLI | Andamiaje y comandos del backend |
| Prisma CLI | ORM y migraciones de base de datos |
| Watchman | Requerido por React Native para observar cambios de archivos |
| Java (JDK) + Android Studio | Compilar y correr la app en Android |
| Xcode + CocoaPods | Compilar y correr la app en iOS |
| Visual Studio Code | Editor/IDE principal |
| Postman o Insomnia | Probar endpoints propios y explorar la API de Handy |

## 2. Control de versiones

### 2.1 Git
```bash
brew install git
git --version
```

Configurar identidad (usar el correo asociado a tu cuenta de GitHub):
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
```

### 2.2 Cuenta y repositorio de GitHub
1. Crear una cuenta de GitHub si no existe (idealmente una organización para el negocio, no solo tu cuenta personal, para que a futuro tus hermanos o un colaborador puedan tener acceso ordenado).
2. Crear un repositorio privado para el proyecto (ej. `handy-conteo-app`).
3. Generar una clave SSH y agregarla a tu cuenta de GitHub para no autenticar con usuario/contraseña en cada `push`:
```bash
ssh-keygen -t ed25519 -C "tu-correo@ejemplo.com"
cat ~/.ssh/id_ed25519.pub   # copiar y pegar en GitHub → Settings → SSH keys
```
4. Clonar el repositorio localmente:
```bash
git clone git@github.com:tu-organizacion/handy-conteo-app.git
```

### 2.3 Estructura de repositorio recomendada
Dado que el backend y la app comparten tipos/lenguaje (TypeScript), un **monorepo** simplifica mantener sincronizados los contratos entre ambos:

```
handy-conteo-app/
├── apps/
│   ├── backend/       (NestJS)
│   └── mobile/        (React Native)
├── packages/
│   └── shared-types/  (interfaces compartidas: payloads, DTOs)
├── docs/              (los documentos de definición, técnico y visual)
├── .gitignore
└── README.md
```

Si prefieres simplicidad sobre optimización de tipos compartidos, dos repositorios separados (`handy-conteo-backend`, `handy-conteo-app`) también es válido para este tamaño de proyecto — la recomendación del monorepo es opcional, no obligatoria.

### 2.4 `.gitignore` mínimo indispensable
```
node_modules/
.env
.env.*
dist/
build/
ios/Pods/
*.log
.DS_Store
```
**Importante:** el archivo `.env` (donde vivirá el token de Handy y demás secretos) nunca debe commitearse. Crear un `.env.example` sin valores reales como referencia para el equipo.

## 3. Node.js

Usar **nvm** (Node Version Manager) en vez de instalar Node directamente, para poder fijar la versión exacta del proyecto sin conflictos con otros proyectos en la misma máquina.

```bash
brew install nvm
mkdir ~/.nvm
```
Agregar a `~/.zshrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
```
Instalar la versión LTS vigente (recomendado: la última LTS activa al momento de iniciar el proyecto):
```bash
nvm install --lts
nvm use --lts
node --version
```
Fijar la versión del proyecto con un archivo `.nvmrc` en la raíz del repositorio (ej. contenido `20`), para que cualquiera que clone el repo use `nvm use` y quede en la misma versión.

Gestor de paquetes: **npm** es suficiente y viene con Node; si prefieres mayor velocidad de instalación, `pnpm` es una alternativa válida, pero no es indispensable para este proyecto.

## 4. Backend (NestJS + PostgreSQL + Prisma)

### 4.1 Docker Desktop (para PostgreSQL en contenedor)
```bash
brew install --cask docker
```
Abrir Docker Desktop una vez para completar la instalación inicial.

### 4.2 PostgreSQL vía Docker Compose
En `apps/backend/docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: handy_app
      POSTGRES_PASSWORD: cambiar_esta_clave_local
      POSTGRES_DB: handy_conteo
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
volumes:
  db_data:
```
Levantar la base de datos:
```bash
docker compose up -d
```
Esto mantiene el entorno de base de datos idéntico entre tu máquina y, a futuro, cualquier otro desarrollador — sin depender de una instalación nativa de Postgres en macOS.

### 4.3 NestJS CLI
```bash
npm install -g @nestjs/cli
nest new backend   # dentro de apps/, si usas monorepo
```

### 4.4 Prisma
```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```
Esto genera `prisma/schema.prisma` (donde se modela `Usuario_App`, `Evento_Carga`, etc.) y un `.env` con la variable `DATABASE_URL` apuntando al contenedor de Postgres.

### 4.5 Variables de entorno del backend (`.env`, nunca commiteado)
```
DATABASE_URL="postgresql://handy_app:cambiar_esta_clave_local@localhost:5432/handy_conteo"
HANDY_API_TOKEN="tu_token_de_handy"
HANDY_API_BASE_URL="https://hub.handy.la/api/v2"
JWT_SECRET="una_clave_larga_y_aleatoria"
FCM_SERVER_KEY="clave_de_firebase_cloud_messaging"
```

## 5. App móvil (React Native)

### 5.1 Herramientas base
```bash
brew install watchman
```

### 5.2 Inicializar el proyecto
```bash
npx react-native init mobile --template react-native-template-typescript
```

### 5.3 Soporte Android
1. Instalar **Android Studio** (descarga directa desde el sitio oficial, no vía Homebrew, para asegurar el instalador gráfico completo).
2. Dentro de Android Studio → SDK Manager: instalar el Android SDK, un emulador (AVD) y las Platform Tools.
3. Instalar el JDK requerido por React Native (usualmente JDK 17):
```bash
brew install --cask zulu17
```
4. Configurar variables de entorno en `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 5.4 Soporte iOS
1. Instalar **Xcode** desde la App Store (necesario incluso si el desarrollo principal se enfoca en Android, porque el rol Supervisor usa iPhone).
2. Aceptar la licencia y abrir Xcode una vez para completar componentes adicionales.
3. Instalar CocoaPods (gestor de dependencias nativas de iOS):
```bash
brew install cocoapods
cd ios && pod install
```

### 5.5 Verificar el entorno
React Native incluye un diagnóstico automático:
```bash
npx react-native doctor
```
Resolver cualquier ítem marcado en rojo antes de continuar.

## 6. Editor / IDE

**Visual Studio Code**, con las siguientes extensiones recomendadas:
- ESLint y Prettier (consistencia de formato en todo el equipo)
- Prisma (resaltado de sintaxis para `schema.prisma`)
- Docker (gestionar contenedores desde el editor)
- GitLens (historial de cambios por línea, útil en revisiones)
- React Native Tools

## 7. Pruebas de API

Instalar **Postman** o **Insomnia** para:
- Probar los endpoints del backend propio durante el desarrollo, antes de conectarlos a la app.
- Explorar directamente la API de Handy (crear ruta, recarga, consultar catálogo) de forma aislada, útil para depurar payloads sin pasar por toda la app.

## 8. Checklist final de verificación

- [ ] `git --version` y clave SSH agregada a GitHub
- [ ] Repositorio clonado localmente
- [ ] `node --version` coincide con el `.nvmrc` del proyecto
- [ ] Docker Desktop corriendo y `docker compose up -d` levanta Postgres sin errores
- [ ] `npx prisma studio` abre y muestra la base de datos vacía correctamente
- [ ] `nest new` o el backend clonado corre con `npm run start:dev` sin errores
- [ ] `npx react-native doctor` sin ítems en rojo
- [ ] La app corre en un emulador Android (`npx react-native run-android`)
- [ ] La app corre en un simulador iOS (`npx react-native run-ios`)
- [ ] Archivo `.env` creado localmente (a partir de `.env.example`) y **no aparece** en `git status` como archivo por commitear
