import { DATA } from '../data';
import { storage } from '../utils/storage';
import { KEYS } from '../utils/storage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const delay = (ms = 280) => new Promise(r => setTimeout(r, ms));

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

function applyFavorites(docs) {
  if (!USE_MOCK) return docs;
  const favs = storage.getFavorites();
  return docs.map(d => ({ ...d, fav: favs.includes(d.id) }));
}

let mockDocs = DATA.DOCS.map(d => ({ ...d }));
let mockWorkflow = DATA.WORKFLOW.map(w => ({ ...w }));

export const api = {
  config: { baseUrl: API_BASE, useMock: USE_MOCK },

  getToken,

  async login(email, password) {
    if (USE_MOCK) {
      await delay(400);
      const user = DATA.USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error('Correo no registrado en el sistema.');
      if (password.length < 4) throw new Error('Contraseña incorrecta.');
      if (user.status !== 'Activo') throw new Error('Usuario inactivo. Contacta al administrador.');
      const role = DATA.roleById(user.role);
      return { token: 'mock-jwt-' + Date.now(), user: { ...user, roleName: role.name }, provider: 'credentials' };
    }
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async loginWithMicrosoft() {
    if (USE_MOCK) {
      await delay(900);
      const user = DATA.USERS.find(u => u.id === 'u1');
      const role = DATA.roleById(user.role);
      return { token: 'mock-ms365-' + Date.now(), user: { ...user, roleName: role.name }, provider: 'microsoft' };
    }
    return request('/auth/microsoft', { method: 'POST' });
  },

  async getSession() {
    if (USE_MOCK) return null;
    return request('/auth/session');
  },

  async getDocuments() {
    if (USE_MOCK) {
      await delay();
      return applyFavorites(mockDocs.map(d => ({ ...d })));
    }
    return request('/documents');
  },

  async getDocument(id) {
    if (USE_MOCK) {
      await delay(150);
      const doc = mockDocs.find(d => d.id === id);
      if (!doc) throw new Error('Documento no encontrado');
      return { ...doc, fav: storage.isFavorite(id) };
    }
    return request(`/documents/${id}`);
  },

  async toggleFavorite(id) {
    if (USE_MOCK) {
      storage.toggleFavorite(id);
      mockDocs = mockDocs.map(d => d.id === id ? { ...d, fav: storage.isFavorite(id) } : d);
      return storage.isFavorite(id);
    }
    const result = await request(`/documents/${id}/favorite`, { method: 'POST' });
    return result.fav;
  },

  async incrementViews(id) {
    if (USE_MOCK) {
      mockDocs = mockDocs.map(d => d.id === id ? { ...d, views: d.views + 1 } : d);
      return;
    }
    await request(`/documents/${id}/view`, { method: 'POST' });
  },

  async uploadDocument(payload, file) {
    if (USE_MOCK) {
      await delay(600);
      const area = DATA.areaById(payload.area);
      const type = DATA.typeById(payload.type);
      const seq = String(mockDocs.filter(d => d.area === payload.area).length + 1).padStart(3, '0');
      const newDoc = {
        id: 'd' + (mockDocs.length + 1).toString().padStart(2, '0'),
        area: payload.area,
        type: payload.type,
        code: `${area.code}-${type.short}-${seq}`,
        name: payload.name,
        version: payload.version || '1.0',
        state: 'revision',
        created: new Date().toISOString().slice(0, 10),
        updated: new Date().toISOString().slice(0, 10),
        owner: payload.owner || 'paula',
        vigencia: payload.vigencia || '—',
        fav: false,
        views: 0,
        desc: payload.desc || '',
        tags: (payload.tags || '').split(',').map(t => t.trim()).filter(Boolean),
        history: [{ v: payload.version || '1.0', date: new Date().toISOString().slice(0, 10), by: payload.owner || 'paula', note: payload.versionNote || 'Versión inicial' }],
        related: [],
      };
      mockDocs = [newDoc, ...mockDocs];
      mockWorkflow = [{ id: 'w' + Date.now(), docId: newDoc.id, stage: 'revision', assignee: 'Revisor asignado', since: new Date().toISOString().slice(0, 10), priority: 'media' }, ...mockWorkflow];
      return newDoc;
    }
    const newDoc = await request('/documents', { method: 'POST', body: JSON.stringify(payload) });
    if (file) await api.uploadDocumentFile(newDoc.id, file);
    return newDoc;
  },

  async uploadDocumentFile(docId, file) {
    if (USE_MOCK) return null;
    const form = new FormData();
    form.append('file', file);
    return request(`/documents/${docId}/file`, { method: 'POST', body: form });
  },

  async getDocumentFileUrl(docId) {
    if (USE_MOCK) return null;
    const token = getToken();
    const res = await fetch(`${API_BASE}/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, name: res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'documento' };
  },

  async getDocumentFileMeta(docId) {
    if (USE_MOCK) return null;
    try {
      return await request(`/documents/${docId}/file/meta`);
    } catch {
      return null;
    }
  },

  async requestUpdate(docId, payload) {
    if (USE_MOCK) {
      await delay(400);
      return { ok: true, docId, ...payload };
    }
    return request(`/documents/${docId}/update-request`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async getAreas() {
    if (USE_MOCK) { await delay(100); return DATA.AREAS; }
    return request('/areas');
  },

  async getWorkflow() {
    if (USE_MOCK) {
      await delay();
      return mockWorkflow.map(w => ({ ...w, doc: mockDocs.find(d => d.id === w.docId) || DATA.docById(w.docId) }));
    }
    return request('/workflow');
  },

  async getUsers() {
    if (USE_MOCK) { await delay(100); return DATA.USERS; }
    return request('/users');
  },

  async getStats() {
    if (USE_MOCK) {
      await delay();
      const docs = applyFavorites(mockDocs);
      return {
        total: docs.length,
        vigentes: docs.filter(d => ['publicado', 'aprobado'].includes(d.state)).length,
        revision: docs.filter(d => d.state === 'revision').length,
        vencidos: docs.filter(d => d.state === 'vencido').length,
      };
    }
    return request('/stats');
  },
};

export default api;
