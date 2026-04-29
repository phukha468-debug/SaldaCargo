-- ============================================================
-- SaldaCargo — Первая миграция
-- Создана: 2026-04-28
-- ============================================================

-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- для быстрого поиска по тексту

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE lifecycle_status AS ENUM ('draft', 'approved', 'returned', 'cancelled');
CREATE TYPE settlement_status AS ENUM ('pending', 'completed');
CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'cancelled');
CREATE TYPE trip_type AS ENUM ('local', 'intercity', 'moving', 'hourly');
CREATE TYPE payment_method AS ENUM ('cash', 'qr', 'bank_invoice', 'debt_cash', 'card_driver');
CREATE TYPE transaction_direction AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'driver', 'loader', 'mechanic', 'mechanic_lead', 'accountant');
CREATE TYPE asset_status AS ENUM ('active', 'repair', 'reserve', 'sold', 'written_off');
CREATE TYPE wallet_type AS ENUM ('bank_account', 'cash_register', 'fuel_card', 'driver_accountable', 'owner_personal');
CREATE TYPE defect_urgency AS ENUM ('critical', 'soon', 'low');
CREATE TYPE defect_status AS ENUM ('open', 'planned', 'fixed', 'dismissed');
CREATE TYPE counterparty_type AS ENUM ('client', 'supplier', 'both');

-- ============================================================
-- ЮРЛИЦА
-- ============================================================

CREATE TABLE legal_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ip', 'ooo', 'self_employed')),
  inn TEXT,
  tax_regime TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bik TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  max_user_id TEXT UNIQUE, -- ID в мессенджере МАХ
  roles user_role[] NOT NULL DEFAULT '{}',
  current_asset_id UUID, -- закреплённая машина (FK добавим после assets)
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- КОНТРАГЕНТЫ
-- ============================================================

CREATE TABLE counterparties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  type counterparty_type NOT NULL DEFAULT 'client',
  credit_limit DECIMAL(12,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_counterparties_name_trgm ON counterparties USING gin(name gin_trgm_ops);

-- ============================================================
-- ТИПЫ АКТИВОВ
-- ============================================================

CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  capacity_m DECIMAL(4,1), -- длина кузова в метрах
  has_gps BOOLEAN DEFAULT false,
  requires_odometer_photo BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- АКТИВЫ (МАШИНЫ)
-- ============================================================

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reg_number TEXT NOT NULL,
  short_name TEXT NOT NULL, -- "866", "Валдай 096"
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  year INTEGER,
  status asset_status NOT NULL DEFAULT 'active',
  odometer_current INTEGER NOT NULL DEFAULT 0,
  current_book_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_depreciation_months INTEGER,
  wialon_id TEXT,
  opti24_card_number TEXT,
  legal_entity_id UUID REFERENCES legal_entities(id),
  assigned_driver_id UUID REFERENCES users(id),
  needs_update BOOLEAN DEFAULT false, -- TRUE если данные неполные (TODO в MD)
  notes TEXT,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- FK: users.current_asset_id → assets
ALTER TABLE users ADD CONSTRAINT fk_users_current_asset
  FOREIGN KEY (current_asset_id) REFERENCES assets(id);

-- ============================================================
-- КОШЕЛЬКИ
-- ============================================================

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type wallet_type NOT NULL,
  owner_user_id UUID REFERENCES users(id), -- для driver_accountable
  legal_entity_id UUID REFERENCES legal_entities(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- КАТЕГОРИИ ТРАНЗАКЦИЙ
-- ============================================================

CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  direction transaction_direction NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Базовые категории
INSERT INTO transaction_categories (code, name, direction) VALUES
  ('TRIP_REVENUE', 'Выручка с рейса', 'income'),
  ('SERVICE_REVENUE', 'Выручка с ремонта', 'income'),
  ('ASSET_SALE', 'Продажа актива', 'income'),
  ('OTHER_INCOME', 'Прочий доход', 'income'),
  ('FUEL', 'ГСМ', 'expense'),
  ('PAYROLL_DRIVER', 'ЗП водителя', 'expense'),
  ('PAYROLL_LOADER', 'ЗП грузчика', 'expense'),
  ('PAYROLL_MECHANIC', 'ЗП механика', 'expense'),
  ('REPAIR_PARTS', 'Запчасти', 'expense'),
  ('REPAIR_EXTERNAL', 'Сторонний ремонт', 'expense'),
  ('INSURANCE', 'Страховка', 'expense'),
  ('RENT', 'Аренда', 'expense'),
  ('OFFICE_COMMS', 'Офис и связь', 'expense'),
  ('TAX', 'Налоги', 'expense'),
  ('CASH_COLLECT', 'Инкассация', 'transfer'),
  ('WALLET_TRANSFER', 'Перевод между кошельками', 'transfer'),
  ('ASSET_WRITE_OFF', 'Списание балансовой стоимости', 'expense'),
  ('DEPRECIATION', 'Амортизация', 'expense'),
  ('OTHER_EXPENSE', 'Прочий расход', 'expense');

-- ============================================================
-- РЕЙСЫ
-- ============================================================

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_number SERIAL,
  asset_id UUID NOT NULL REFERENCES assets(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  loader_id UUID REFERENCES users(id),
  trip_type trip_type NOT NULL DEFAULT 'local',
  status trip_status NOT NULL DEFAULT 'in_progress',
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'draft',
  odometer_start INTEGER NOT NULL,
  odometer_end INTEGER,
  odometer_photo_start_url TEXT,
  odometer_photo_end_url TEXT,
  driver_note TEXT,
  admin_note TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_asset_id ON trips(asset_id);
CREATE INDEX idx_trips_lifecycle ON trips(lifecycle_status);
CREATE INDEX idx_trips_started_at ON trips(started_at DESC);

-- ============================================================
-- ЗАКАЗЫ В РЕЙСЕ
-- ============================================================

CREATE TABLE trip_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  counterparty_id UUID REFERENCES counterparties(id),
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  driver_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  loader_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  settlement_status settlement_status NOT NULL DEFAULT 'completed',
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'draft',
  idempotency_key UUID NOT NULL UNIQUE,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trip_orders_trip_id ON trip_orders(trip_id);
CREATE INDEX idx_trip_orders_counterparty ON trip_orders(counterparty_id);

-- ============================================================
-- ТРАНЗАКЦИИ (сердце финансового учёта)
-- ============================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction transaction_direction NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID NOT NULL REFERENCES transaction_categories(id),
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  counterparty_id UUID REFERENCES counterparties(id),
  trip_order_id UUID REFERENCES trip_orders(id),
  service_order_id UUID, -- FK добавим в TASK_08
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'draft',
  settlement_status settlement_status NOT NULL DEFAULT 'completed',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  photo_url TEXT,
  idempotency_key UUID NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_direction ON transactions(direction);
CREATE INDEX idx_transactions_lifecycle ON transactions(lifecycle_status);
CREATE INDEX idx_transactions_settlement ON transactions(settlement_status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_counterparty ON transactions(counterparty_id);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);

-- ============================================================
-- ПРАВИЛА ЗП (только подсказки для UI)
-- ============================================================

CREATE TABLE payroll_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role user_role NOT NULL,
  asset_type_id UUID REFERENCES asset_types(id),
  trip_type trip_type,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percent', 'fixed', 'per_km', 'hourly_split')),
  value DECIMAL(8,4) NOT NULL, -- % или рублей
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- РЕГЛАМЕНТЫ ТО
-- ============================================================

CREATE TABLE maintenance_regulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  work_name TEXT NOT NULL,
  interval_km INTEGER,
  interval_months INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ПЕРИОДЫ ЗП
-- ============================================================

CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'approved', 'paid')) DEFAULT 'open',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'approve', 'return', 'cancel')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- ============================================================
-- UPDATED_AT ТРИГГЕРЫ
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер ко всем таблицам с updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legal_entities','users','counterparties','asset_types','assets',
    'wallets','trips','trip_orders','transactions','payroll_rules',
    'payroll_periods'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- ТРИГГЕР: обновление одометра машины при завершении рейса
