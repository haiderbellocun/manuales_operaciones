# Despliegue GCP

Arquitectura objetivo:

- Un monolito en Cloud Run: Express sirve `/api` y el frontend compilado de Vite.
- Cloud SQL for PostgreSQL 18 para la base de datos.
- Cloud Storage para documentos.
- Secret Manager para valores sensibles.
- GitHub Actions construye, escanea, versiona y despliega.

## 1. Service account unica

El workflow usa `GCP_SERVICE_ACCOUNT_KEY` para autenticarse y `GCP_SERVICE_ACCOUNT_EMAIL` como service account runtime de Cloud Run.

Esa cuenta necesita permisos:

- `roles/run.admin`
- `roles/iam.serviceAccountUser` sobre ella misma
- `roles/artifactregistry.admin` para crear el repositorio si no existe y subir imagenes
- `roles/cloudsql.client`
- `roles/storage.objectAdmin` sobre el bucket de documentos
- `roles/secretmanager.secretAccessor` sobre los secretos runtime
- `roles/secretmanager.viewer` o acceso puntual suficiente para leer secretos por nombre

## 2. Secretos en Secret Manager

Crea estos secretos en GCP Secret Manager:

- `acervo-db-password`
- `acervo-jwt-secret`
- `acervo-google-oauth-client-id`
- `acervo-smtp-user`
- `acervo-smtp-pass`
- `acervo-smtp-from`
- `acervo-login-logs-db-password` (password de la DB Orbit/core para `logs.login_apps`)

Puedes usar otros nombres. Lo importante es guardar esos nombres en GitHub Actions.

## 3. Secrets en GitHub Actions

Repository Settings -> Secrets and variables -> Actions -> Secrets:

- `GCP_SERVICE_ACCOUNT_KEY`: JSON completo de la service account.
- `GCP_SERVICE_ACCOUNT_EMAIL`: correo de la service account.
- `DB_PASSWORD_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `DB_PASSWORD`.
- `JWT_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `JWT_SECRET`.
- `GOOGLE_OAUTH_CLIENT_ID_SECRET_NAME`: nombre del secreto de Secret Manager que guarda el OAuth Client ID.
- `SMTP_USER_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `SMTP_USER`.
- `SMTP_PASS_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `SMTP_PASS`.
- `SMTP_FROM_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `SMTP_FROM`.
- `LOGIN_LOGS_DB_PASSWORD_SECRET_NAME`: nombre del secreto de Secret Manager que guarda `LOGIN_LOGS_DB_PASSWORD`.

Ejemplo: si en Secret Manager el secreto se llama `acervo-db-password`, entonces el valor de `DB_PASSWORD_SECRET_NAME` en GitHub debe ser `acervo-db-password`.

## 4. Variables en GitHub Actions

Repository Settings -> Secrets and variables -> Actions -> Variables:

- `GCP_PROJECT_ID`: id del proyecto GCP.
- `GCP_REGION`: region del Artifact Registry, por ejemplo `us-central1`.
- `ARTIFACT_REGISTRY_REPOSITORY`: repositorio Docker en Artifact Registry.
- `IMAGE_NAME`: nombre de imagen, por ejemplo `acervo-operaciones`.
- `CLOUD_RUN_SERVICE`: nombre del servicio Cloud Run.
- `CLOUD_RUN_REGION`: region de Cloud Run, por ejemplo `us-central1`.
- `CLOUD_SQL_CONNECTION_NAME`: formato `proyecto:region:instancia`.
- `DB_USER`: usuario de PostgreSQL.
- `DB_NAME`: base de datos, por ejemplo `manuales-operaciones`.
- `GCS_BUCKET`: bucket de documentos.
- `CORS_ORIGIN`: URL publica del frontend/Cloud Run.
- `APP_URL`: URL publica de la aplicacion.
- `GOOGLE_ALLOWED_DOMAINS`: normalmente `cun.edu.co`.
- `GOOGLE_DEFAULT_ROLE_ID`: normalmente `7`.
- `SMTP_HOST`: para Gmail, `smtp.gmail.com`.
- `SMTP_PORT`: para Gmail, `587`.
- `SMTP_SECURE`: para Gmail con 587, `false`.
- `LOGIN_LOGS_DB_HOST`: host de la DB Orbit/core (auditoría de logins).
- `LOGIN_LOGS_DB_PORT`: puerto, normalmente `5432`.
- `LOGIN_LOGS_DB_NAME`: nombre de la DB, normalmente `core`.
- `LOGIN_LOGS_DB_USER`: usuario de la DB Orbit/core.
- `LOGIN_LOGS_DB_SSL`: normalmente `true`.

No debes crear variables manualmente en Cloud Run. El workflow hace `gcloud run deploy` con `--set-env-vars` y `--set-secrets`.

## 5. Base de datos

Usa `server/sql/schema.sql` para crear una base nueva. Ese archivo crea tablas, indices, relaciones y datos base:

- Areas
- Tipos documentales
- Roles y permisos
- Personas/responsables base

No inserta usuarios ni documentos. Los usuarios nacen con Google Login y rol minimo.

## 6. Versionamiento

El workflow calcula SemVer con tags `vX.Y.Z`.

Prioridad:

1. Si el PR asociado al commit tiene label `major`, sube major.
2. Si tiene label `minor`, sube minor.
3. Si tiene label `patch`, sube patch.
4. Si no hay PR o no hay label, sube patch.

La imagen queda con tres tags:

- `vX.Y.Z`
- SHA del commit
- `latest`

## 7. Escaneo

El workflow ejecuta:

- `npm audit --audit-level=high` para frontend.
- `npm audit --prefix server --audit-level=high` para backend.
- Trivy sobre la imagen Docker, fallando en `HIGH` o `CRITICAL`.

## 8. Flujo normal

1. Hacer PR a `main`.
2. Poner label `major`, `minor` o `patch`.
3. Al hacer merge a `main`, GitHub Actions despliega.

Para commit directo a `main`, el workflow despliega con `patch`.
