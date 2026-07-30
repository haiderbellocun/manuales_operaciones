import { query } from '../pool.js';

const OPERATION_ACADEMIC_FULL_ROLE_ID = 8;
const OPERATION_ACADEMIC_AREA_ID = 1;

export async function listAreas() {
  const { rows } = await query('SELECT * FROM areas ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    color: r.color,
    lead: r.lead_name,
    requiresCoordination: r.requires_coordination === true,
  }));
}

export async function listCoordinations(areaId = null) {
  const params = [];
  let where = '';
  if (areaId) {
    params.push(Number(areaId));
    where = `WHERE area_id = $${params.length}`;
  }
  const { rows } = await query(`
    SELECT * FROM coordinations
    ${where}
    ORDER BY sort_order, name
  `, params);
  return rows.map(r => ({
    id: r.id,
    areaId: r.area_id,
    name: r.name,
    abbreviation: r.abbreviation,
    sortOrder: r.sort_order,
  }));
}

export async function listTypes() {
  const { rows } = await query('SELECT * FROM document_types ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    icon: r.icon,
  }));
}

export async function listRoles() {
  const { rows } = await query('SELECT * FROM roles ORDER BY id');
  return rows.map(mapRole);
}

const PERMISSION_KEYS = ['crear', 'editar', 'aprobar', 'publicar', 'archivar', 'consultar', 'descargar', 'administrar'];

function mapRole(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    perms: row.perms,
  };
}

export async function updateRole(id, payload = {}) {
  const roleId = Number(id);
  const { rows: currentRows } = await query('SELECT * FROM roles WHERE id = $1', [roleId]);
  const current = currentRows[0];
  if (!current) {
    const err = new Error('Rol no encontrado.');
    err.statusCode = 404;
    throw err;
  }

  const name = String(payload.name ?? current.name).trim();
  const description = String(payload.desc ?? payload.description ?? current.description ?? '').trim();
  if (!name) {
    const err = new Error('El nombre del rol es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  const incomingPerms = payload.perms && typeof payload.perms === 'object' ? payload.perms : {};
  const nextPerms = {};
  for (const key of PERMISSION_KEYS) {
    nextPerms[key] = Boolean(incomingPerms[key]);
  }
  if (roleId === 1) {
    nextPerms.administrar = true;
    nextPerms.consultar = true;
  }

  const { rows } = await query(`
    UPDATE roles
    SET name = $2,
        description = $3,
        perms = $4
    WHERE id = $1
    RETURNING *
  `, [roleId, name, description, JSON.stringify(nextPerms)]);
  return mapRole(rows[0]);
}

export async function listPeople() {
  await query(`
    INSERT INTO people (name, role_title, area_id, coordination_id)
    SELECT u.name, r.name, u.area_id, u.coordination_id
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.status = 'Activo'
      AND NOT EXISTS (
        SELECT 1
        FROM people p
        WHERE LOWER(p.name) = LOWER(u.name)
      )
  `);
  await query(`
    UPDATE people p
    SET role_title = r.name,
        area_id = u.area_id,
        coordination_id = u.coordination_id
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE LOWER(p.name) = LOWER(u.name)
      AND u.status = 'Activo'
  `);

  const { rows } = await query('SELECT * FROM people ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    role: r.role_title,
    area: r.area_id,
    coordination: r.coordination_id,
  }));
}

