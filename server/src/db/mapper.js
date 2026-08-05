function fmtDate(d) {
  if (!d) return '—';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function mapDocument(
  row,
  history = [],
  fav = false,
  versions = [],
  activity = [],
  infographic = null,
) {
  return {
    id: row.id,
    area: row.area_id,
    coordination: row.coordination_id || undefined,
    type: row.type_id,
    documentNumber: row.document_number,
    name: row.name,
    version: row.version,
    state: row.state,
    owner: row.owner_id,
    vigencia: row.vigencia || '—',
    views: row.views,
    downloads: row.downloads || 0,
    lastViewedAt: row.last_viewed_at || null,
    lastDownloadedAt: row.last_downloaded_at || null,
    desc: row.description || '',
    tags: row.tags || [],
    related: row.related || [],
    ans: row.ans_ref || undefined,
    cargo: row.cargo_ref || undefined,
    app: row.app_ref || undefined,
    created: fmtDate(row.created),
    updated: fmtDate(row.updated),
    publishedAt: row.published_at || null,
    infographic: infographic ? {
      available: true,
      originalName: infographic.original_name,
      mimeType: infographic.mime_type,
      size: Number(infographic.file_size),
      documentVersion: infographic.document_version || row.version,
      uploadedAt: infographic.uploaded_at,
      uploadedBy: infographic.uploaded_by,
    } : { available: false },
    fav,
    history: history.map(h => ({
      v: h.version,
      date: fmtDate(h.history_date),
      by: h.by_person_id,
      note: h.note,
    })),
    versions: versions.map(v => ({
      id: v.id,
      version: v.version,
      originalName: v.original_name,
      storedName: v.stored_name,
      mimeType: v.mime_type,
      size: v.file_size ? Number(v.file_size) : null,
      note: v.note,
      createdAt: v.created_at,
      createdBy: v.created_by,
    })),
    activity: activity.map(a => ({
      id: a.id,
      action: a.action,
      eventType: a.event_type || 'general',
      details: a.details || {},
      who: a.who_user_id || a.who_person_id,
      whoName: a.who_name || 'Sistema',
      date: fmtDate(a.created_at),
      createdAt: a.created_at,
    })),
  };
}

export function mapUser(row, roleName, perms = {}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    picture: row.profile_picture_url || null,
    role: row.role_id,
    area: row.area_id,
    coordination: row.coordination_id || undefined,
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
