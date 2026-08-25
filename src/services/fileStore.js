import { api } from './api';

export async function getFile(docId) {
  const remote = await api.getDocumentFileUrl(docId, { preview: true });
  if (!remote?.blob) return null;
  const meta = await api.getDocumentFileMeta(docId);
  return {
    docId,
    name: meta?.originalName || remote.name || 'documento',
    type: remote.blob.type || meta?.mimeType || 'application/octet-stream',
    size: remote.blob.size || meta?.size || 0,
    blob: remote.blob,
    source: 'cloud-storage',
  };
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