function addDocumentScope(conditions, params, auth, alias = 'd') {
  if (!auth) return;
  const role = Number(auth.role ?? auth.role_id);
  const areaId = (auth.area ?? auth.area_id) ? Number(auth.area ?? auth.area_id) : null;
  const coordinationId = (auth.coordination ?? auth.coordination_id) ? Number(auth.coordination ?? auth.coordination_id) : null;
  const userId = Number(auth.id);
  const col = (name) => `${alias}.${name}`;

  if (auth.perms?.administrar === true || role === 7) return;
  if (role === 2 || role === 3 || role === OPERATION_ACADEMIC_FULL_ROLE_ID) {
    if (!areaId) {
      conditions.push('FALSE');
      return;
    }
    params.push(areaId);
    conditions.push(`${col('area_id')} = $${params.length}`);
    if (coordinationId && areaId !== OPERATION_ACADEMIC_AREA_ID) {
      params.push(coordinationId);
      conditions.push(`${col('coordination_id')} = $${params.length}`);
    }
    return;
  }
  if (role === 4) {
    params.push(userId);
    const userParam = params.length;
    if (areaId) {
      params.push(areaId);
      const areaParam = params.length;
      conditions.push(`(${col('area_id')} = $${areaParam} OR EXISTS (
        SELECT 1 FROM workflow_items wi
        WHERE wi.doc_id = ${col('id')}
          AND (wi.assignee_user_id = $${userParam} OR wi.reviewed_by = $${userParam} OR wi.completed_by = $${userParam})
      ))`);
    } else {
      conditions.push(`EXISTS (
        SELECT 1 FROM workflow_items wi
        WHERE wi.doc_id = ${col('id')}
          AND (wi.assignee_user_id = $${userParam} OR wi.reviewed_by = $${userParam} OR wi.completed_by = $${userParam})
      )`);
    }
    return;
  }
  if (role === 5) {
    params.push(userId);
    const userParam = params.length;
    if (areaId === OPERATION_ACADEMIC_AREA_ID) {
      params.push(areaId);
      const areaParam = params.length;
      conditions.push(`(
        ${col('area_id')} = $${areaParam}
        OR EXISTS (
          SELECT 1 FROM workflow_items wi
          WHERE wi.doc_id = ${col('id')}
            AND (wi.assignee_user_id = $${userParam} OR wi.completed_by = $${userParam})
        )
      )`);
    } else {
      conditions.push(`EXISTS (
        SELECT 1 FROM workflow_items wi
        WHERE wi.doc_id = ${col('id')}
          AND (wi.assignee_user_id = $${userParam} OR wi.completed_by = $${userParam})
      )`);
    }
    return;
  }
  params.push('publicado');
  conditions.push(`${col('state')} = $${params.length}`);
}

export async function listActivity(auth, limit = 30) {
  const conditions = [];
  const params = [];
  addDocumentScope(conditions, params, auth);
  params.push(limit);
  const limitParam = params.length;
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`
    SELECT al.*, COALESCE(u.name, p.name) AS who_name
    FROM activity_log al
    LEFT JOIN documents d ON d.id = al.doc_id
    LEFT JOIN users u ON al.who_user_id = u.id
    LEFT JOIN people p ON al.who_person_id = p.id
    ${where}
    ORDER BY al.id DESC
    LIMIT $${limitParam}
  `, params);
  return rows.map(r => ({
    id: r.id,
    who: r.who_user_id || r.who_person_id,
    whoName: r.who_name || 'Sistema',
    action: r.action,
    doc: r.doc_id,
    when: r.when_text,
    eventType: r.event_type || 'general',
    details: r.details || {},
    createdAt: r.created_at,
  }));
}

export async function logActivity(who, action, docId, options = {}) {
  const when = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  await query(
    `INSERT INTO activity_log (who_user_id, action, doc_id, when_text, event_type, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      who || null,
      action,
      docId || null,
      when,
      options.eventType || 'general',
      JSON.stringify(options.details || {}),
    ],
  );
}

export async function getStats(auth) {
  const conditions = [];
  const params = [];
  addDocumentScope(conditions, params, auth);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE state = 'publicado')::int AS vigentes,
      COUNT(*) FILTER (WHERE state = 'revision')::int AS revision,
      COUNT(*) FILTER (WHERE state = 'vencido')::int AS vencidos,
      COUNT(*) FILTER (WHERE state = 'borrador')::int AS borradores
    FROM documents d
    ${where}
  `, params);
  return rows[0];
}

