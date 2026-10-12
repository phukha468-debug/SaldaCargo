-- Migration: 20261012100000_daily_finance_audit.sql
-- Таблица суточного аудита кассы и баланса директором / администратором

CREATE TABLE IF NOT EXISTS daily_finance_audits (
  id TEXT PRIMARY KEY, -- 'YYYY-MM-DD'
  date DATE NOT NULL UNIQUE,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audited_by TEXT NOT NULL DEFAULT 'Директор',
  safe_cash_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
  safe_cash_expected DECIMAL(12,2) NOT NULL DEFAULT 0,
  safe_discrepancy DECIMAL(12,2) NOT NULL DEFAULT 0,
  bank_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  fuel_card_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'discrepancy', 'pending')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_finance_audits_date ON daily_finance_audits(date);

ALTER TABLE daily_finance_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_finance_audits_all" ON daily_finance_audits
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_finance_audits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_finance_audits TO anon, authenticated;
