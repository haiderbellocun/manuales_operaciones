<div align="center">

# 🏛️ Acervo Operaciones
### Centro Inteligente de Gestión y Conocimiento Documental Institucional

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Storage_&_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Design](https://img.shields.io/badge/Design-Apple_Bento_Grid-0071E3?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/hubeiqiao/apple-bento-grid)
[![License](https://img.shields.io/badge/License-MIT-0F5132?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Plataforma unificada para la centralización, consulta, versionamiento, aprobación y trazabilidad de manuales, procedimientos, formatos, ANS y documentos operativos de la Corporación Unificada Nacional de Educación Superior (CUN).</b>
</p>

[✨ Características](#-características-principales) •
[🍏 Diseño Bento](#-diseño-apple-bento-grid) •
[🚀 Inicio Rápido](#-inicio-rápido) •
[📐 Arquitectura](#-arquitectura-del-sistema) •
[🔐 Roles & Permisos](#-roles-y-matriz-de-acceso) •
[🧪 Pruebas](#-pruebas-e2e) •
[☁️ Despliegue](#%EF%B8%8F-despliegue-en-producción)

---

</div>

## 🌟 Características Principales

<table>
  <tr>
    <td width="50%">
      <h3>🍏 Experiencia Apple Bento Grid</h3>
      <p>Interfaz moderna inspirada en el sistema modular de Apple, con tipografía display <b>Sora</b>, tarjetas asimétricas interactivas, micro-sombras limpias y adaptabilidad responsiva completa.</p>
    </td>
    <td width="50%">
      <h3>🗺️ Mapa Vivo Interactivo</h3>
      <p>Navegador visual de 3 capas para explorar el ciclo de vida documental, la jerarquía de áreas/escuelas de la CUN y las responsabilidades asignadas a cada rol.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>☁️ Carga Atómica en Cloud Storage</h3>
      <p>Integración transaccional con <b>Google Cloud Storage</b>: el registro en base de datos y la subida del binario ocurren en una operación atómica indivisible con control estricto de versiones.</p>
    </td>
    <td width="50%">
      <h3>🔒 Control de Acceso RBAC Granular</h3>
      <p>Autenticación mediante <b>Google Identity Services (CUN OAuth)</b> con cookies HTTP-only JWT y políticas de consulta/escritura segmentadas por área, escuela y rol.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔄 Flujo de Trabajo y Aprobaciones</h3>
      <p>Trazabilidad de ciclo completo con 5 etapas: <i>Borrador ➔ En Revisión ➔ Aprobado ➔ Publicado ➔ Actualización</i> con firmas auditables y registro histórico.</p>
    </td>
    <td width="50%">
      <h3>📊 Analítica & Infografías Visuales</h3>
      <p>Métricas de uso, consultas, descargas, documentos más populares y soporte para adjuntar infografías gráficas de resumen visual para cada manual o procedimiento.</p>
    </td>
  </tr>
</table>

---

## 🍏 Diseño Apple Bento Grid

La plataforma implementa los principios de diseño de **Apple Bento Grid**:

```
┌─────────────────────────────────────────────────────────────┬───────────────────────────┐
│  BENTO HERO CARD (Span 2)                                   │  PROFILE STATUS CARD      │
│  • Saludo personalizado en Sora Display                      │  • Avatar & Rol activo    │
│  • Buscador universal con forma de píldora (Pill Search)    │  • Permisos vigentes      │
│  • Filtros rápidos: Biblioteca, Métricas, Ciclo y Áreas     │  • Recorrido guiado       │
├──────────────────────────┬──────────────────────────────────┴───────────────────────────┤
│  ATAJOS RÁPIDOS          │  MAPA INTERACTIVO DE PROCESOS / ÁREAS                        │
│  • Biblioteca Documental │  • Ruta de Consulta (5 estaciones)                           │
│  • Gestión & Carga       │  • Ruta de Gestión (5 estaciones)                            │
│  • Analítica de Uso      │  • Panel lateral de especificaciones en tiempo real          │
└──────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 📐 Arquitectura del Sistema

```mermaid
flowchart TD
    subgraph Frontend["💻 Frontend (React 18 + Vite 6)"]
        UI[Apple Bento Grid UI]
        Router[React Router SPA]
        AuthCtx[Auth Context & State]
    end

    subgraph Backend["⚙️ Backend API (Node.js ESM + Express)"]
        AuthMid[JWT Auth Middleware]
        DocRouter[Document & Workflow Engine]
        AnalyticsEngine[Analytics & Metrics Engine]
        StorageSvc[Cloud Storage Service]
        MailSvc[Notification & SMTP Service]
    end

    subgraph Storage["☁️ Servicios de Persistencia"]
        GCS[(Google Cloud Storage)]
        PG[(PostgreSQL 15+ / Cloud SQL)]
    end

    UI --> Router
    Router --> AuthCtx
    AuthCtx -->|REST API + HTTPS| AuthMid
    AuthMid --> DocRouter
    AuthMid --> AnalyticsEngine
    DocRouter -->|Binarios & Versiones| StorageSvc
    DocRouter -->|Metadatos & Permisos| PG
    StorageSvc -->|Subida Atómica| GCS
    AnalyticsEngine -->|Trazabilidad| PG
    DocRouter -->|Alertas| MailSvc
```

---

## 🚀 Inicio Rápido

### 1. Prerrequisitos
- **Node.js**: v18.0.0 o superior (recomendado v22.x LTS)
- **npm**: v9.0.0 o superior
- **PostgreSQL**: v14.0 o superior (local o Cloud SQL)
- **Cuenta Google Cloud**: Con bucket de Cloud Storage y credenciales OAuth

---

### 2. Clonar el repositorio e instalar dependencias

```bash
# Clonar el proyecto
git clone https://github.com/haiderbellocun/manuales_operaciones.git
cd manuales_operaciones

# Instalar dependencias del Frontend
npm install

# Instalar dependencias del Backend API
npm install --prefix server
```

---

### 3. Configuración de Variables de Entorno

Crear los archivos de entorno a partir de las plantillas de ejemplo:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

#### Frontend (`.env`)
```env
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

#### Backend (`server/.env`)
```env
PORT=3000
APP_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=tu-clave-secreta-jwt-super-segura-y-larga

# Base de datos PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/manuales-operaciones

# Google Cloud Storage
GCS_BUCKET=tu-bucket-documentos-cun
GOOGLE_APPLICATION_CREDENTIALS=./secrets/acervo-storage-sa.json

# Google Identity Services OAuth
GOOGLE_OAUTH_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_DOMAINS=cun.edu.co
GOOGLE_DEFAULT_ROLE_ID=7

# Notificaciones por Correo (Opcional en desarrollo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notificaciones@cun.edu.co
SMTP_PASS=tu-app-password
SMTP_FROM="Acervo Operaciones CUN <notificaciones@cun.edu.co>"
```

---

### 4. Inicializar la Base de Datos

Ejecuta el script de migración para estructurar tablas, catálogos y datos semilla:

```bash
npm run db:migrate --prefix server
```

---

### 5. Iniciar la Aplicación en Desarrollo

Inicia tanto el servidor frontend como la API backend simultáneamente:

```bash
npm run dev:all
```

* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
* **Health Check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 📁 Estructura del Proyecto

```text
manuales_operaciones/
├── 📂 docs/                    # Especificaciones funcionales y arquitectura
├── 📂 server/                  # Backend API (Node.js ESM + Express)
│   ├── 📂 sql/                 # Scripts SQL, esquemas y migraciones versionadas
│   │   ├── 📂 migrations/      # Migraciones incrementales de esquema
│   │   └── schema.sql          # Esquema principal DDL de PostgreSQL
│   └── 📂 src/
│       ├── 📂 config/          # Constantes y mapeo de áreas
│       ├── 📂 db/              # Conexión Pool, migraciones y repositorios
│       ├── 📂 middleware/      # Seguridad JWT y validadores RBAC
│       ├── 📂 routes/          # Endpoints REST (auth, docs, analytics, etc.)
│       ├── 📂 services/        # Google Identity, mailer y auditoría
│       └── 📂 store/           # Conector atómico con Google Cloud Storage
├── 📂 src/                     # Frontend SPA (React 18 + Vite)
│   ├── 📂 assets/              # Iconografía, imágenes y mascotas por coordinación
│   ├── 📂 components/          # Tarjetas Bento, badges, modales y visualizadores
│   ├── 📂 context/             # AuthContext, DocsContext, CatalogContext
│   ├── 📂 services/            # Cliente HTTP Axios y gestor de descargas
│   ├── 📂 utils/               # Formateadores, paleta de colores y validaciones
│   ├── 📂 views/               # Vistas (Dashboard, Library, Gestion, Analytics, etc.)
│   ├── App.jsx                 # Enrutamiento principal y layouts
│   ├── main.jsx                # Punto de entrada de la aplicación
│   └── styles.css              # Sistema de diseño Apple Bento Grid y tokens CSS
├── 📂 tests/                   # Suite de pruebas E2E con Playwright
├── DEPLOY_GCP.md               # Guía completa de despliegue en Google Cloud Platform
├── package.json                # Dependencias y scripts globales
└── vite.config.js              # Configuración de compilación y Proxy de desarrollo
```

---

## 🔐 Roles y Matriz de Acceso

| Rol | Nivel de Alcance | Consultar | Cargar / Editar | Revisar / Aprobar | Publicar | Analítica Global |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Administrador General** | Global Institucional | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Coordinador Operación Académica** | Todas las Escuelas | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Líder de Área** | Área asignada | ✅ | ✅ | ✅ | ✅ | 📊 Área |
| **Editor Documental** | Área / Escuela asignada | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Revisor** | Área asignada | ✅ | ❌ | ✅ (Revisión) | ❌ | ❌ |
| **Aprobador** | Área asignada | ✅ | ❌ | ✅ (Aprobación) | ✅ | ❌ |
| **Usuario Consultor** | Documentos publicados | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Auditor / Lector Institucional** | Consulta sin descarga | ✅ (Solo ver) | ❌ | ❌ | ❌ | ✅ |

---

## 🛠️ Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el frontend con Vite (`localhost:5173`). |
| `npm run dev:server` | Inicia el backend API con nodemon (`localhost:3000`). |
| `npm run dev:all` | Inicia frontend y backend concurrentemente. |
| `npm run build` | Compila el frontend optimizado para producción en `dist/`. |
| `npm run preview` | Previsualiza localmente el build de producción. |
| `npm run db:migrate --prefix server` | Ejecuta las migraciones de base de datos PostgreSQL. |
| `npm run test:e2e` | Ejecuta la suite de pruebas End-to-End con Playwright. |

---

## 🧪 Pruebas E2E

El proyecto cuenta con una suite automatizada de pruebas con **Playwright** que valida:
* Sesión y flujo OAuth con dominios restringidos.
* Carga atómica obligatoria de binarios hacia Cloud Storage.
* Flujo de transición de estados: *Borrador ➔ Revisión ➔ Aprobación ➔ Publicación*.
* Restricciones de descarga por rol y alcance de escuelas.

```bash
# Ejecutar todas las pruebas E2E
npm run test:e2e

# Ejecutar con interfaz interactiva
npx playwright test --ui
```

---

## ☁️ Despliegue en Producción

El proyecto está diseñado para desplegarse de manera nativa en **Google Cloud Platform (GCP)**:

1. **API y Frontend:** [Google Cloud Run](https://cloud.google.com/run) (Contenedor Dockerizado).
2. **Base de Datos:** [Google Cloud SQL](https://cloud.google.com/sql) (PostgreSQL administrado).
3. **Archivos e Infografías:** [Google Cloud Storage](https://cloud.google.com/storage) (Bucket seguro).
4. **Secretos:** [Google Secret Manager](https://cloud.google.com/secret-manager).

> 📖 Para ver el paso a paso detallado de despliegue, consulta la guía [DEPLOY_GCP.md](DEPLOY_GCP.md).

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

<div align="center">
  <sub>Desarrollado con ❤️ para la <b>Corporación Unificada Nacional de Educación Superior (CUN)</b></sub>
</div>
