import { pool, query } from '../pool.js';
import { mapDocument, mapFile, today } from '../mapper.js';
import { logActivity } from './catalog.js';

async function getHistory(docId) {
  const { rows } = await query(
    'SELECT * FROM document_history WHERE doc_id = $1 ORDER BY id',
    [docId],
  );
  return rows;
}

async function getVersions(docId) {
  const { rows } = await query(
    'SELECT * FROM document_versions WHERE doc_id = $1 ORDER BY created_at DESC, id DESC',
    [docId],
  );
  return rows;
}

async function getActivity(docId) {
  const { rows } = await query(`
    SELECT al.*, COALESCE(u.name, p.name) AS who_name
    FROM activity_log al
    LEFT JOIN users u ON al.who_user_id = u.id
    LEFT JOIN people p ON al.who_person_id = p.id
    WHERE al.doc_id = $1
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 80
  `, [docId]);
  return rows;
}

async function getFavSet(userId) {
  const { rows } = await query(
    'SELECT doc_id FROM favorites WHERE user_id = $1',
    [userId],
  );
  return new Set(rows.map(r => r.doc_id));
}

function addDocumentScope(conditions, params, auth, alias = 'documents') {
  const role = Number(auth.role ?? auth.role_id);
  const userId = Number(auth.id);
  const areaId = (auth.area ?? auth.area_id) ? Number(auth.area ?? auth.area_id) : null;
  const col = (name) => `${alias}.${name}`;

  if (auth.perms?.administrar === true || role === 7) return;

  if (role === 2 || role === 3) {
    if (!areaId) {
      conditions.push('FALSE');
      return;
    }
    params.push(areaId);
    conditions.push(`${col('area_id')} = $${params.length}`);
    return;
  }

  if (role === 4) {
    params.push(userId);
    const userParam = params.length;
    if (areaId) {
      params.push(areaId);
      const areaParam = params.length;
      conditions.push(`(
        ${col('area_id')} = $${areaParam}
        OR EXISTS (
          SELECT 1 FROM workflow_items wi
          WHERE wi.doc_id = ${col('id')}
            AND (
              wi.assignee_user_id = $${userParam}
              OR wi.reviewed_by = $${userParam}
              OR wi.completed_by = $${userParam}
            )
        )
      )`);
    } else {
      conditions.push(`EXISTS (
        SELECT 1 FROM workflow_items wi
        WHERE wi.doc_id = ${col('id')}
          AND (
            wi.assignee_user_id = $${userParam}
            OR wi.reviewed_by = $${userParam}
            OR wi.completed_by = $${userParam}
          )
      )`);
    }
    return;
  }

  if (role === 5) {
    params.push(userId);
    const userParam = params.length;
    conditions.push(`EXISTS (
      SELECT 1 FROM workflow_items wi
      WHERE wi.doc_id = ${col('id')}
        AND (
          wi.assignee_user_id = $${userParam}
          OR wi.completed_by = $${userParam}
        )
    )`);
    return;
  }

  params.push('publicado');
  conditions.push(`${col('state')} = $${params.length}`);
}

function canCreateInArea(auth, areaId) {
  if (auth.perms?.administrar === true) return true;
  if (!auth.perms?.crear) return false;
  const authArea = auth.area ?? auth.area_id;
  if (!authArea) return false;
  return Number(authArea) === Number(areaId);
}

async function mapDocumentById(id, userId) {
  const { rows } = await query('SELECT * FROM documents WHERE id = $1', [Number(id)]);
  if (!rows[0]) return null;
  const history = await getHistory(rows[0].id);
  const versions = await getVersions(rows[0].id);
  const activity = await getActivity(rows[0].id);
  const { rows: favRows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [userId, rows[0].id],
  );
  return mapDocument(rows[0], history, favRows.length > 0, versions, activity);
}

export function assertCanCreateInArea(auth, areaId) {
  if (!canCreateInArea(auth, areaId)) {
    const err = new Error('No tienes permisos para crear documentos en esta area.');
    err.statusCode = 403;
    throw err;
  }
}

