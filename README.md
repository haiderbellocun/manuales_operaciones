# Acervo Operaciones

Sistema institucional de gestión documental para manuales, procedimientos, formatos, ANS y documentos operativos del área de Operaciones.

La aplicación centraliza consulta, carga, versionamiento, trazabilidad, aprobaciones, notificaciones y control de acceso por rol, área y coordinación.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 6, React Router |
| Backend | Node.js ESM, Express |
| Base de datos | PostgreSQL |
| Archivos | Google Cloud Storage |
| Autenticación | Google Identity Services + JWT en cookie HTTP-only |
| Notificaciones | Internas en BD + SMTP |
| Pruebas | Playwright E2E |

## Funcionalidades principales

- Login con cuenta institucional de Google.
- Foto de perfil tomada desde el perfil de Google del usuario.
- Inicio interactivo “Mapa vivo de Acervo” con ruta documental, mapa de áreas, responsabilidades por rol y recorrido guiado.
- Biblioteca documental con filtros por área, coordinación, tipo, estado y búsqueda.
- Consulta compartida en Operación Académica: los usuarios asignados a una escuela pueden ver los documentos de todas sus subcoordinaciones.
- Escritura segmentada por escuela y documentos generales de Operación Académica, disponibles para todas las subcoordinaciones.
- Carga obligatoria de archivo al crear documentos.
- Almacenamiento de documentos en Google Cloud Storage.
- Creación atómica de documento + archivo: si el archivo no sube, el documento no se crea.
- Control de versiones de documentos.
- Descarga controlada por permisos.
- Flujo de revisión, aprobación y publicación.
- Solicitudes de actualización documental.
- Favoritos, vistas, actividad reciente y reportes.
- Gestión de usuarios, roles, áreas y coordinaciones.
- Notificaciones internas y envío por correo cuando SMTP está configurado.

## Estructura del proyecto

```text
manuales_operaciones/
src/                         # Frontend React
  components/                # Componentes UI
  context/                   # Contextos de autenticación y datos
  services/                  # Cliente API y utilidades
  views/                     # Vistas principales
server/                      # API Express
  sql/schema.sql             # Esquema base PostgreSQL
  src/
    db/                      # Pool, migraciones, repositorios y mappers
    middleware/              # Autenticación y permisos
    routes/                  # Rutas REST
    services/                # Google Identity y correo
    store/                   # Integración con Cloud Storage
tests/e2e/                   # Suite Playwright
playwright.config.js         # Configuración de pruebas E2E
DEPLOY_GCP.md                # Guía de despliegue en GCP
package.json
```

## Requisitos

- Node.js 18 o superior. En desarrollo se ha probado con Node 22.
- npm.
- PostgreSQL local o Cloud SQL.
- Un bucket de Google Cloud Storage.
- Credenciales de Google Cloud para desarrollo local.
- OAuth Client ID de Google Identity Services.
- Chrome instalado para ejecutar la suite E2E local.

## Instalación local

1. Instalar dependencias del frontend:

```bash
npm install
```

2. Instalar dependencias del backend:

```bash
npm install --prefix server
```

3. Crear los archivos de entorno:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

4. Configurar PostgreSQL y crear la base de datos indicada en `server/.env`.

Ejemplo local:

```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/manuales-operaciones
```

5. Configurar Google Cloud Storage en `server/.env`:

```env
GCS_BUCKET=tu-bucket-documentos
GOOGLE_APPLICATION_CREDENTIALS=./secrets/acervo-storage-sa.json
```

La cuenta de servicio debe tener permisos para crear, leer y eliminar objetos en el bucket.

Los objetos nuevos se organizan por el ID estable del documento. Crear una nueva versión no
cambia esta carpeta; únicamente agrega un objeto identificado por nombre, versión y fecha UTC:

```text
documents/{documentId}/{nombre}_v{version}_{fecha}.pdf
documents/{documentId}/infographics/{nombre}_v{version}_{fecha}.png
```

Las rutas históricas almacenadas en la base de datos continúan siendo compatibles.

6. Configurar Google OAuth:

Frontend `.env`:

