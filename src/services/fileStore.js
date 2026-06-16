/* Almacén local (IndexedDB) + servidor API para archivos */

import { api } from './api';

const memory = new Map();
const DB_NAME = 'acervo_files';
const STORE = 'documents';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(docId, file) {
  const record = {
    docId,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    savedAt: Date.now(),
    source: 'local',
  };
  memory.set(docId, record);

  if (!api.config.useMock) {
    try {
      await api.uploadDocumentFile(docId, file);
      record.source = 'server';
    } catch (e) {
      console.warn('No se pudo subir al servidor, guardado localmente:', e.message);
    }
  }

  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record, docId);
  } catch { /* IndexedDB unavailable */ }

  return record;
}

export async function getFile(docId) {
  if (memory.has(docId)) return memory.get(docId);

  if (!api.config.useMock) {
    try {
      const remote = await api.getDocumentFileUrl(docId);
      if (remote?.blob) {
        const meta = await api.getDocumentFileMeta(docId);
        const record = {
          docId,
          name: meta?.originalName || remote.name || 'documento',
          type: remote.blob.type || meta?.mimeType || 'application/octet-stream',
          size: remote.blob.size || meta?.size || 0,
          blob: remote.blob,
          savedAt: Date.now(),
          source: 'server',
        };
        memory.set(docId, record);
        return record;
      }
    } catch { /* fallback to local */ }
  }

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(docId);
      req.onsuccess = () => {
        if (req.result) memory.set(docId, req.result);
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function getFileUrl(record) {
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export function revokeFileUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.doc,.xlsx';
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function validateFile(file) {
  if (!file) return 'Selecciona un archivo.';
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowed = ['pdf', 'docx', 'doc', 'xlsx'];
  if (!allowed.includes(ext)) return 'Formato no permitido. Usa PDF, DOCX o XLSX.';
  if (file.size > MAX_FILE_SIZE) return 'El archivo supera el límite de 25 MB.';
  return null;
}
