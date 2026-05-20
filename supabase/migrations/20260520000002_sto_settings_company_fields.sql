-- Rollback: ALTER TABLE sto_settings DROP COLUMN IF EXISTS company_name, DROP COLUMN IF EXISTS company_address, DROP COLUMN IF EXISTS company_phone;

ALTER TABLE sto_settings
  ADD COLUMN IF NOT EXISTS company_name    TEXT NOT NULL DEFAULT 'СТО СалдаКарго',
  ADD COLUMN IF NOT EXISTS company_address TEXT NOT NULL DEFAULT 'г. Верхняя Салда',
  ADD COLUMN IF NOT EXISTS company_phone   TEXT NOT NULL DEFAULT '';
