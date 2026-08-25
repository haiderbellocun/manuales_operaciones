-- Acervo Operaciones
-- Migracion: fecha real de publicacion del documento
-- Fecha: 2026-08-05
-- Idempotente: puede ejecutarse mas de una vez.

BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN documents.published_at IS
  'Momento en que la version vigente fue publicada. Se limpia al volver a borrador.';

-- Backfill para documentos ya publicados / vigentes.
UPDATE documents d
SET published_at = COALESCE(
  (
    SELECT wi.completed_at
    FROM workflow_items wi
    WHERE wi.doc_id = d.id
      AND wi.decision = 'published'
      AND wi.completed_at IS NOT NULL
    ORDER BY wi.completed_at DESC
    LIMIT 1
  ),
  (
    SELECT al.created_at
    FROM activity_log al
    WHERE al.doc_id = d.id
      AND (
        al.details->>'status' = 'published'
        OR al.details->>'action' = 'publish'
      )
    ORDER BY al.created_at DESC
    LIMIT 1
  ),
  CASE
    WHEN d.state IN ('publicado', 'vencido', 'archivado')
      THEN COALESCE(d.updated::timestamptz, d.created::timestamptz)
    ELSE NULL
  END
)
WHERE d.published_at IS NULL
  AND d.state IN ('publicado', 'vencido', 'archivado');

COMMIT;
