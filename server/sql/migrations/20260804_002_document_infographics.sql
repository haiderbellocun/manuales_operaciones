-- Acervo Operaciones
-- Migracion: infografia grafica asociada a cada documento
-- Fecha: 2026-08-04
-- Idempotente: puede ejecutarse mas de una vez.

BEGIN;

CREATE TABLE IF NOT EXISTS document_infographics (
  doc_id           INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  original_name    VARCHAR(500) NOT NULL,
  stored_name      VARCHAR(500) NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  file_size        BIGINT NOT NULL,
  document_version VARCHAR(20),
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_infographics_uploaded_at
  ON document_infographics(uploaded_at DESC);

COMMENT ON TABLE document_infographics IS
  'Archivo grafico de infografia vigente que acompana a cada documento del Acervo.';
COMMENT ON COLUMN document_infographics.document_version IS
  'Version documental vigente al momento de cargar la infografia.';

COMMIT;
