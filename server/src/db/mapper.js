function fmtDate(d) {
  if (!d) return '—';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function mapDocument(row, history = [], fav = false) {
  return {
    id: row.id,
    area: row.area_id,
    type: row.type_id,
    documentNumber: row.document_number,
    name: row.name,
    version: row.version,
    state: row.state,
    owner: row.owner_id,
    vigencia: row.vigencia || '—',
    views: row.views,
    desc: row.description || '',
    tags: row.tags || [],
    related: row.related || [],
    ans: row.ans_ref || undefined,
    cargo: row.cargo_ref || undefined,
    app: row.app_ref || undefined,
    created: fmtDate(row.created),
    updated: fmtDate(row.updated),
    fav,
    history: history.map(h => ({
      v: h.version,
      date: fmtDate(h.history_date),
      by: h.by_person_id,
      note: h.note,
    })),
  };
}

export function mapUser(row, roleName, perms = {}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role_id,
    area: row.area_id,
    status: row.status,
    last: fmtDate(row.last_access),
    roleName,
    perms,
  };
}

export function mapFile(row) {
  if (!row) return null;
  return {
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: Number(row.file_size),
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
  };
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
