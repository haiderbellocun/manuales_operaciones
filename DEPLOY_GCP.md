# Despliegue en GCP: Cloud Run + Cloud SQL + Cloud Storage

Este proyecto puede correr como monolito en Cloud Run:

- Express sirve la API en `/api`.
- Express sirve el frontend compilado de Vite desde `dist`.
- PostgreSQL vive en Cloud SQL.
- Los archivos de documentos viven en Cloud Storage.

## Recursos requeridos

1. Cloud SQL para PostgreSQL.
2. Base de datos, por ejemplo `manuales-operaciones`.
3. Bucket de Cloud Storage para documentos.
4. Service account para Cloud Run con permisos:
   - `roles/cloudsql.client`
   - `roles/storage.objectAdmin` sobre el bucket.

## Variables de entorno

Usa como referencia `server/.env.gcp.example`.

Variables principales:

```env
NODE_ENV=production
PORT=8080
JWT_SECRET=un-secreto-largo-y-seguro
GCS_BUCKET=tu-bucket-documentos
CLOUD_SQL_CONNECTION_NAME=tu-proyecto:us-central1:tu-instancia
DB_USER=postgres
DB_PASSWORD=tu-password
DB_NAME=manuales-operaciones
```

`DATABASE_URL` sigue funcionando para desarrollo local de PostgreSQL. Los archivos siempre requieren `GCS_BUCKET`.

## Desarrollo local con Cloud Storage

Para probar subida y descarga de documentos desde tu maquina local, usa una cuenta de servicio con permisos sobre el bucket.

1. En Google Cloud crea una service account, por ejemplo `acervo-storage-local`.
2. Dale permisos sobre el bucket de documentos:
   - `roles/storage.objectAdmin`
3. Crea una llave JSON para esa cuenta.
4. Guarda el JSON fuera del repo o en `./secrets`, carpeta ignorada por Git.
5. Configura `server/.env`:

```env
GCS_BUCKET=tu-bucket-documentos
GOOGLE_APPLICATION_CREDENTIALS=./secrets/acervo-storage-sa.json
```

En Windows tambien puedes usar ruta absoluta:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\tu_usuario\Documents\gcp\acervo-storage-sa.json
```

No subas el JSON de la cuenta de servicio al repositorio.

## Build local de imagen

```bash
docker build -t acervo-operaciones .
```

## Deploy con gcloud

```bash
gcloud run deploy acervo-operaciones \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances TU_PROYECTO:us-central1:TU_INSTANCIA \
  --set-env-vars NODE_ENV=production,PORT=8080,GCS_BUCKET=TU_BUCKET,CLOUD_SQL_CONNECTION_NAME=TU_PROYECTO:us-central1:TU_INSTANCIA,DB_USER=postgres,DB_NAME=manuales-operaciones \
  --set-secrets DB_PASSWORD=DB_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest
```

Recomendado: guarda `DB_PASSWORD` y `JWT_SECRET` en Secret Manager.

## Notas importantes

- Si la base está vacía, la app ejecuta migración y seed inicial al arrancar.
- Los archivos siempre se guardan en Cloud Storage. Si `GCS_BUCKET` no está configurado, las operaciones de archivo fallan con un error explícito.
- Para trabajar local, usa preferiblemente `GOOGLE_APPLICATION_CREDENTIALS` apuntando al JSON de una cuenta de servicio con permisos sobre el bucket.
