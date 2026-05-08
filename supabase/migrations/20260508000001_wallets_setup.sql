-- Создание 3 кошельков компании с фиксированными ID
-- Rollback: DELETE FROM wallets WHERE id IN (
--   '10000000-0000-0000-0000-000000000001',
--   '10000000-0000-0000-0000-000000000002',
--   '10000000-0000-0000-0000-000000000003'
-- );
-- Note: ALTER TYPE ADD VALUE нельзя откатить в PostgreSQL

ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'company_card';

INSERT INTO wallets (id, name, type, is_active, created_at, updated_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Расчётный счёт', 'bank_account',  true, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'Сейф (Наличные)', 'cash_register', true, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'Карта',           'company_card',  true, now(), now())
ON CONFLICT (id) DO NOTHING;
