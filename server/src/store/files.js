import path from 'path';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import '../config/env.js';

const bucketName = process.env.GCS_BUCKET;
const storage = new Storage();

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

function safeObjectPart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const fileStorage = {
  bucketName,

  objectName(docId, documentNumber, version, originalName) {
    const ext = path.extname(originalName) || '.bin';
    const idPart = safeObjectPart(docId);
    const numberPart = safeObjectPart(documentNumber);
    const versionPart = safeObjectPart(`v${version || '1.0'}`);
    return `documents/${idPart}-${numberPart}-${versionPart}${ext}`;
  },

  async save(docId, documentNumber, version, file) {
    const storedName = fileStorage.objectName(docId, documentNumber, version, file.originalname);
    const gcsFile = getBucket().file(storedName);
    await runStorageOperation(() => gcsFile.save(file.buffer, {
      resumable: false,
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        cacheControl: 'private, max-age=0, no-transform',
      },
    }));
    return storedName;
  },

  async savePending(version, file) {
    return fileStorage.save(
      `pending-${crypto.randomUUID()}`,
      'documento',
      version,
      file,
    );
  },

  async remove(storedName) {
    if (!storedName) return;
    await runStorageOperation(() => getBucket().file(storedName).delete({ ignoreNotFound: true }));
  },

  async exists(storedName) {
    if (!storedName) return false;
    const [exists] = await runStorageOperation(() => getBucket().file(storedName).exists());
    return exists;
  },

  stream(storedName) {
    return getBucket().file(storedName).createReadStream();
  },
};
