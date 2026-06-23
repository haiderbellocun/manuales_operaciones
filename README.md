# 📋 Acervo Operaciones — Sistema de Gestión Documental

Plataforma institucional para la consulta, gestión y trazabilidad de manuales y documentos operativos, con control de versiones, flujos de actualización y sistema de roles.

![Frontend](https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat&logo=react&logoColor=white&labelColor=20232a)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black&labelColor=333)
![Build](https://img.shields.io/badge/Build-Vite-646CFF?style=flat&logo=vite&logoColor=white&labelColor=1a1a2e)
![Backend](https://img.shields.io/badge/Backend-Express-000000?style=flat&logo=express&logoColor=white&labelColor=333)
![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white&labelColor=1a1a4e)
![Auth](https://img.shields.io/badge/Auth-JWT-FB015B?style=flat&logo=jsonwebtokens&logoColor=white&labelColor=333)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat&labelColor=333)

---

## 📌 Descripción

**Acervo Operaciones** es una plataforma diseñada para centralizar el acervo documental del Área de Operaciones, permitiendo consultar, versionar y gestionar manuales, procedimientos y documentos institucionales desde un solo lugar.

La solución está orientada a equipos que requieren trazabilidad de cambios, control de acceso por rol y área, y un flujo estructurado para solicitar y aprobar actualizaciones de documentos.

---

## ✨ Funcionalidades principales

- 📚 **Biblioteca de documentos** — búsqueda, filtros por área, tipo y estado
- 👁️ **Visor integrado** de documentos Word (.docx) y PDF sin salir de la plataforma
- 📊 **Dashboard** con métricas y actividad reciente del acervo
- 🔄 **Gestión de solicitudes** — flujo de actualización y aprobación de documentos
- 🧩 **Módulos del sistema** — organización por áreas y categorías
- 🔐 **Sistema de roles** — Admin, Gestor y Consultor con permisos diferenciados
- 🏷️ **Control de versiones** — historial de cambios por documento
- 🔑 **Autenticación JWT** con sesión persistente

---

## 🏗️ Arquitectura

### 🔗 Frontend

- React 18
- JavaScript (ES Modules)
- Vite 6
- React Router
- Mammoth.js (visor Word)

### Backend

- Node.js (ESM)
- Express.js
- JWT (jsonwebtoken)
- Multer (carga de archivos)

### Base de datos

- PostgreSQL 16 (Docker)
- Driver: `pg` (node-postgres)

---

## 📁 Estructura del proyecto

```
app_manuales_operaciones/
├── src/                        # Frontend React
│   ├── components/             # Componentes UI reutilizables
│   ├── components.jsx          # Componentes globales compartidos
│   ├── context/                # Context providers (Auth, Docs)
│   ├── views/                  # Vistas principales
│   │   ├── Dashboard.jsx
│   │   ├── Library.jsx
│   │   ├── Gestion.jsx
│   │   └── Modules.jsx
│   └── main.jsx
│
├── server/                     # Backend API REST
│   ├── src/
│   │   ├── db/                 # Pool, repositorios y migración
│   │   ├── middleware/         # Auth JWT
│   │   ├── routes/             # Rutas de la API
│   │   └── index.js
│   ├── .env.example            # Variables de entorno del servidor
│   └── package.json
│
├── .env.example                # Variables de entorno del frontend
├── docker-compose.yml          # PostgreSQL 16
└── package.json
```

---

## 🚀 Inicio rápido

### Requisitos previos

- Node.js 18+
- Docker Desktop (para PostgreSQL)

### Instalación

1. Clonar el repositorio y entrar al directorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd app_manuales_operaciones
   ```

2. Instalar dependencias del frontend y del servidor:
   ```bash
   npm install
   npm install --prefix server
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   cp server/.env.example server/.env
   ```
   > Edita `server/.env` y define un valor seguro para `JWT_SECRET`.

4. Levantar la base de datos (Docker):
   ```bash
   npm run db:up
   ```

5. La migración del esquema se ejecuta automáticamente al iniciar el backend.
   ```bash
   npm run db:migrate --prefix server
   ```

6. Arrancar el proyecto completo:
   ```bash
   npm run dev:all
   ```

La aplicación queda disponible en:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000/api
- **Health check:** http://localhost:3000/api/health

---

## 🔑 Variables de entorno

### Frontend — `.env`

```env
VITE_API_URL=/api
```

### Backend — `server/.env`

```env
PORT=3000
JWT_SECRET=cambia-esto-por-un-secreto-seguro
CORS_ORIGIN=http://localhost:5173

# Opción A — PostgreSQL local (puerto 5432):
# DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/acervo

# Opción B — Docker (npm run db:up, puerto 5433):
DATABASE_URL=postgresql://acervo:acervo_dev@localhost:5433/acervo
```

---

## 🗄️ Configuración de base de datos

El proyecto usa Docker para PostgreSQL. Los comandos disponibles son:

```bash
npm run db:up        # Inicia PostgreSQL en Docker
npm run db:down      # Detiene el contenedor
```

Para ejecutar solo la migración del esquema:
```bash
npm run db:migrate --prefix server
```

> **Credenciales de desarrollo** (solo para entorno local):
> - Usuario admin: `admin@acervo.co` / `admin1234`
> - Usuario demo: `demo@acervo.co` / `demo1234`

---

## 📜 Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el frontend (Vite, puerto 5173) |
| `npm run dev:server` | Inicia el backend (Node --watch, puerto 3000) |
| `npm run dev:all` | Inicia frontend y backend simultáneamente |
| `npm run build` | Compila el frontend para producción |
| `npm run db:up` | Levanta PostgreSQL con Docker |
| `npm run db:down` | Detiene PostgreSQL |

---

## 👥 Roles del sistema

| Rol | Permisos |
|---|---|
| **Admin** | Gestión completa: usuarios, documentos, aprobaciones |
| **Gestor** | Crear y solicitar actualizaciones de documentos |
| **Consultor** | Solo consulta y descarga |

---

## 📄 Licencia

Distribuido bajo la licencia MIT. Ver [LICENSE](LICENSE) para más información.
