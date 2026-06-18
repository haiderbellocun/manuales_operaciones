import { query } from '../pool.js';

export async function listAreas() {
  const { rows } = await query('SELECT * FROM areas ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    color: r.color,
    lead: r.lead_name,
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
  const { rows } = await query('SELECT * FROM roles ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    desc: r.description,
    perms: r.perms,
  }));
}

export async function listPeople() {
  const { rows } = await query('SELECT * FROM people ORDER BY name');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    role: r.role_title,
    area: r.area_id,
  }));
}

export async function listActivity(limit = 30) {
  const { rows } = await query(`
    SELECT al.*, COALESCE(u.name, p.name) AS who_name
    FROM activity_log al
    LEFT JOIN users u ON al.who_user_id = u.id
    LEFT JOIN people p ON al.who_person_id = p.id
    ORDER BY al.id DESC
    LIMIT $1
  `, [limit]);
  return rows.map(r => ({
    id: r.id,
    who: r.who_user_id || r.who_person_id,
    whoName: r.who_name || 'Sistema',
    action: r.action,
    doc: r.doc_id,
    when: r.when_text,
  }));
}

export async function logActivity(who, action, docId) {
  const when = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  await query(
    'INSERT INTO activity_log (who_user_id, action, doc_id, when_text) VALUES ($1, $2, $3, $4)',
    [who || null, action, docId || null, when],
  );
}

export async function getStats() {
  const { rows } = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE state IN ('publicado', 'aprobado'))::int AS vigentes,
      COUNT(*) FILTER (WHERE state = 'revision')::int AS revision,
      COUNT(*) FILTER (WHERE state = 'vencido')::int AS vencidos,
      COUNT(*) FILTER (WHERE state = 'borrador')::int AS borradores
    FROM documents
  `);
  return rows[0];
}

export async function getArea(id) {
  const n = Number(id);
  const { rows } = await query('SELECT * FROM areas WHERE id = $1', [n]);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, abbreviation: r.abbreviation, color: r.color, lead: r.lead_name };
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
  return { id: r.id, name: r.name, role: r.role_title, area: r.area_id };
}
