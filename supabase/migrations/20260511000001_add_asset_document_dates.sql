-- Add insurance and technical inspection expiry dates to assets
-- Rollback: ALTER TABLE assets DROP COLUMN IF EXISTS insurance_expires_at, DROP COLUMN IF EXISTS inspection_expires_at;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS insurance_expires_at DATE,
  ADD COLUMN IF NOT EXISTS inspection_expires_at DATE;

COMMENT ON COLUMN assets.insurance_expires_at IS 'Дата окончания страховки (ОСАГО/КАСКО). NULL = не внесена → предупреждение';
COMMENT ON COLUMN assets.inspection_expires_at IS 'Дата окончания технического осмотра. NULL = не внесена → предупреждение';
