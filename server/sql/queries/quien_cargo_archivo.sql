-- Quién cargó un documento (por document_number)
-- Uso:
--   1. Cambia el valor en params.document_number.
--   2. Ejecuta en psql / DBeaver / pgAdmin contra la BD del acervo.
--
-- Incluye:
--   - creacion_documento   → quién creó el registro (usuario de sistema)
--   - archivo_documento    → quién subió el archivo vigente
--   - infografia           → quién subió la infografía
--   - version_historica    → quién subió versiones anteriores
--   - responsable_*        → persona dueña del documento (owner en la ficha)

WITH params AS (
  SELECT 'EBA-PR-001'::text AS document_number
  -- ↑ Cambia solo este valor por el número documental a consultar
),
target AS (
  SELECT
    d.*,
    p.id          AS responsable_id,
    p.name        AS responsable_nombre,
    p.role_title  AS responsable_cargo
  FROM documents d
  CROSS JOIN params prm
  LEFT JOIN people p ON p.id = d.owner_id
  WHERE d.document_number ILIKE prm.document_number
),
resultados AS (
  SELECT
    'creacion_documento'::text AS origen,
    t.id                       AS doc_id,
    t.document_number,
    t.name                     AS documento,
    t.version                  AS version_doc,
    t.state,
    NULL::text                AS nombre_original,
    NULL::text                AS nombre_almacenado,
    NULL::text                AS mime_type,
    NULL::bigint              AS file_size,
    al.created_at              AS fecha,
    al.who_user_id             AS usuario_id,
    u.name                     AS usuario_nombre,
    u.email                    AS usuario_email,
    t.responsable_id,
    t.responsable_nombre,
    t.responsable_cargo
  FROM target t
  JOIN activity_log al
    ON al.doc_id = t.id
   AND al.event_type = 'document_created'
  LEFT JOIN users u ON u.id = al.who_user_id

  UNION ALL

  SELECT
    'archivo_documento',
    t.id,
    t.document_number,
    t.name,
    t.version,
    t.state,
    df.original_name,
    df.stored_name,
    df.mime_type,
    df.file_size,
    df.uploaded_at,
    df.uploaded_by,
    u.name,
    u.email,
    t.responsable_id,
    t.responsable_nombre,
    t.responsable_cargo
  FROM target t
  JOIN document_files df ON df.doc_id = t.id
  LEFT JOIN users u ON u.id = df.uploaded_by

  UNION ALL

  SELECT
    'infografia',
    t.id,
    t.document_number,
    t.name,
    COALESCE(di.document_version, t.version),
    t.state,
    di.original_name,
    di.stored_name,
    di.mime_type,
    di.file_size,
    di.uploaded_at,
    di.uploaded_by,
    u.name,
    u.email,
    t.responsable_id,
    t.responsable_nombre,
    t.responsable_cargo
  FROM target t
  JOIN document_infographics di ON di.doc_id = t.id
  LEFT JOIN users u ON u.id = di.uploaded_by

  UNION ALL

  SELECT
    'version_historica',
    t.id,
    t.document_number,
    t.name,
    dv.version,
    t.state,
    dv.original_name,
    dv.stored_name,
    dv.mime_type,
    dv.file_size,
    dv.created_at,
    dv.created_by,
    u.name,
    u.email,
    t.responsable_id,
    t.responsable_nombre,
    t.responsable_cargo
  FROM target t
  JOIN document_versions dv ON dv.doc_id = t.id
  LEFT JOIN users u ON u.id = dv.created_by
)
SELECT
  origen,
  doc_id,
  document_number,
  documento,
  version_doc,
  state,
  nombre_original,
  nombre_almacenado,
  mime_type,
  file_size,
  fecha,
  usuario_id,
  usuario_nombre,
  usuario_email,
  responsable_id,
  responsable_nombre,
  responsable_cargo
FROM resultados
ORDER BY fecha DESC NULLS LAST, origen;
