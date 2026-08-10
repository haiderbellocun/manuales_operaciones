-- Acervo Operaciones
-- Migracion: rol global de analitica institucional
-- Fecha: 2026-08-10
-- Idempotente: puede ejecutarse mas de una vez.

BEGIN;

INSERT INTO roles (id, name, description, perms) VALUES (
  9,
  'Analista institucional de métricas',
  'Consulta documentos, métricas, áreas y coordinaciones de toda la institución en modo de solo lectura.',
  '{"crear":false,"editar":false,"aprobar":false,"publicar":false,"archivar":false,"consultar":true,"descargar":false,"administrar":false}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  perms = EXCLUDED.perms;

SELECT setval(
  pg_get_serial_sequence('roles', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM roles), 1),
  true
);

COMMIT;
