-- Migration: 20260507000002_loans.sql
-- Таблица кредитных обязательств компании (кредиты, лизинг, займы)
--
-- Откат:
--   DROP TABLE IF EXISTS loans;

CREATE TABLE IF NOT EXISTS loans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lender_name       TEXT NOT NULL,                        -- кредитор (банк, организация)
  loan_type         TEXT NOT NULL                         -- тип: кредит / лизинг / займ
                      CHECK (loan_type IN ('credit', 'leasing', 'borrow')),
  purpose           TEXT,                                 -- назначение (на что брался)

  original_amount   DECIMAL(12,2) NOT NULL CHECK (original_amount > 0),  -- исходная сумма
  remaining_amount  DECIMAL(12,2) NOT NULL CHECK (remaining_amount >= 0), -- остаток на сегодня
  annual_rate       DECIMAL(5,2)  CHECK (annual_rate >= 0),               -- ставка % годовых
  monthly_payment   DECIMAL(12,2) CHECK (monthly_payment >= 0),           -- ежемесячный платёж

  started_at        DATE NOT NULL,                        -- дата начала
  ends_at           DATE,                                 -- дата окончания

  notes             TEXT,                                 -- примечание
  is_active         BOOLEAN NOT NULL DEFAULT true,        -- soft-delete

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE loans IS 'Кредитные обязательства компании: кредиты, лизинг, займы';
COMMENT ON COLUMN loans.remaining_amount IS 'Вводится вручную. Не пересчитывается автоматически.';
COMMENT ON COLUMN loans.loan_type IS 'credit = кредит, leasing = лизинг, borrow = займ';

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Только admin/owner через service_role (все API-роуты используют Admin Client)
CREATE POLICY "loans_service_role_all" ON loans
  USING (true)
  WITH CHECK (true);

-- Права для service_role
GRANT SELECT, INSERT, UPDATE ON loans TO service_role;
