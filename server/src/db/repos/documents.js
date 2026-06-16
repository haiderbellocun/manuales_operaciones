import { query } from '../pool.js';
import { mapDocument, mapFile, today } from '../mapper.js';

async function getHistory(docId) {
  const { rows } = await query(
    'SELECT * FROM document_history WHERE doc_id = $1 ORDER BY id',
    [docId],
  );
  return rows;
}

async function getFavSet(userId) {
  const { rows } = await query(
    'SELECT doc_id FROM favorites WHERE user_id = $1',
    [userId],
  );
  return new Set(rows.map(r => r.doc_id));
}

export async function listDocuments(userId) {
  const favs = await getFavSet(userId);
  const { rows } = await query('SELECT * FROM documents ORDER BY created DESC, id');
  const docs = await Promise.all(rows.map(async (row) => {
    const history = await getHistory(row.id);
    return mapDocument(row, history, favs.has(row.id));
  }));
  return docs;
}

export async function getDocument(id, userId) {
  const { rows } = await query('SELECT * FROM documents WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const history = await getHistory(id);
  const { rows: favRows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [userId, id],
  );
  return mapDocument(rows[0], history, favRows.length > 0);
}

export async function nextDocId() {
  const { rows } = await query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INT)), 0) + 1 AS n FROM documents
  `);
  return `d${String(rows[0].n).padStart(2, '0')}`;
}

export async function createDocument(payload, areaObj, typeObj) {
  const { rows: countRows } = await query(
    'SELECT COUNT(*)::int AS n FROM documents WHERE area_id = $1',
    [payload.area],
  );
  const seq = String(countRows[0].n + 1).padStart(3, '0');
  const id = await nextDocId();
  const now = today();

  await query(`
    INSERT INTO documents (
      id, area_id, type_id, code, name, version, state, owner_id,
      vigencia, views, description, tags, related, created, updated
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$13)
  `, [
    id,
    payload.area,
    payload.type,
    `${areaObj.code}-${typeObj.short}-${seq}`,
    payload.name,
    payload.version || '1.0',
    'revision',
    payload.owner || 'paula',
    payload.vigencia || '—',
    payload.desc || '',
    JSON.stringify(typeof payload.tags === 'string'
      ? payload.tags.split(',').map(t => t.trim()).filter(Boolean)
      : (payload.tags || [])),
    JSON.stringify([]),
    now,
  ]);

  await query(`
    INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    id,
    payload.version || '1.0',
    now,
    payload.owner || 'paula',
    payload.versionNote || 'Versión inicial',
  ]);

  return getDocument(id, payload.userId);
}

export async function toggleFavorite(userId, docId) {
  const { rows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [userId, docId],
  );
  if (rows.length > 0) {
    await query('DELETE FROM favorites WHERE user_id = $1 AND doc_id = $2', [userId, docId]);
    return { fav: false };
  }
  await query('INSERT INTO favorites (user_id, doc_id) VALUES ($1, $2)', [userId, docId]);
  return { fav: true };
}

export async function incrementViews(docId) {
  const { rows } = await query(
    'UPDATE documents SET views = views + 1 WHERE id = $1 RETURNING views',
    [docId],
  );
  return rows[0]?.views ?? 0;
}

export async function createUpdateRequest(docId, userId, reason, detail) {
  const id = `ur${Date.now()}`;
  await query(`
    INSERT INTO update_requests (id, doc_id, user_id, reason, detail)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, docId, userId, reason, detail]);
  return {
    ok: true,
    id,
    docId,
    userId,
    reason,
    detail,
    createdAt: new Date().toISOString(),
  };
}

export async function getFileMeta(docId) {
  const { rows } = await query('SELECT * FROM document_files WHERE doc_id = $1', [docId]);
  return mapFile(rows[0]);
}

export async function upsertFile(docId, file, uploadedBy) {
  await query(`
    INSERT INTO document_files (doc_id, original_name, stored_name, mime_type, file_size, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (doc_id) DO UPDATE SET
      original_name = EXCLUDED.original_name,
      stored_name = EXCLUDED.stored_name,
      mime_type = EXCLUDED.mime_type,
      file_size = EXCLUDED.file_size,
      uploaded_at = NOW(),
      uploaded_by = EXCLUDED.uploaded_by
  `, [
    docId,
    file.originalname,
    file.filename,
    file.mimetype,
    file.size,
    uploadedBy,
  ]);
  return getFileMeta(docId);
}

export async function addWorkflowItem(docId, assignee) {
  const id = `w${Date.now()}`;
  await query(`
    INSERT INTO workflow_items (id, doc_id, stage, assignee, since_date, priority)
    VALUES ($1, $2, 'revision', $3, $4, 'media')
  `, [id, docId, assignee, today()]);
}

export async function resolveRevisorName(revisorId) {
  const { rows: userRows } = await query('SELECT name FROM users WHERE id = $1', [revisorId]);
  if (userRows[0]) return userRows[0].name;
  const { rows: personRows } = await query('SELECT name FROM people WHERE id = $1', [revisorId]);
  return personRows[0]?.name || 'Revisor asignado';
}
