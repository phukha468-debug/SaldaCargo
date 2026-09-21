-- ============================================================
-- МИГРАЦИЯ: Официальное трудоустройство (ТК РФ), автовычет и ФССП
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_officially_employed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS official_salary_amount DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
  ADD COLUMN IF NOT EXISTS official_salary_day INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS has_court_orders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS court_order_pct DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS court_order_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_officially_employed ON users(is_officially_employed) WHERE is_officially_employed = true;
