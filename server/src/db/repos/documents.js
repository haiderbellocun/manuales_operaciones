import { query } from '../pool.js';
import { mapDocument, mapFile, today } from '../mapper.js';
import { logActivity } from './catalog.js';

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

export async function listDocuments(userId, filters = {}) {
  const { area, type, state, search } = filters;
  const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 50));

  const conditions = [];
  const params = [];

  if (area) {
    const n = Number(area);
    params.push(n);
    conditions.push(`area_id = $${params.length}`);
  }
  if (type) {
    const n = Number(type);
    params.push(n);
    conditions.push(`type_id = $${params.length}`);
  }
  if (state) { params.push(state); conditions.push(`state = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    conditions.push(`(name ILIKE $${n} OR document_number ILIKE $${n})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM documents ${where}`,
    params,
  );
  const total = countRows[0].total;

  const offset = (pageNum - 1) * limitNum;
  const dataParams = [...params, limitNum, offset];
  const { rows } = await query(
    `SELECT * FROM documents ${where} ORDER BY created DESC, id
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams,
  );

  if (rows.length === 0) {
    return { data: [], total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 0 };
  }

  const docIds = rows.map(r => r.id);
  const { rows: histRows } = await query(
    'SELECT * FROM document_history WHERE doc_id = ANY($1::int[]) ORDER BY id',
    [docIds],
  );
  const histByDoc = {};
  for (const h of histRows) {
    if (!histByDoc[h.doc_id]) histByDoc[h.doc_id] = [];
    histByDoc[h.doc_id].push(h);
  }

  const favs = await getFavSet(userId);
  const data = rows.map(row => mapDocument(row, histByDoc[row.id] || [], favs.has(row.id)));

  return { data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
}

export async function getDocument(id, userId) {
  const { rows } = await query('SELECT * FROM documents WHERE id = $1', [Number(id)]);
  if (!rows[0]) return null;
  const history = await getHistory(rows[0].id);
  const { rows: favRows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [userId, rows[0].id],
  );
  return mapDocument(rows[0], history, favRows.length > 0);
}

export async function createDocument(payload, areaObj, typeObj) {
  const { rows: countRows } = await query(
    'SELECT COUNT(*)::int AS n FROM documents WHERE area_id = $1',
    [Number(payload.area)],
  );
  const seq = String(countRows[0].n + 1).padStart(3, '0');
  const now = today();

  const { rows } = await query(`
    INSERT INTO documents (
      area_id, type_id, document_number, name, version, state, owner_id,
      vigencia, views, description, tags, related, created, updated
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,$12)
    RETURNING id
  `, [
    Number(payload.area),
    Number(payload.type),
    `${areaObj.abbreviation}-${typeObj.abbreviation}-${seq}`,
    payload.name,
    payload.version || '1.0',
    'revision',
    Number(payload.owner),
    payload.vigencia || '-',
    payload.desc || '',
    JSON.stringify(typeof payload.tags === 'string'
      ? payload.tags.split(',').map(t => t.trim()).filter(Boolean)
      : (payload.tags || [])),
    JSON.stringify([]),
    now,
  ]);
  const id = rows[0].id;

  await query(`
    INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    id,
    payload.version || '1.0',
    now,
    Number(payload.owner),
    payload.versionNote || 'Version inicial',
  ]);

  await logActivity(payload.userId, `Creo el documento "${payload.name}"`, id);
  return getDocument(id, payload.userId);
}

export async function toggleFavorite(userId, docId) {
  const numericDocIdValue = Number(docId);
  const { rows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [userId, numericDocIdValue],
  );
  if (rows.length > 0) {
    await query('DELETE FROM favorites WHERE user_id = $1 AND doc_id = $2', [userId, numericDocIdValue]);
    return { fav: false };
  }
  await query('INSERT INTO favorites (user_id, doc_id) VALUES ($1, $2)', [userId, numericDocIdValue]);
  return { fav: true };
}

export async function incrementViews(docId) {
  const { rows } = await query(
    'UPDATE documents SET views = views + 1 WHERE id = $1 RETURNING views',
    [Number(docId)],
  );
  return rows[0]?.views ?? 0;
}

export async function createUpdateRequest(docId, userId, reason, detail) {
  const { rows } = await query(`
    INSERT INTO update_requests (doc_id, user_id, reason, detail)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at
  `, [Number(docId), userId, reason, detail]);
  await logActivity(userId, 'Solicito actualizacion del documento', Number(docId));
  return {
    ok: true,
    id: rows[0].id,
    docId: Number(docId),
    userId,
    reason,
    detail,
    createdAt: rows[0].created_at,
  };
}

export async function getFileMeta(docId) {
  const { rows } = await query('SELECT * FROM document_files WHERE doc_id = $1', [Number(docId)]);
  return mapFile(rows[0]);
}

export async function upsertFile(docId, file, uploadedBy, storedName) {
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
    Number(docId),
    file.originalname,
    storedName,
    file.mimetype,
    file.size,
    uploadedBy,
  ]);
  await logActivity(uploadedBy, 'Adjunto archivo al documento', Number(docId));
  return getFileMeta(docId);
}

export async function addWorkflowItem(docId, assignee) {
  await query(`
    INSERT INTO workflow_items (doc_id, stage, assignee, since_date, priority)
    VALUES ($1, 'revision', $2, $3, 'media')
  `, [Number(docId), assignee, today()]);
}

export async function resolveRevisorName(revisorId) {
  const { rows: userRows } = await query('SELECT name FROM users WHERE id = $1', [Number(revisorId)]);
  if (userRows[0]) return userRows[0].name;
  const { rows: personRows } = await query('SELECT name FROM people WHERE id = $1', [Number(revisorId)]);
  return personRows[0]?.name || 'Revisor asignado';
}
