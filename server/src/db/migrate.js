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

const SYSTEM_AREAS = [
  [1, 'Fábrica de Contenidos', 'FCO', 'var(--area-fco)', 'Laura Restrepo Mejía'],
  [2, 'Prácticas', 'PRA', 'var(--area-pra)', 'Mauricio Salazar Ríos'],
  [3, 'Homologaciones', 'HOM', 'var(--area-hom)', 'Diana Marcela Ruiz'],
  [4, 'Operación Académica de Pregrado', 'OAP', 'var(--area-oap)', 'Carlos Andrés Gómez'],
  [5, 'Operación Académica de Posgrado', 'OPG', 'var(--area-opg)', 'Andrea Forero Castro'],
  [6, 'Pruebas Saber', 'PSB', 'var(--area-psb)', 'Julián Ospina Vélez'],
];

const SYSTEM_TYPES = [
  [1, 'Procedimiento', 'PR', 'flow'],
  [2, 'Manual de funciones', 'MF', 'briefcase'],
  [3, 'Descriptor de cargo', 'DC', 'idcard'],
  [4, 'Manual de aplicación', 'MA', 'app'],
  [5, 'ANS', 'ANS', 'handshake'],
  [6, 'Formato', 'FT', 'form'],
  [7, 'Instructivo', 'IN', 'list'],
  [8, 'Guía', 'GU', 'compass'],
  [9, 'Política', 'PO', 'shield'],
];

const SYSTEM_ROLES = [
  [1, 'Administrador general', 'Control total de la plataforma, configuración y usuarios.', { crear: true, editar: true, aprobar: true, publicar: true, archivar: true, consultar: true, descargar: true, administrar: true }],
  [2, 'Líder de área', 'Gestiona y aprueba los documentos de su área.', { crear: true, editar: true, aprobar: true, publicar: true, archivar: true, consultar: true, descargar: true, administrar: false }],
  [3, 'Editor documental', 'Crea y edita documentos; los envía a revisión.', { crear: true, editar: true, aprobar: false, publicar: false, archivar: false, consultar: true, descargar: true, administrar: false }],
  [4, 'Revisor', 'Revisa documentos y devuelve observaciones.', { crear: false, editar: false, aprobar: false, publicar: false, archivar: false, consultar: true, descargar: true, administrar: false }],
  [5, 'Aprobador', 'Aprueba documentos revisados para su publicación.', { crear: false, editar: false, aprobar: true, publicar: true, archivar: false, consultar: true, descargar: true, administrar: false }],
  [6, 'Usuario consultor', 'Consulta y descarga documentos publicados.', { crear: false, editar: false, aprobar: false, publicar: false, archivar: false, consultar: true, descargar: true, administrar: false }],
  [7, 'Auditor / lector institucional', 'Lectura y trazabilidad sin descarga.', { crear: false, editar: false, aprobar: false, publicar: false, archivar: false, consultar: true, descargar: false, administrar: false }],
];

async function syncIdentity(table) {
  await query(`
    SELECT setval(
      pg_get_serial_sequence($1, 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${table}), 1),
      true
    )
  `, [table]);
}

async function ensureSystemCatalogs() {
  for (const [id, name, abbreviation, color, leadName] of SYSTEM_AREAS) {
    await query(`
      INSERT INTO areas (id, name, abbreviation, color, lead_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          abbreviation = EXCLUDED.abbreviation,
          color = EXCLUDED.color,
          lead_name = EXCLUDED.lead_name
    `, [id, name, abbreviation, color, leadName]);
  }

  for (const [id, name, abbreviation, icon] of SYSTEM_TYPES) {
    await query(`
      INSERT INTO document_types (id, name, abbreviation, icon)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          abbreviation = EXCLUDED.abbreviation,
          icon = EXCLUDED.icon
    `, [id, name, abbreviation, icon]);
  }

  for (const [id, name, description, perms] of SYSTEM_ROLES) {
    await query(`
      INSERT INTO roles (id, name, description, perms)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, [id, name, description, JSON.stringify(perms)]);
  }

  await syncIdentity('areas');
  await syncIdentity('document_types');
  await syncIdentity('roles');
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

  await ensureSystemCatalogs();

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
