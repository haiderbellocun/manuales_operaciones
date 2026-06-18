# Acervo Operaciones — Documentación Técnica

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React | 18.x |
| Build | Vite | 6.x |
| Backend | Express.js (Node.js ESM) | 4.x |
| Base de datos | PostgreSQL | 16 (Docker) |
| Auth | JWT (jsonwebtoken) | 9.x |
| Archivos | Multer | 1.x |
| Visor Word | Mammoth.js | 1.x |
| BD driver | node-postgres (pg) | 8.x |

---

## Arquitectura general

```
Browser (React + Vite :5173)
        │  HTTP /api/*
        ▼
Express API (:3000)
        │
        ├── /api/auth       →  Login, sesión, Microsoft demo
        ├── /api/documents  →  CRUD documentos + archivos
        ├── /api/workflow   →  Items en flujo de revisión
        └── /api/           →  Catálogos (areas, types, roles, users, stats)
        │
        ▼
PostgreSQL (:5433 Docker / :5432 local)
```

El frontend usa un proxy Vite (`/api` → `http://localhost:3000`) en desarrollo. En producción, el servidor Express sirve la misma ruta `/api`.

---

## Arrancar el proyecto

```bash
npm run dev:all          # frontend + backend juntos
npm run dev              # solo frontend (Vite)
npm run dev:server       # solo backend (node --watch)

npm run db:up            # levanta PostgreSQL (Docker)
npm run db:down          # detiene PostgreSQL
npm run db:seed          # migración + seed forzado
```

Al arrancar, el servidor **auto-migra** el esquema (`migrate()`) y **auto-siembra** si la BD está vacía (`seedIfEmpty()`). No se necesita correr migración manualmente en desarrollo.

---

## Variables de entorno requeridas

### `server/.env` (obligatorio — el servidor no arranca sin estas)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://acervo:acervo_dev@localhost:5433/acervo` | Conexión a PostgreSQL |
| `JWT_SECRET` | `cadena-aleatoria-larga` | Clave para firmar tokens |
| `PORT` | `3000` | Puerto del servidor (opcional, default 3000) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS |

### `.env` (frontend)

| Variable | Valor dev | Descripción |
|---|---|---|
| `VITE_API_URL` | `/api` | Base URL del API (proxy Vite en dev) |

---

## Endpoints de la API

Todos los endpoints excepto `/api/health`, `/api/auth/login` y `/api/auth/microsoft` requieren header:
```
Authorization: Bearer <token>
```

### Auth — `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/login` | Login con email + password |
| `POST` | `/microsoft` | Login demo (usuario u1) |
| `GET` | `/session` | Valida token y retorna usuario activo |

### Documentos — `/api/documents`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Lista todos los documentos |
| `GET` | `/:id` | Obtiene un documento por ID |
| `POST` | `/` | Crea un documento nuevo |
| `POST` | `/:id/favorite` | Toggle favorito del usuario |
| `POST` | `/:id/view` | Incrementa contador de vistas |
| `POST` | `/:id/update-request` | Solicita actualización del documento |
| `GET` | `/:id/file` | Descarga/visualiza el archivo adjunto |
| `GET` | `/:id/file/meta` | Metadatos del archivo adjunto |
| `POST` | `/:id/file` | Sube archivo adjunto (PDF, DOCX, XLSX — máx 25 MB) |

### Workflow — `/api/workflow`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Lista items en revisión asignados al usuario |

### Catálogo — `/api`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/areas` | Lista de áreas |
| `GET` | `/types` | Tipos documentales |
| `GET` | `/roles` | Roles del sistema |
| `GET` | `/users` | Lista de usuarios |
| `GET` | `/stats` | Estadísticas globales del acervo |
| `GET` | `/activity` | Actividad reciente |
| `GET` | `/health` | Estado del servidor y la BD |

---

## Esquema de base de datos

```
areas               → Áreas organizacionales
document_types      → Tipos de documento (manual, proc, instructivo…)
roles               → Roles con permisos JSONB
people              → Personas (propietarios de documentos)
users               → Usuarios del sistema (FK → roles, areas)
documents           → Documentos (FK → areas, types, people)
document_history    → Historial de versiones por documento
document_files      → Archivos adjuntos (1:1 con documents)
workflow_items      → Items en flujo de revisión/aprobación
favorites           → Favoritos por usuario (tabla pivote)
update_requests     → Solicitudes de actualización de documentos
activity_log        → Log de actividad del sistema
```

El esquema completo está en [server/sql/schema.sql](server/sql/schema.sql).

---

## Estructura de archivos relevante

```
server/src/
├── app.js                  # Crea la app Express (migrate + seed + rutas)
├── index.js                # Entry point — listen en PORT
├── middleware/
│   └── auth.js             # signToken, verifyToken, authRequired, authOptional
├── db/
│   ├── pool.js             # Pool de conexiones pg
│   ├── migrate.js          # Lee y ejecuta server/sql/schema.sql
│   ├── seedData.js         # Siembra datos iniciales desde src/data.js
│   ├── mapper.js           # Mapea filas BD → objetos de dominio
│   └── repos/
│       ├── documents.js    # Repositorio de documentos y archivos
│       ├── catalog.js      # Áreas, tipos, roles, stats, actividad
│       ├── users.js        # Usuarios, sanitize, last_access
│       └── workflow.js     # Items de workflow
├── routes/
│   ├── auth.js             # Rutas de autenticación
│   ├── documents.js        # CRUD + uploads de documentos
│   ├── workflow.js         # Rutas de workflow
│   └── catalog.js          # Catálogos y estadísticas
├── store/
│   └── files.js            # Almacenamiento de documentos en Cloud Storage
├── scripts/
│   └── seed.js             # Script CLI para seed manual
└── sql/
    └── schema.sql          # DDL completo de la base de datos
```

---

## Notas de desarrollo

**Passwords en texto plano** — Las contraseñas se almacenan y comparan en texto plano. Funciona en desarrollo pero **debe reemplazarse con bcrypt antes de producción**. Ver `server/src/db/seedData.js:53` y `server/src/routes/auth.js`.

**Auto-migración** — El servidor corre `migrate()` cada vez que arranca. Si el esquema cambia, editar `server/sql/schema.sql` y reiniciar. Para limpiar y re-sembrar: `npm run db:seed`.

**Subida de archivos** — Los archivos se guardan exclusivamente en Cloud Storage. `GCS_BUCKET` es obligatorio incluso corriendo local. Formatos permitidos: PDF, DOCX, DOC, XLSX. Límite: 25 MB.
