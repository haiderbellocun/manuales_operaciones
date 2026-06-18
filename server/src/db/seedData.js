import { DATA } from '../../../src/data.js';
import { query } from './pool.js';

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    notifications, activity_log, update_requests, document_files, favorites,
    workflow_items, document_history, documents,
    users, people, roles, document_types, areas
  RESTART IDENTITY CASCADE
`;

const AREA_IDS = { fco: 1, pra: 2, hom: 3, oap: 4, opg: 5, psb: 6 };
const TYPE_IDS = {
  procedimiento: 1,
  manual_funciones: 2,
  descriptor: 3,
  manual_app: 4,
  ans: 5,
  formato: 6,
  instructivo: 7,
  guia: 8,
  politica: 9,
};
const ROLE_IDS = {
  admin: 1,
  lider: 2,
  editor: 3,
  revisor: 4,
  aprobador: 5,
  consultor: 6,
  auditor: 7,
};
const PERSON_IDS = {
  laura: 1,
  mauricio: 2,
  diana: 3,
  carlos: 4,
  andrea: 5,
  julian: 6,
  paula: 7,
  sebastian: 8,
  valentina: 9,
  felipe: 10,
};

function numericKey(value) {
  if (!value) return null;
  const n = Number(String(value).replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function docId(value) {
  return numericKey(value);
}

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
      'INSERT INTO areas (id, name, abbreviation, color, lead_name) VALUES ($1,$2,$3,$4,$5)',
      [a.id, a.name, a.abbreviation, a.color, a.lead],
    );
  }

  for (const t of DATA.TYPES) {
    await query(
      'INSERT INTO document_types (id, name, abbreviation, icon) VALUES ($1,$2,$3,$4)',
      [t.id, t.name, t.abbreviation, t.icon],
    );
  }

  for (const r of DATA.ROLES) {
    await query(
      'INSERT INTO roles (id, name, description, perms) VALUES ($1,$2,$3,$4)',
      [r.id, r.name, r.desc, JSON.stringify(r.perms)],
    );
  }

  for (const [slug, p] of Object.entries(DATA.PEOPLE)) {
    await query(
      'INSERT INTO people (id, name, role_title, area_id) VALUES ($1,$2,$3,$4)',
      [PERSON_IDS[slug], p.name, p.role, AREA_IDS[p.area] || null],
    );
  }

  for (const u of DATA.USERS) {
    const id = numericKey(u.id);
    const password = u.id === 'u1' ? 'admin1234' : 'demo1234';
    await query(
      'INSERT INTO users (id, name, email, password, role_id, area_id, status, last_access) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, u.name, u.email, password, ROLE_IDS[u.role], AREA_IDS[u.area] || null, u.status, u.last || null],
    );
  }

  for (const d of DATA.DOCS) {
    const id = docId(d.id);
    await query(`
      INSERT INTO documents (
        id, area_id, type_id, document_number, name, version, state, owner_id,
        vigencia, views, description, tags, related, ans_ref, cargo_ref, app_ref,
        created, updated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      id, d.area, d.type, d.documentNumber, d.name, d.version, d.state, d.owner,
      d.vigencia, d.views, d.desc || '', JSON.stringify(d.tags || []),
      JSON.stringify((d.related || []).map(docId).filter(Boolean)),
      d.ans || null, d.cargo || null, d.app || null,
      d.created, d.updated,
    ]);

    for (const h of d.history || []) {
      await query(`
        INSERT INTO document_history (doc_id, version, history_date, by_person_id, note)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, h.v, h.date, h.by || null, h.note]);
    }
  }

  for (const w of DATA.WORKFLOW) {
    await query(`
      INSERT INTO workflow_items (doc_id, stage, assignee, since_date, priority)
      VALUES ($1, $2, $3, $4, $5)
    `, [docId(w.docId), w.stage, w.assignee, w.since, w.priority]);
  }

  for (const act of DATA.ACTIVITY) {
    await query(`
      INSERT INTO activity_log (who_person_id, action, doc_id, when_text)
      VALUES ($1, $2, $3, $4)
    `, [PERSON_IDS[act.who] || null, act.action, docId(act.docId), act.when]);
  }

  return { seeded: true, documents: DATA.DOCS.length };
}

export async function seedIfEmpty() {
  return seedDatabase({ force: false });
}
