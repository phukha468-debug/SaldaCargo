-- Migration: 20261005100000_payment_calendar.sql
-- Таблицы для платёжного календаря: обязательства, переменные платежи и переопределения

CREATE TABLE IF NOT EXISTS payment_calendar_obligations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 31),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  payment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (payment_type IN ('fixed', 'variable')),
  target_period TEXT,
  preferred_wallet_id TEXT DEFAULT '10000000-0000-0000-0000-000000000001',
  recipient TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_calendar_overrides (
  id TEXT PRIMARY KEY, -- period:obligation_id, например '2026-10:loan-123'
  period TEXT NOT NULL,
  obligation_id TEXT NOT NULL,
  paid_amount DECIMAL(12,2),
  paid_at TIMESTAMPTZ,
  wallet_id TEXT,
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  custom_title TEXT,
  custom_amount DECIMAL(12,2),
  custom_due_day INTEGER,
  custom_recipient TEXT,
  custom_notes TEXT,
  custom_category TEXT,
  custom_wallet_id TEXT,
  payment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_calendar_overrides_period ON payment_calendar_overrides(period);

ALTER TABLE payment_calendar_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_calendar_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_calendar_obligations_service_role" ON payment_calendar_obligations
  USING (true) WITH CHECK (true);

CREATE POLICY "payment_calendar_overrides_service_role" ON payment_calendar_overrides
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_calendar_obligations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_calendar_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_calendar_obligations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_calendar_overrides TO anon, authenticated;

-- Начальные данные базовых обязательств
INSERT INTO payment_calendar_obligations (id, title, category, amount, due_day, frequency, payment_type, preferred_wallet_id, recipient, notes, is_active)
VALUES
  ('obl-rent-01', 'Аренда базы и офиса', 'rent', 65000, 5, 'monthly', 'fixed', '10000000-0000-0000-0000-000000000001', 'ООO «ПромНедвижимость»', 'База в Верхней Салде, стоянка 8 машин + диспетчерская', true),
  ('obl-comms-02', 'Корпоративная связь и ГЛОНАСС трекеры', 'comms', 14500, 1, 'monthly', 'fixed', '10000000-0000-0000-0000-000000000001', 'МТС / Omnicomm', 'SIM-карты водителей и спутниковый мониторинг транспорта', true),
  ('obl-fuel-03', 'Пополнение топливных карт (ГСМ Опти24)', 'fuel', 150000, 10, 'monthly', 'fixed', '10000000-0000-0000-0000-000000000001', 'Газпромнефть (Опти24)', 'Плановое пополнение баланса карт для рейсов', true),
  ('obl-court-06', 'Алименты и исполнительные листы (ФССП)', 'court_order', 22500, 15, 'monthly', 'fixed', '10000000-0000-0000-0000-000000000001', 'УФССП по Свердловской обл.', 'Обязательные удержания по постановлениям судебных приставов', true),
  ('obl-tax-07', 'Налоги и единый налоговый платеж (ЕНП)', 'tax', 48000, 28, 'monthly', 'fixed', '10000000-0000-0000-0000-000000000001', 'ФНС России (ЕНС)', 'УСН Доходы-Расходы и страховые взносы за сотрудников', true)
ON CONFLICT (id) DO NOTHING;
