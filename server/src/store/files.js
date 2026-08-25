import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { Storage } from '@google-cloud/storage';
import '../config/env.js';

const bucketName = process.env.GCS_BUCKET;
const storageMode = process.env.FILE_STORAGE_MODE === 'local' ? 'local' : 'gcs';
const localStorageRoot = path.resolve(
  process.env.FILE_STORAGE_LOCAL_DIR
    || path.join(process.cwd(), 'test-results', 'file-storage'),
);
const storage = storageMode === 'gcs' ? new Storage() : null;

function storageError(message, cause) {
  const err = new Error(message);
  err.statusCode = 503;
  err.code = 'STORAGE_UNAVAILABLE';
  err.cause = cause;
  return err;
}

function normalizeStorageError(err) {
  const message = err?.message || '';
  if (message.includes('Could not load the default credentials')) {
    return storageError(
      'Cloud Storage no tiene credenciales configuradas en esta maquina. Ejecuta gcloud auth application-default login o define GOOGLE_APPLICATION_CREDENTIALS con una cuenta de servicio.',
      err,
    );
  }
  if (message.includes('invalid_grant') || message.includes('reauth') || message.includes('Login Required')) {
    return storageError(
      'Las credenciales locales de Google Cloud expiraron o requieren reautenticacion. Ejecuta gcloud auth application-default login de nuevo.',
      err,
    );
  }
  if (err?.code === 403) {
    return storageError(
      `La cuenta autenticada no tiene permisos sobre el bucket ${bucketName}. Asigna permisos de lectura/escritura en Cloud Storage.`,
      err,
    );
  }
  if (err?.code === 404) {
    return storageError(
      `El bucket ${bucketName} no existe o no es accesible desde estas credenciales.`,
      err,
    );
  }
  return err;
}

async function runStorageOperation(operation) {
  try {
    return await operation();
  } catch (err) {
    throw normalizeStorageError(err);
  }
}

function getBucket() {
  if (!bucketName) {
    throw storageError('GCS_BUCKET no esta configurado. Define el bucket de Cloud Storage en server/.env o en Cloud Run.');
  }
  return storage.bucket(bucketName);
}

function getLocalObjectPath(storedName) {
  const objectPath = path.resolve(
    localStorageRoot,
    ...String(storedName || '').split('/').filter(Boolean),
  );
  const rootPrefix = `${localStorageRoot}${path.sep}`;
  if (objectPath !== localStorageRoot && !objectPath.startsWith(rootPrefix)) {
    throw storageError('La ruta local del archivo no es valida.');
  }
  return objectPath;
}

async function saveObject(storedName, file, cacheControl) {
  if (storageMode === 'local') {
    const objectPath = getLocalObjectPath(storedName);
    await fsPromises.mkdir(path.dirname(objectPath), { recursive: true });
    await fsPromises.writeFile(objectPath, file.buffer);
    return;
  }
  const gcsFile = getBucket().file(storedName);
  await runStorageOperation(() => gcsFile.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype || 'application/octet-stream',
    metadata: { cacheControl },
  }));
}

function safeObjectPart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function objectTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, '');
}

function versionedObjectFileName(version, originalName, uploadedAt) {
  const extension = path.extname(originalName).toLowerCase() || '.bin';
  const originalBaseName = path.basename(originalName, path.extname(originalName));
  const namePart = safeObjectPart(originalBaseName) || 'documento';
  const versionPart = safeObjectPart(`v${version || '1.0'}`) || 'v1.0';
  return `${namePart}_${versionPart}_${objectTimestamp(uploadedAt)}${extension}`;
}

export const fileStorage = {
  bucketName,
  mode: storageMode,

  objectName(docId, version, originalName, uploadedAt = new Date()) {
    const idPart = safeObjectPart(docId);
    if (!idPart) throw storageError('El ID documental es obligatorio para guardar el archivo.');
    return `documents/${idPart}/${versionedObjectFileName(version, originalName, uploadedAt)}`;
  },

  infographicObjectName(docId, version, originalName, uploadedAt = new Date()) {
    const idPart = safeObjectPart(docId);
    if (!idPart) throw storageError('El ID documental es obligatorio para guardar la infografía.');
    return `documents/${idPart}/infographics/${versionedObjectFileName(version, originalName, uploadedAt)}`;
  },

  async save(docId, version, file) {
    const storedName = fileStorage.objectName(docId, version, file.originalname);
    await saveObject(storedName, file, 'private, max-age=0, no-transform');
    return storedName;
  },

  async saveInfographic(docId, version, file) {
    const storedName = fileStorage.infographicObjectName(
      docId,
      version,
      file.originalname,
    );
    await saveObject(storedName, file, 'private, max-age=300, no-transform');
    return storedName;
  },


  async remove(storedName) {
    if (!storedName) return;
    if (storageMode === 'local') {
      await fsPromises.rm(getLocalObjectPath(storedName), { force: true });
      return;
    }
    await runStorageOperation(() => getBucket().file(storedName).delete({ ignoreNotFound: true }));
  },

  async exists(storedName) {
    if (!storedName) return false;
    if (storageMode === 'local') {
      try {
        await fsPromises.access(getLocalObjectPath(storedName), fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
    const [exists] = await runStorageOperation(() => getBucket().file(storedName).exists());
    return exists;
  },

  stream(storedName) {
    if (storageMode === 'local') {
      return fs.createReadStream(getLocalObjectPath(storedName));
    }
    return getBucket().file(storedName).createReadStream();
  },
};