-- ============================================================

CREATE OR REPLACE FUNCTION sync_asset_odometer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.odometer_end IS NOT NULL AND NEW.odometer_end > OLD.odometer_end THEN
    UPDATE assets SET odometer_current = NEW.odometer_end WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trips_sync_odometer
  AFTER UPDATE OF odometer_end ON trips
  FOR EACH ROW EXECUTE FUNCTION sync_asset_odometer();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterparties ENABLE ROW LEVEL SECURITY;

-- Функция: получить роли текущего пользователя
CREATE OR REPLACE FUNCTION auth_user_roles()
RETURNS user_role[] AS $$
  SELECT roles FROM users WHERE max_user_id = auth.uid()::text
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Функция: текущий пользователь — owner или admin?
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE max_user_id = auth.uid()::text
    AND ('owner' = ANY(roles) OR 'admin' = ANY(roles))
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Политики для trips: водитель видит только свои
CREATE POLICY "drivers_see_own_trips" ON trips
  FOR SELECT USING (
    driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    OR is_admin_or_owner()
  );

CREATE POLICY "drivers_insert_own_trips" ON trips
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );

CREATE POLICY "drivers_update_own_draft_trips" ON trips
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    AND lifecycle_status = 'draft'
    OR is_admin_or_owner()
  );

-- Политики для trip_orders
CREATE POLICY "trip_orders_via_trip" ON trip_orders
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM trips WHERE driver_id IN (
        SELECT id FROM users WHERE max_user_id = auth.uid()::text
      )
    )
    OR is_admin_or_owner()
  );

CREATE POLICY "trip_orders_insert" ON trip_orders
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT id FROM trips
      WHERE driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
      AND status = 'in_progress'
    )
  );

-- Политики для transactions: только admin/owner создают напрямую
-- (обычные транзакции создаются через trip_orders триггерами)
CREATE POLICY "transactions_admin_full" ON transactions
  FOR ALL USING (is_admin_or_owner());

CREATE POLICY "transactions_driver_own" ON transactions
  FOR SELECT USING (
    created_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );

-- Справочники — читают все аутентифицированные
CREATE POLICY "assets_read_all" ON assets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "counterparties_read_all" ON counterparties
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_read_all" ON users
  FOR SELECT USING (auth.role() = 'authenticated');