export async function listDocuments(auth, filters = {}) {
  const { area, type, state, search } = filters;
  const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 50));

  const conditions = [];
  const params = [];
  addDocumentScope(conditions, params, auth);

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

  const favs = await getFavSet(auth.id);
  const data = rows.map(row => mapDocument(row, histByDoc[row.id] || [], favs.has(row.id)));

  return { data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
}

export async function getDocument(id, auth) {
  const conditions = ['documents.id = $1'];
  const params = [Number(id)];
  addDocumentScope(conditions, params, auth);
  const { rows } = await query(`SELECT * FROM documents WHERE ${conditions.join(' AND ')}`, params);
  if (!rows[0]) return null;
  const history = await getHistory(rows[0].id);
  const versions = await getVersions(rows[0].id);
  const activity = await getActivity(rows[0].id);
  const { rows: favRows } = await query(
    'SELECT 1 FROM favorites WHERE user_id = $1 AND doc_id = $2',
    [auth.id, rows[0].id],
  );
  return mapDocument(rows[0], history, favRows.length > 0, versions, activity);
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

  await logActivity(payload.userId, `Creo el documento "${payload.name}"`, id, {
    eventType: 'document_created',
    details: {
      name: payload.name,
      area: Number(payload.area),
      type: Number(payload.type),
      owner: Number(payload.owner),
      version: payload.version || '1.0',
    },
  });
  return mapDocumentById(id, payload.userId);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

export async function updateDocument(doc, payload, auth) {
  assertCanEditInArea(auth, doc.area);
  const name = String(payload.name ?? doc.name ?? '').trim();
  const ownerId = Number(payload.owner ?? doc.owner);
  if (!name) {
    const err = new Error('El nombre del documento es obligatorio.');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    const err = new Error('El responsable del documento es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  const { rows: ownerRows } = await query('SELECT id FROM people WHERE id = $1', [ownerId]);
  if (!ownerRows[0]) {
    const err = new Error('Responsable invalido.');
    err.statusCode = 400;
    throw err;
  }

  const desc = String(payload.desc ?? payload.description ?? doc.desc ?? '').trim();
  const vigencia = String(payload.vigencia ?? doc.vigencia ?? '').trim();
  const tags = normalizeTags(payload.tags ?? doc.tags);
  const now = today();

  const { rows } = await query(`
    UPDATE documents
    SET name = $2,
        owner_id = $3,
        vigencia = NULLIF($4, ''),
        description = $5,
        tags = $6,
        updated = $7
    WHERE id = $1
    RETURNING id
  `, [
    doc.id,
    name,
    ownerId,
    vigencia,
    desc,
    JSON.stringify(tags),
    now,
  ]);

  if (!rows[0]) {
    const err = new Error('Documento no encontrado.');
    err.statusCode = 404;
    throw err;
  }

  await query(`
    INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
    VALUES ($1, $2, $3, NULL, $4)
  `, [
    doc.id,
    doc.version,
    now,
    payload.note || 'Metadatos del documento actualizados',
  ]);
  await logActivity(auth.id, 'Actualizo metadatos del documento', doc.id, {
    eventType: 'document_updated',
    details: {
      previous: {
        name: doc.name,
        owner: doc.owner,
        vigencia: doc.vigencia,
        desc: doc.desc,
        tags: doc.tags,
      },
      next: { name, owner: ownerId, vigencia, desc, tags },
    },
  });
  return mapDocumentById(doc.id, auth.id);
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
  await logActivity(userId, 'Solicito actualizacion del documento', Number(docId), {
    eventType: 'update_requested',
    details: { reason: reason || null, detail: detail || null },
  });
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

export async function getVersionFileMeta(docId, versionId) {
  const { rows } = await query(
    'SELECT * FROM document_versions WHERE doc_id = $1 AND id = $2',
    [Number(docId), Number(versionId)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.file_size ? Number(row.file_size) : null,
    note: row.note,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
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
  await logActivity(uploadedBy, 'Adjunto archivo al documento', Number(docId), {
    eventType: 'file_uploaded',
    details: {
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
  return getFileMeta(docId);
}

export function assertCanEditInArea(auth, areaId) {
  if (auth.perms?.administrar === true) return;
  if (!auth.perms?.editar) {
    const err = new Error('No tienes permisos para editar documentos.');
    err.statusCode = 403;
    throw err;
  }
  const authArea = auth.area ?? auth.area_id;
  if (!authArea || Number(authArea) !== Number(areaId)) {
    const err = new Error('No tienes permisos para editar documentos de esta area.');
    err.statusCode = 403;
    throw err;
  }
}

export async function createDocumentVersion(doc, payload, file, storedName, auth) {
  const now = today();
  const version = String(payload.version || '').trim();
  if (!version) {
    const err = new Error('La version es obligatoria.');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existingVersion } = await client.query(
      'SELECT 1 FROM document_versions WHERE doc_id = $1 AND version = $2',
      [doc.id, version],
    );
    if (existingVersion.length) {
      const err = new Error('Ya existe una version registrada con ese numero.');
      err.statusCode = 409;
      throw err;
    }

    await client.query(`
      INSERT INTO document_versions (
        doc_id, version, original_name, stored_name, mime_type, file_size, note, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      doc.id,
      version,
      file.originalname,
      storedName,
      file.mimetype || 'application/octet-stream',
      file.size,
      payload.note || null,
      auth.id,
    ]);

    await client.query(`
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
      doc.id,
      file.originalname,
      storedName,
      file.mimetype || 'application/octet-stream',
      file.size,
      auth.id,
    ]);

    await client.query(`
      UPDATE documents
      SET version = $2,
          state = 'borrador',
          updated = $3,
          vigencia = COALESCE(NULLIF($4, ''), vigencia),
          description = COALESCE(NULLIF($5, ''), description)
      WHERE id = $1
    `, [
      doc.id,
      version,
      now,
      payload.vigencia || '',
      payload.desc || '',
    ]);

    await client.query(`
      INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
      VALUES ($1, $2, $3, NULL, $4)
    `, [
      doc.id,
      version,
      now,
      payload.note || 'Nueva version documental creada',
    ]);

    const { rows: openWorkflow } = await client.query(
      'SELECT id FROM workflow_items WHERE doc_id = $1 AND completed_at IS NULL ORDER BY id DESC LIMIT 1',
      [doc.id],
    );
    if (openWorkflow[0]) {
      await client.query(`
        UPDATE workflow_items
        SET stage = 'creacion',
            assignee = $2,
            assignee_user_id = $3,
            since_date = $4,
            decision = 'new_version',
            comments = $5
        WHERE id = $1
      `, [openWorkflow[0].id, auth.name || auth.email, auth.id, now, payload.note || null]);
    } else {
      await client.query(`
        INSERT INTO workflow_items (doc_id, stage, assignee, assignee_user_id, since_date, priority, decision, comments)
        VALUES ($1, 'creacion', $2, $3, $4, 'media', 'new_version', $5)
      `, [doc.id, auth.name || auth.email, auth.id, now, payload.note || null]);
    }

    await client.query('COMMIT');
    await logActivity(auth.id, `Creo la version ${version} del documento`, doc.id, {
      eventType: 'version_created',
      details: {
        version,
        note: payload.note || null,
        originalName: file.originalname,
        storedName,
        size: file.size,
      },
    });
    return mapDocumentById(doc.id, auth.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function addWorkflowItem(docId, assignee, assigneeUserId = null, approverUserId = null) {
  await query(`
    INSERT INTO workflow_items (doc_id, stage, assignee, assignee_user_id, approver_user_id, since_date, priority)
    VALUES ($1, 'revision', $2, $3, $4, $5, 'media')
  `, [
    Number(docId),
    assignee,
    assigneeUserId ? Number(assigneeUserId) : null,
    approverUserId ? Number(approverUserId) : null,
    today(),
  ]);
}

export async function resolveRevisorName(revisorId) {
  const { rows: userRows } = await query('SELECT name FROM users WHERE id = $1', [Number(revisorId)]);
  if (userRows[0]) return userRows[0].name;
  const { rows: personRows } = await query('SELECT name FROM people WHERE id = $1', [Number(revisorId)]);
  return personRows[0]?.name || 'Revisor asignado';
}
