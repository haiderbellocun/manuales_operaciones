const TECHNICAL_ERROR_PATTERNS = [
  /too many files/i,
  /unexpected field/i,
  /failed to fetch/i,
  /network\s*error/i,
  /service unavailable/i,
  /load failed/i,
  /econn(?:refused|reset)/i,
  /enotfound/i,
  /socket hang up/i,
  /^error\s+\d+$/i,
];

const SPANISH_USER_MESSAGE_PATTERN = /\b(?:archivo|documento|infograf[ií]a|usuario|rol|permisos?|versi[oó]n|[aá]rea|coordinaci[oó]n|formato|selecciona|adjunta|obligatori[oa]|estado|flujo|correo|nombre|vigencia|sesi[oó]n|solicitud|notificaci[oó]n|publicar|publicado|revisi[oó]n|aprobado|descarga|consulta|responsable|vigente|borrador)\b/i;

function rawErrorMessage(error) {
  return String(
    error?.payload?.message
      || error?.rawMessage
      || error?.message
      || '',
  ).trim();
}

function isFileRequest(error) {
  return /\/(?:file|infographic|versions)(?:\/|\?|$)/i.test(String(error?.path || ''));
}

export function getUserErrorMessage(error, fallback = 'No se pudo completar la acción.') {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || error?.payload?.code || '').toUpperCase();
  const raw = rawErrorMessage(error);

  if (code === 'LIMIT_FILE_COUNT' || /too many files/i.test(raw)) {
    return 'Solo puedes adjuntar un archivo documental y una infografía. Retira cualquier archivo adicional e inténtalo de nuevo.';
  }
  if (code === 'LIMIT_UNEXPECTED_FILE' || /unexpected field/i.test(raw)) {
    return 'Se recibió un archivo adicional o un tipo de carga no permitido. Adjunta únicamente el documento y la infografía.';
  }
  if (code === 'LIMIT_FILE_SIZE') {
    return 'Uno de los archivos supera el tamaño permitido: 25 MB para el documento y 10 MB para la infografía.';
  }
  if (code === 'STORAGE_UNAVAILABLE' || (status === 503 && isFileRequest(error))) {
    return 'El almacenamiento de archivos no está disponible en este momento. Inténtalo nuevamente o comunícate con el administrador.';
  }
  if (/failed to fetch|network\s*error|load failed|econn(?:refused|reset)|enotfound/i.test(raw)) {
    return 'No fue posible conectar con el servidor. Verifica que el backend esté en ejecución e inténtalo nuevamente.';
  }
  if (status === 401) return 'Tu sesión venció o ya no es válida. Inicia sesión nuevamente.';
  if (status === 403 && (!raw || TECHNICAL_ERROR_PATTERNS.some(pattern => pattern.test(raw)))) {
    return 'No tienes permisos para realizar esta acción.';
  }
  if (status === 404 && !raw) return 'No se encontró el recurso solicitado.';
  if (status === 409 && !raw) return 'La acción no puede realizarse en el estado actual del documento.';
  if (status === 413) return 'El archivo enviado supera el tamaño máximo permitido.';
  if (status === 429) return 'Se realizaron demasiadas solicitudes. Espera un momento e inténtalo nuevamente.';
  if (status === 503) return 'El servicio no está disponible en este momento. Inténtalo nuevamente o comunícate con el administrador.';
  if (status >= 500) return 'Ocurrió un error interno y la acción no pudo completarse. Inténtalo nuevamente.';

  if (
    raw
    && SPANISH_USER_MESSAGE_PATTERN.test(raw)
    && !TECHNICAL_ERROR_PATTERNS.some(pattern => pattern.test(raw))
  ) return raw;
  return fallback;
}

export function getErrorToastType(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  return [400, 403, 409, 413, 422].includes(status) ? 'warning' : 'error';
}