```env
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

Backend `server/.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_DOMAINS=cun.edu.co
GOOGLE_DEFAULT_ROLE_ID=7
```

7. Ejecutar migración de base de datos:

```bash
npm run db:migrate --prefix server
```

8. Levantar frontend y backend:

```bash
npm run dev:all
```

URLs locales:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

## Variables de entorno

### Frontend `.env`

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API. En local normalmente `/api`. |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google Identity Services. |

### Backend `server/.env`

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API. Por defecto `3000`. |
| `JWT_SECRET` | Secreto para firmar sesiones JWT. Debe ser largo y privado. |
| `CORS_ORIGIN` | Origen permitido para el frontend. |
| `APP_URL` | URL pública/local de la aplicación. |
| `DATABASE_URL` | Cadena de conexión PostgreSQL local o remota. |
| `CLOUD_SQL_CONNECTION_NAME` | Conexión Cloud SQL para producción en GCP. |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales alternativas para Cloud SQL. |
| `GCS_BUCKET` | Bucket donde se guardan los documentos. Obligatorio. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta al JSON de cuenta de servicio en local. |
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID usado por backend para validar Google. |
| `GOOGLE_ALLOWED_DOMAINS` | Dominios permitidos para login. |
| `GOOGLE_DEFAULT_ROLE_ID` | Rol asignado por defecto a usuarios creados por Google Login. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Configuración SMTP. |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Credenciales y remitente de correo. |

No subas `.env`, `server/.env`, `sa.json` ni llaves de servicio al repositorio. Ya están ignorados por Git.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el frontend con Vite. |
| `npm run dev:server` | Inicia el backend desde `server/`. |
| `npm run dev:all` | Inicia frontend y backend en paralelo. |
| `npm run build` | Compila el frontend para producción. |
| `npm run preview` | Sirve el build de Vite para revisión local. |
| `npm run server:start` | Inicia el backend en modo start. |
| `npm run test:e2e` | Ejecuta la suite Playwright E2E. |
| `npm run db:migrate --prefix server` | Ejecuta migraciones y datos base del backend. |

## Base de datos

El esquema principal está en:

```text
server/sql/schema.sql
```

Las migraciones incrementales que dejan trazabilidad de cambios en bases ya
existentes se conservan en:

```text
server/sql/migrations/
```

La migración de métricas y analítica documental corresponde a:

```text
server/sql/migrations/20260804_001_document_usage_analytics.sql
```

La asociación de una infografía gráfica por documento corresponde a:

```text
server/sql/migrations/20260804_002_document_infographics.sql
```

El rol institucional de consulta global de métricas corresponde a:

```text
server/sql/migrations/20260810_004_global_analytics_role.sql
```

La migración se ejecuta desde:

```bash
npm run db:migrate --prefix server
```

La base incluye catálogos mínimos para operar:

- Áreas.
- Coordinaciones.
- Tipos documentales.
- Roles y permisos.

Los usuarios se crean desde Google Login o desde la administración de usuarios. Los documentos se crean desde el flujo documental de la aplicación.

## Roles

| Rol | Alcance general |
|---|---|
| Administrador general | Control total de plataforma, usuarios, documentos y flujo. |
| Coordinador de Operación Académica | Gestiona todas las escuelas y puede crear documentos generales para toda Operación Académica. |
| Líder de área | Gestión y aprobación documental de su área. |
| Editor documental | Creación y edición documental. |
| Revisor | Revisión y observaciones. |
| Aprobador | Aprobación y publicación. |
| Usuario consultor | Consulta y descarga de documentos publicados. |
| Auditor / lector institucional | Consulta y trazabilidad sin descarga. |

En Operación Académica, un usuario asignado a una escuela conserva la creación y edición únicamente sobre esa escuela, pero puede consultar los documentos de las demás. Los documentos generales pueden ser creados por el coordinador de Operación Académica o un administrador y se muestran dentro de todas las escuelas.

## Pruebas E2E

La suite Playwright levanta servicios locales aislados:

- Frontend: `http://127.0.0.1:5174`
- Backend: `http://127.0.0.1:3100`

Ejecutar:

```bash
npm run test:e2e
```

La suite valida:

- Health check, sesión y catálogos.
- Sesiones inválidas, usuarios inactivos y CORS.
- Reglas de permisos por rol.
- Reglas de coordinación.
- Carga obligatoria de archivo.
- Creación atómica en PostgreSQL + Cloud Storage.
- Consulta, descarga, favoritos, vistas y edición.
- Solicitudes de actualización.
- Flujo de revisión, aprobación y publicación.
- Versiones documentales.
- Módulos, actividad, reportes y notificaciones.
- Navegación principal en Chrome.

Notas:

- Usa la base de datos y el bucket configurados en `server/.env`.
- Crea datos temporales con prefijo `E2E-*`.
- Limpia documentos, usuarios, personas y archivos temporales al finalizar.
- El SMTP se reemplaza por una configuración local de prueba para evitar envíos reales.

## Build

```bash
npm run build
```

El build genera archivos en `dist/`. Si Vite advierte que algún chunk supera 500 kB, no bloquea la compilación; es una oportunidad de optimización futura con code splitting.

## Despliegue

La guía de despliegue en Google Cloud está en:

```text
DEPLOY_GCP.md
```

La arquitectura objetivo usa:

- Cloud Run para servir API y frontend compilado.
- Cloud SQL for PostgreSQL.
- Cloud Storage para documentos.
- Secret Manager para credenciales.
- GitHub Actions para construir y desplegar.

## Licencia

Este proyecto está distribuido bajo licencia MIT. Ver `LICENSE`.
