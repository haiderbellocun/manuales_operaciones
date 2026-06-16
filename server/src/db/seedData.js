import { DATA } from '../../../src/data.js';
import { query } from './pool.js';

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    activity_log, update_requests, document_files, favorites,
    workflow_items, document_history, documents,
    users, people, roles, document_types, areas
  RESTART IDENTITY CASCADE
`;

export async function isEmpty() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM documents');
  return rows[0].n === 0;
}

export async function seedDatabase({ force = false } = {}) {
  if (!force && !(await isEmpty())) {
    return { seeded: false, reason: 'already_has_data' };
  }

  await query(TRUNCATE_SQL);

  for (const a of DATA.AREAS) {
    await query(
      'INSERT INTO areas (id, name, code, color, lead_name) VALUES ($1,$2,$3,$4,$5)',
      [a.id, a.name, a.code, a.color, a.lead],
    );
  }

  for (const t of DATA.TYPES) {
    await query(
      'INSERT INTO document_types (id, name, short, icon) VALUES ($1,$2,$3,$4)',
      [t.id, t.name, t.short, t.icon],
    );
  }

  for (const r of DATA.ROLES) {
    await query(
      'INSERT INTO roles (id, name, description, perms) VALUES ($1,$2,$3,$4)',
      [r.id, r.name, r.desc, JSON.stringify(r.perms)],
    );
  }

  for (const [id, p] of Object.entries(DATA.PEOPLE)) {
    await query(
      'INSERT INTO people (id, name, role_title, area_id) VALUES ($1,$2,$3,$4)',
      [id, p.name, p.role, p.area || null],
    );
  }

  for (const u of DATA.USERS) {
    const password = u.id === 'u1' ? 'admin1234' : 'demo1234';
    await query(
      'INSERT INTO users (id, name, email, password, role_id, area_id, status, last_access) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [u.id, u.name, u.email, password, u.role, u.area, u.status, u.last || null],
    );
  }

  for (const d of DATA.DOCS) {
    await query(`
      INSERT INTO documents (
        id, area_id, type_id, code, name, version, state, owner_id,
        vigencia, views, description, tags, related, ans_ref, cargo_ref, app_ref,
        created, updated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      d.id, d.area, d.type, d.code, d.name, d.version, d.state, d.owner,
      d.vigencia, d.views, d.desc || '', JSON.stringify(d.tags || []),
      JSON.stringify(d.related || []), d.ans || null, d.cargo || null, d.app || null,
      d.created, d.updated,
    ]);

    for (const h of d.history || []) {
      await query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, $4, $5)
      `, [d.id, h.v, h.date, h.by, h.note]);
    }
  }

  for (const w of DATA.WORKFLOW) {
    await query(`
      INSERT INTO workflow_items (id, doc_id, stage, assignee, since_date, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [w.id, w.docId, w.stage, w.assignee, w.since, w.priority]);
  }

  for (const act of DATA.ACTIVITY) {
    await query(`
      INSERT INTO activity_log (who_person_id, action, doc_id, when_text)
      VALUES ($1, $2, $3, $4)
    `, [act.who, act.action, act.doc, act.when]);
  }

  return { seeded: true, documents: DATA.DOCS.length };
}

export async function seedIfEmpty() {
  return seedDatabase({ force: false });
}
