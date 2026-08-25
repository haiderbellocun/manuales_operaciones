BEGIN;

-- Área macro para documentos institucionales compartidos por todas las coordinaciones.
INSERT INTO areas (id, name, abbreviation, color, lead_name, requires_coordination)
VALUES (9, 'Coordinacion General', 'CG', '#f5a000', NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  abbreviation = EXCLUDED.abbreviation,
  color = EXCLUDED.color,
  lead_name = EXCLUDED.lead_name,
  requires_coordination = EXCLUDED.requires_coordination;

-- Compatibilidad con instalaciones creadas antes del alcance institucional.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS visible_to_all BOOLEAN NOT NULL DEFAULT false;

-- Los documentos del área macro siempre son institucionales al publicarse.
UPDATE documents
SET visible_to_all = true
WHERE area_id = 9
  AND visible_to_all IS DISTINCT FROM true;

SELECT setval(
  pg_get_serial_sequence('areas', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM areas), 1),
  true
);

COMMIT;
