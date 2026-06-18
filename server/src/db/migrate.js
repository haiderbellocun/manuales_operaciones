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
  await dropColumn('users', 'legacy_key');
  await dropColumn('documents', 'legacy_key');
  await dropColumn('workflow_items', 'legacy_key');
  await dropColumn('update_requests', 'legacy_key');

  await query(`
    UPDATE roles
    SET perms = jsonb_set(perms, '{administrar}', to_jsonb(id = 1), true)
    WHERE NOT (perms ? 'administrar')
  `);
}