export async function getMapDocumentCounts(auth) {
  const areaConditions = [];
  const areaParams = [];
  addDocumentScope(areaConditions, areaParams, auth, 'd');
  const areaJoinScope = areaConditions.length ? `AND ${areaConditions.join(' AND ')}` : '';

  const coordinationConditions = [];
  const coordinationParams = [];
  addDocumentScope(coordinationConditions, coordinationParams, auth, 'd');
  const coordinationJoinScope = coordinationConditions.length
    ? `AND ${coordinationConditions.join(' AND ')}`
    : '';

  const generalConditions = ['d.area_id = 1', 'd.coordination_id IS NULL'];
  const generalParams = [];
  addDocumentScope(generalConditions, generalParams, auth, 'd');

  const [areaRows, coordinationRows, operationGeneralRows] = await Promise.all([
    query(`
      SELECT a.id, COUNT(d.id)::int AS value
      FROM areas a
      LEFT JOIN documents d ON d.area_id = a.id ${areaJoinScope}
      GROUP BY a.id
      ORDER BY a.id
    `, areaParams),
    query(`
      SELECT c.id, COUNT(d.id)::int AS value
      FROM coordinations c
      LEFT JOIN documents d ON d.coordination_id = c.id ${coordinationJoinScope}
      WHERE c.area_id = 1
      GROUP BY c.id, c.sort_order
      ORDER BY c.sort_order, c.id
    `, coordinationParams),
    query(`
      SELECT COUNT(*)::int AS value
      FROM documents d
      WHERE ${generalConditions.join(' AND ')}
    `, generalParams),
  ]);

  return {
    byArea: areaRows.rows,
    byCoordination: coordinationRows.rows,
    operationGeneral: operationGeneralRows.rows[0]?.value || 0,
  };
}

export async function getReportSummary(auth) {
  const conditions = [];
  const params = [];
  addDocumentScope(conditions, params, auth);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [areaRows, stateRows, typeRows, topRows, avgRows] = await Promise.all([
    query(`
      SELECT a.id, a.abbreviation AS label, a.color, COUNT(d.id)::int AS value
      FROM areas a
      LEFT JOIN documents d ON d.area_id = a.id
      ${where ? where.replace('WHERE', 'AND') : ''}
      GROUP BY a.id, a.abbreviation, a.color
      HAVING COUNT(d.id) > 0
      ORDER BY a.id
    `, params),
    query(`
      SELECT d.state AS label, COUNT(*)::int AS value
      FROM documents d
      ${where}
      GROUP BY d.state
      ORDER BY d.state
    `, params),
    query(`
      SELECT dt.name AS label, COUNT(*)::int AS value
      FROM documents d
      JOIN document_types dt ON dt.id = d.type_id
      ${where}
      GROUP BY dt.id, dt.name
      ORDER BY value DESC, dt.name
    `, params),
    query(`
      SELECT d.id, d.document_number, d.name, d.views, d.area_id, d.type_id, d.state
      FROM documents d
      ${where}
      ORDER BY d.views DESC, d.id DESC
      LIMIT 6
    `, params),
    query(`
      SELECT COALESCE(AVG(version_count), 0)::numeric(10,1) AS average
      FROM (
        SELECT d.id, COUNT(h.id)::int AS version_count
        FROM documents d
        LEFT JOIN document_history h ON h.doc_id = d.id
        ${where}
        GROUP BY d.id
      ) s
    `, params),
  ]);

  return {
    byArea: areaRows.rows,
    byState: stateRows.rows,
    byType: typeRows.rows,
    topViews: topRows.rows.map(r => ({
      id: r.id,
      documentNumber: r.document_number,
      name: r.name,
      views: r.views,
      area: r.area_id,
      type: r.type_id,
      state: r.state,
    })),
    averageVersions: Number(avgRows.rows[0]?.average || 0),
  };
}

export async function getArea(id) {
  const n = Number(id);
  const { rows } = await query('SELECT * FROM areas WHERE id = $1', [n]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    color: r.color,
    lead: r.lead_name,
    requiresCoordination: r.requires_coordination === true,
  };
}

export async function getCoordination(id) {
  const n = Number(id);
  const { rows } = await query('SELECT * FROM coordinations WHERE id = $1', [n]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    areaId: r.area_id,
    name: r.name,
    abbreviation: r.abbreviation,
    sortOrder: r.sort_order,
  };
}

export async function getType(id) {
  const n = Number(id);
  const { rows } = await query('SELECT * FROM document_types WHERE id = $1', [n]);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, abbreviation: r.abbreviation, icon: r.icon };
}

export async function getPerson(id) {
  const { rows } = await query('SELECT * FROM people WHERE id = $1', [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    role: r.role_title,
    area: r.area_id,
    coordination: r.coordination_id,
  };
}
