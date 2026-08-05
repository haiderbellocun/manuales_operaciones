-- Acervo Operaciones
-- Actualiza el responsable (documents.owner_id → people)
-- para que coincida con el usuario que creó/cargó el archivo.
--
-- Prioridad para resolver el usuario fuente:
--   1) document_files.uploaded_by
--   2) activity_log (event_type = document_created).who_user_id
--
-- Idempotente: puede ejecutarse más de una vez.
-- Revisar el SELECT de verificación al final antes/después.

BEGIN;

-- 1) Asegurar que exista un registro en people por cada usuario fuente.
INSERT INTO people (name, role_title, area_id, coordination_id)
SELECT DISTINCT
  u.name,
  r.name,
  u.area_id,
  u.coordination_id
FROM documents d
LEFT JOIN document_files df ON df.doc_id = d.id
LEFT JOIN activity_log al
  ON al.doc_id = d.id
 AND al.event_type = 'document_created'
JOIN users u ON u.id = COALESCE(df.uploaded_by, al.who_user_id)
LEFT JOIN roles r ON r.id = u.role_id
WHERE u.status = 'Activo'
  AND NOT EXISTS (
    SELECT 1
    FROM people p
    WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
  );

-- 2) Alinear metadatos de people con el usuario (cargo/área).
UPDATE people p
SET role_title = r.name,
    area_id = u.area_id,
    coordination_id = u.coordination_id
FROM documents d
LEFT JOIN document_files df ON df.doc_id = d.id
LEFT JOIN activity_log al
  ON al.doc_id = d.id
 AND al.event_type = 'document_created'
JOIN users u ON u.id = COALESCE(df.uploaded_by, al.who_user_id)
LEFT JOIN roles r ON r.id = u.role_id
WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
  AND u.status = 'Activo';

-- 3) Reasignar owner_id al people del usuario que cargó/creó.
WITH fuente AS (
  SELECT
    d.id AS doc_id,
    d.owner_id AS owner_actual,
    COALESCE(df.uploaded_by, al.who_user_id) AS user_id
  FROM documents d
  LEFT JOIN document_files df ON df.doc_id = d.id
  LEFT JOIN LATERAL (
    SELECT who_user_id
    FROM activity_log
    WHERE doc_id = d.id
      AND event_type = 'document_created'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  ) al ON TRUE
),
destino AS (
  SELECT
    f.doc_id,
    f.owner_actual,
    f.user_id,
    p.id AS nuevo_owner_id,
    u.name AS usuario_nombre,
    u.email AS usuario_email
  FROM fuente f
  JOIN users u ON u.id = f.user_id
  JOIN LATERAL (
    SELECT p.id
    FROM people p
    WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(u.name))
    ORDER BY
      CASE
        WHEN p.area_id IS NOT DISTINCT FROM u.area_id
          AND p.coordination_id IS NOT DISTINCT FROM u.coordination_id
        THEN 0 ELSE 1
      END,
      p.id
    LIMIT 1
  ) p ON TRUE
)
UPDATE documents d
SET owner_id = destino.nuevo_owner_id
FROM destino
WHERE d.id = destino.doc_id
  AND d.owner_id IS DISTINCT FROM destino.nuevo_owner_id;

COMMIT;

-- Verificación (no modifica datos)
SELECT
  d.id,
  d.document_number,
  d.name AS documento,
  p.name AS responsable,
  p.role_title AS responsable_cargo,
  u.name AS usuario_carga,
  u.email AS email_carga,
  df.uploaded_at AS fecha_carga
FROM documents d
LEFT JOIN people p ON p.id = d.owner_id
LEFT JOIN document_files df ON df.doc_id = d.id
LEFT JOIN users u ON u.id = df.uploaded_by
ORDER BY d.document_number;
