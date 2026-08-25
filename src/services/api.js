import { getUserErrorMessage } from '../utils/errors';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function responseError(res, path, fallback) {
  const payload = await res.clone().json().catch(async () => {
    const message = await res.text().catch(() => '');
    return message ? { message } : {};
  });
  const rawMessage = payload.message || `Error ${res.status}`;
  const error = new Error(rawMessage);
  error.status = res.status;
  error.code = payload.code;
  error.payload = payload;
  error.path = path;
  error.rawMessage = rawMessage;
  error.message = getUserErrorMessage(error, fallback);
  return error;
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    throw await responseError(res, path);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

function responseFileName(res, fallback = 'documento') {
  const disposition = res.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    || disposition.match(/filename="([^"]+)"/i)?.[1];
  if (!encoded) return fallback;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export const api = {
  config: { baseUrl: API_BASE },

  async loginWithGoogle(credential) {
    return request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
  },

  async getSession() {
    return request('/auth/session');
  },

  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  async getDocuments(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
    ).toString();
    const result = await request(`/documents${qs ? '?' + qs : ''}`);
    return result.data ?? result;
  },

  async getDocument(id) {
    return request(`/documents/${id}`);
  },

  async toggleFavorite(id) {
    const result = await request(`/documents/${id}/favorite`, { method: 'POST' });
    return result.fav;
  },

  async incrementViews(id, source = 'document_detail') {
    return request(`/documents/${id}/view`, {
      method: 'POST',
      body: JSON.stringify({ source }),
    });
  },

  async uploadDocument(payload, file, infographic) {
    if (!file) throw new Error('El archivo del documento es obligatorio.');
    if (!infographic) throw new Error('La infografia del documento es obligatoria.');
    const form = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
    form.append('file', file);
    form.append('infographic', infographic);
    return request('/documents', { method: 'POST', body: form });
  },

  async updateDocument(id, payload) {
    return request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async uploadDocumentFile(docId, file) {
    const form = new FormData();
    form.append('file', file);
    return request(`/documents/${docId}/file`, { method: 'POST', body: form });
  },

  async createDocumentVersion(docId, payload, file, infographic = null) {
    const form = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
    if (file) form.append('file', file);
    if (infographic) form.append('infographic', infographic);
    return request(`/documents/${docId}/versions`, { method: 'POST', body: form });
  },

  async getDocumentFileUrl(docId, { preview = false } = {}) {
    const path = `/documents/${docId}/file${preview ? '?mode=preview' : ''}`;
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
    });
    if (!res.ok) throw await responseError(res, path, 'No se pudo cargar el archivo del documento.');
    const blob = await res.blob();
    return {
      blob,
      name: responseFileName(res),
      downloads: Number(res.headers.get('x-document-downloads')) || null,
      lastDownloadedAt: res.headers.get('x-last-downloaded-at') || null,
    };
  },

  async getDocumentVersionFileUrl(docId, versionId) {
    const path = `/documents/${docId}/versions/${versionId}/file`;
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
    });
    if (!res.ok) throw await responseError(res, path, 'No se pudo descargar la versión seleccionada.');
    const blob = await res.blob();
    return {
      blob,
      name: responseFileName(res),
      downloads: Number(res.headers.get('x-document-downloads')) || null,
      lastDownloadedAt: res.headers.get('x-last-downloaded-at') || null,
    };
  },

  async getDocumentFileMeta(docId) {
    return request(`/documents/${docId}/file/meta`);
  },

  async requestUpdate(docId, payload) {
    return request(`/documents/${docId}/update-request`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async getAreas() {
    return request('/areas');
  },

  async getCoordinations(areaId) {
    const qs = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
    return request(`/coordinations${qs}`);
  },

  async getTypes() {
    return request('/types');
  },

  async getRoles() {
    return request('/roles');
  },

  async updateRole(id, payload) {
    return request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async getPeople() {
    return request('/people');
  },

  async getWorkflow() {
    return request('/workflow');
  },

  async transitionWorkflow(id, action, comments = '') {
    return request(`/workflow/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, comments }),
    });
  },

  async getUsers() {
    return request('/users');
  },

  async createUser(payload) {
    return request('/users', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateUser(id, payload) {
    return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async getAssignableUsers(areaId = null) {
    const query = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
    return request(`/assignees${query}`);
  },

  async uploadDocumentInfographic(docId, infographic) {
    if (!infographic) throw new Error('Selecciona una infografia.');
    const form = new FormData();
    form.append('infographic', infographic);
    return request(`/documents/${docId}/infographic`, { method: 'POST', body: form });
  },

  async getDocumentInfographic(docId) {
    const path = `/documents/${docId}/infographic`;
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await responseError(res, path, 'No se pudo cargar la infografía del documento.');
    return {
      blob: await res.blob(),
      name: res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'infografia',
      type: res.headers.get('content-type') || 'image/png',
    };
  },

  async getDocumentInfographicMeta(docId) {
    return request(`/documents/${docId}/infographic/meta`);
  },

  async getActivity() {
    return request('/activity');
  },

  async getAnsModules() {
    return request('/modules/ans');
  },

  async getAnsModule(id) {
    return request(`/modules/ans/${id}`);
  },

  async getCargoModules() {
    return request('/modules/cargos');
  },

  async getCargoModule(id) {
    return request(`/modules/cargos/${id}`);
  },

  async getAppModules() {
    return request('/modules/apps');
  },

  async getAppModule(id) {
    return request(`/modules/apps/${id}`);
  },

  async getNotifications() {
    return request('/notifications');
  },

  async markNotificationRead(id) {
    return request(`/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' });
  },

  async getStats() {
    return request('/stats');
  },

  async getMapDocumentCounts() {
    return request('/map/counts');
  },

  async getReportSummary() {
    return request('/reports/summary');
  },

  async getDocumentAnalytics(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([key, value]) => (
        value !== undefined
        && value !== null
        && value !== ''
        && (key === 'period' || value !== 'all')
      ))),
    ).toString();
    return request(`/reports/analytics${qs ? `?${qs}` : ''}`);
  },
};

export default api;
