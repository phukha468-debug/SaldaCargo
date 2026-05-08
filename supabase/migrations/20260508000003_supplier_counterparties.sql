-- Seed поставщиков: Опти24, Новиков, Ромашин
-- Rollback: DELETE FROM counterparties WHERE id IN (
--   '20000000-0000-0000-0000-000000000001',
--   '20000000-0000-0000-0000-000000000002',
--   '20000000-0000-0000-0000-000000000003'
-- );

INSERT INTO counterparties (id, name, type, is_active, created_at, updated_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Опти24',      'supplier', true, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'Новиков А.В.', 'supplier', true, now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'Ромашин',      'supplier', true, now(), now())
ON CONFLICT (id) DO NOTHING;
