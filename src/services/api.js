const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || `Error ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
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

  async incrementViews(id) {
    await request(`/documents/${id}/view`, { method: 'POST' });
  },

  async uploadDocument(payload, file) {
    const newDoc = await request('/documents', { method: 'POST', body: JSON.stringify(payload) });
    if (file) await api.uploadDocumentFile(newDoc.id, file);
    return newDoc;
  },

  async updateDocument(id, payload) {
    return request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async uploadDocumentFile(docId, file) {
    const form = new FormData();
    form.append('file', file);
    return request(`/documents/${docId}/file`, { method: 'POST', body: form });
  },

  async createDocumentVersion(docId, payload, file) {
    const form = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
    if (file) form.append('file', file);
    return request(`/documents/${docId}/versions`, { method: 'POST', body: form });
  },

  async getDocumentFileUrl(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}/file`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, name: res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'documento' };
  },

  async getDocumentVersionFileUrl(docId, versionId) {
    const res = await fetch(`${API_BASE}/documents/${docId}/versions/${versionId}/file`, {
      credentials: 'include',
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

  async getAssignableUsers() {
    return request('/assignees');
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

  async getReportSummary() {
    return request('/reports/summary');
  },
};

export default api;
