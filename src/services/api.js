import { KEYS } from '../utils/storage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  try {
    const raw = localStorage.getItem(KEYS.session);
    if (!raw) return null;
    return JSON.parse(raw).token || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

export const api = {
  config: { baseUrl: API_BASE },

  getToken,

  async login(email, password) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async loginWithMicrosoft() {
    return request('/auth/microsoft', { method: 'POST' });
  },

  async getSession() {
    return request('/auth/session');
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

  async incrementViews(id) {
    await request(`/documents/${id}/view`, { method: 'POST' });
  },

  async uploadDocument(payload, file) {
    const newDoc = await request('/documents', { method: 'POST', body: JSON.stringify(payload) });
    if (file) await api.uploadDocumentFile(newDoc.id, file);
    return newDoc;
  },

  async uploadDocumentFile(docId, file) {
    const form = new FormData();
    form.append('file', file);
    return request(`/documents/${docId}/file`, { method: 'POST', body: form });
  },

  async getDocumentFileUrl(docId) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, name: res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'documento' };
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

  async getTypes() {
    return request('/types');
  },

  async getRoles() {
    return request('/roles');
  },

  async getPeople() {
    return request('/people');
  },

  async getWorkflow() {
    return request('/workflow');
  },

  async getUsers() {
    return request('/users');
  },

  async getAssignableUsers() {
    return request('/assignees');
  },

  async getActivity() {
    return request('/activity');
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
};

export default api;
