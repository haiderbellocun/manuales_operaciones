import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function columnExists(table, column) {
  const { rows } = await query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
  `, [table, column]);
  return rows.length > 0;
}

async function renameColumn(table, from, to) {
  if ((await columnExists(table, from)) && !(await columnExists(table, to))) {
    await query(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

async function dropColumn(table, column) {
  if (await columnExists(table, column)) {
    await query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

async function addColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);

  await renameColumn('areas', 'code', 'abbreviation');
  await renameColumn('document_types', 'short', 'abbreviation');
  await renameColumn('documents', 'code', 'document_number');

  await dropColumn('areas', 'code');
  await dropColumn('document_types', 'short');
  await dropColumn('documents', 'code');
  await dropColumn('document_types', 'key');
  await dropColumn('roles', 'key');
  await dropColumn('people', 'key');
  await dropColumn('users', 'password');
  await dropColumn('users', 'legacy_key');
  await dropColumn('documents', 'legacy_key');
  await dropColumn('workflow_items', 'legacy_key');
  await dropColumn('update_requests', 'legacy_key');

  await addColumn('workflow_items', 'assignee_user_id', 'INTEGER REFERENCES users(id)');
  await addColumn('workflow_items', 'approver_user_id', 'INTEGER REFERENCES users(id)');
  await addColumn('workflow_items', 'completed_at', 'TIMESTAMPTZ');
  await addColumn('workflow_items', 'completed_by', 'INTEGER REFERENCES users(id)');
  await addColumn('workflow_items', 'reviewed_at', 'TIMESTAMPTZ');
  await addColumn('workflow_items', 'reviewed_by', 'INTEGER REFERENCES users(id)');
  await addColumn('workflow_items', 'decision', 'VARCHAR(30)');
  await addColumn('workflow_items', 'comments', 'TEXT');
  await addColumn('activity_log', 'event_type', "VARCHAR(50) NOT NULL DEFAULT 'general'");
  await addColumn('activity_log', 'details', "JSONB NOT NULL DEFAULT '{}'");
  await addColumn('activity_log', 'created_at', 'TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  await query(`
    INSERT INTO document_versions (
      doc_id, version, original_name, stored_name, mime_type, file_size, created_at, created_by, note
    )
    SELECT d.id, d.version, f.original_name, f.stored_name, f.mime_type, f.file_size,
           COALESCE(f.uploaded_at, NOW()), f.uploaded_by, 'Version vigente antes de activar versionamiento'
    FROM documents d
    JOIN document_files f ON f.doc_id = d.id
    ON CONFLICT (doc_id, version) DO NOTHING
  `);

  await query(`
    UPDATE workflow_items wi
    SET assignee_user_id = u.id
    FROM users u
    WHERE wi.assignee_user_id IS NULL
      AND LOWER(wi.assignee) = LOWER(u.name)
  `);

  await query(`
    UPDATE roles
    SET perms = jsonb_set(perms, '{administrar}', to_jsonb(id = 1), true)
    WHERE NOT (perms ? 'administrar')
  `);
}
