-- Migration: add counterparty requisites columns
ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS inn text,
  ADD COLUMN IF NOT EXISTS kpp text,
  ADD COLUMN IF NOT EXISTS ogrn text,
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS actual_address text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS ati_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bik text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS corr_account text;

CREATE INDEX IF NOT EXISTS idx_counterparties_inn ON counterparties(inn);
