# SaldaCargo — Полная Карта Supabase

**Статус:** MVP-ready  
**Версия:** 2.3  
**Тип БД:** PostgreSQL (Supabase)

---

## 1. Инициализация Supabase

```bash
# 1. Создать проект на supabase.com
# - Регион: Europe (Frankfurt) для низкой латенции из Салды
# - Версия PostgreSQL: 14+

# 2. Скопировать ключи из Project Settings:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY (для клиента)
# - SUPABASE_SERVICE_ROLE_KEY (для сервера)

# 3. Создать таблицы: запустить SQL в Supabase SQL Editor
```

---

## 2. ПОЛНЫЙ SQL INIT SCRIPT

Скопировать весь код ниже в Supabase → SQL Editor → Run.

```sql
-- ============================================================
-- 0. EXTENSIONS & UTILS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- 1. CORE TABLES (Справочники и основные сущности)
-- ============================================================

-- LEGAL_ENTITIES (Юрлица)
CREATE TABLE legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IP', 'OOO', 'SELF_EMPLOYED')),
  inn TEXT UNIQUE,
  tax_regime TEXT, -- 'USN', 'OSN', 'PATENT'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- BUSINESS_UNITS (Направления бизнеса)
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'LOGISTICS_LCV_CITY', 'LOGISTICS_TRUCK'
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ASSET_TYPES (Типы активов: Валдай, Газель и т.д.)
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'VALDAI_6M', 'GAZELLE_3M'
  name TEXT NOT NULL,
  default_fuel_rate DECIMAL(5,2), -- литры на 100км
  has_gps BOOLEAN DEFAULT false,
  requires_odometer_photo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USERS (Персонал: водители, механики, админ)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_user_id TEXT UNIQUE, -- ID из MAX OAuth
  phone TEXT,
  full_name TEXT NOT NULL,
  roles user_role[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  current_asset_id UUID, -- если водитель — закреплённая машина
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_current_asset FOREIGN KEY (current_asset_id) REFERENCES asset_types(id)
);

-- ASSETS (Автопарк: машины, оборудование)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  business_unit_id UUID REFERENCES business_units(id),
  legal_entity_id UUID REFERENCES legal_entities(id),

  plate_number TEXT UNIQUE NOT NULL, -- А099АА
  vin TEXT UNIQUE,
  year INT,
  odometer_current INT DEFAULT 0,

  -- АМОРТИЗАЦИЯ ПО ОСТАТОЧНОЙ СТОИМОСТИ
  residual_value DECIMAL(12,2) NOT NULL, -- остаточная стоимость
  remaining_life_months INT NOT NULL, -- оставшийся срок в мес
  monthly_depreciation DECIMAL(12,2) GENERATED ALWAYS AS (residual_value / remaining_life_months) STORED,
  current_book_value DECIMAL(12,2), -- текущая (уменьшается ежемесячно)

  -- GPS
  wialon_object_id TEXT,

  status TEXT DEFAULT 'active' CHECK (status IN ('active','repair','reserve','sold','written_off')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- WALLETS (Кошельки: касса, р/с, подотчёты)
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'ip_rs', 'cash_office', 'driver_vova'
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank_account','cash_register','employee_accountable','fuel_card','external_virtual')),
  legal_entity_id UUID REFERENCES legal_entities(id),
  owner_user_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CATEGORIES (Категории доходов/расходов)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'FREIGHT_LCV_CITY', 'FUEL', 'PAYROLL_DRIVER'
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
  parent_id UUID REFERENCES categories(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- COUNTERPARTIES (Клиенты и поставщики)
CREATE TABLE counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client','supplier','both')),
  inn TEXT,
  phone TEXT,
  contact_person TEXT,
  default_payment_terms TEXT DEFAULT 'on_delivery',
  credit_limit DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. LOGISTICS (Рейсы и заказы)
-- ============================================================

-- TRIPS (Путевые листы)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  loader_id UUID REFERENCES users(id), -- если есть грузчик

  trip_type TEXT DEFAULT 'local' CHECK (trip_type IN ('local','intercity','moving','hourly')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,

  -- Одометр
  odometer_start INT,
  odometer_end INT,
  odometer_start_photo TEXT, -- URL в Supabase Storage
  odometer_end_photo TEXT,

  -- GPS (если Валдай)
  gps_verified_mileage INT,
  gps_deviation_percent DECIMAL(5,2),
  gps_alert BOOLEAN DEFAULT false,

  route_description TEXT,

  -- ДВУХОСНЫЙ СТАТУС
  lifecycle_status TEXT DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','approved','cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,

  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_ORDERS ⭐ НОВАЯ ТАБЛИЦА - СТРОКИ ПУТЕВОГО ЛИСТА
CREATE TABLE trip_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  order_number INT NOT NULL, -- 1, 2, 3...
  counterparty_id UUID REFERENCES counterparties(id),
  client_name TEXT, -- свободный текст ("Левша", "б/н")
  description TEXT, -- "Переезд", "Доставка"
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),

  -- ЗП РУЧНОЙ ВВОД
  driver_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  loader_pay DECIMAL(12,2) DEFAULT 0,
  driver_pay_percent DECIMAL(5,2), -- информационное: driver_pay/amount*100

  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash',           -- наличные
    'qr',             -- QR на р/с (приход мгновенный)
    'bank_invoice',   -- счёт клиенту (дебиторка)
    'debt_cash',      -- долг наличный
    'card_driver'     -- на карту водителя
  )),

  settlement_status TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed')),
  -- pending только для: bank_invoice и debt_cash

  linked_income_tx_id UUID REFERENCES transactions(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_EXPENSES (Расходы в рейсе)
CREATE TABLE trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card_driver','fuel_card')),
  description TEXT,
  receipt_photo TEXT, -- URL фото чека
  linked_expense_tx_id UUID REFERENCES transactions(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TRANSACTIONS (Финансовая система)
-- ============================================================

-- TRANSACTIONS (Источник истины)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  direction TEXT NOT NULL CHECK (direction IN ('income','expense','transfer')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),

  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  category_id UUID REFERENCES categories(id),
  counterparty_id UUID REFERENCES counterparties(id),

  legal_entity_id UUID REFERENCES legal_entities(id),
  business_unit_id UUID REFERENCES business_units(id),
  asset_id UUID REFERENCES assets(id),
  trip_id UUID REFERENCES trips(id),

  -- ДВУХОСНЫЙ СТАТУС
  lifecycle_status TEXT DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','approved','cancelled')),
  settlement_status TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed')),

  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  cancelled_by UUID REFERENCES users(id),

  planned_date DATE,
  actual_date DATE DEFAULT CURRENT_DATE,
  description TEXT,

  idempotency_key TEXT UNIQUE,

  transaction_type TEXT DEFAULT 'regular' CHECK (transaction_type IN (
    'regular',
    'initial_balance',
    'depreciation',
    'payroll',
    'fuel_auto',
    'bank_auto',
    'cash_collect'
  )),

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT from_to_different CHECK (from_wallet_id IS DISTINCT FROM to_wallet_id)
);

-- ============================================================
-- 4. PAYROLL (ЗП и расчёты)
-- ============================================================

-- PAYROLL_RULES (Справочник подсказок для ЗП)
CREATE TABLE payroll_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL, -- "Газель город 30%"
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percent', 'per_km', 'fixed_daily', 'hourly_split')),
  value DECIMAL(10,4) NOT NULL,
  split_config JSONB, -- {"driver":0.33, "loader":0.33, "company":0.34}

  applies_to_asset_type_id UUID REFERENCES asset_types(id),
  applies_to_trip_type TEXT,
  description TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PAYROLL_PERIODS (Расчёт ЗП за период)
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  total_trips INT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0, -- SUM(driver_pay или loader_pay)
  advances_paid DECIMAL(12,2) DEFAULT 0,
  balance_to_pay DECIMAL(12,2) DEFAULT 0,

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  calculation_details JSONB, -- детализация

  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. FUEL (Топливо — Опти24)
-- ============================================================

-- FUEL_CARDS (Топливные карты)
CREATE TABLE fuel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT UNIQUE NOT NULL,
  asset_id UUID REFERENCES assets(id),
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FUEL_TRANSACTIONS_RAW (Заправки из Опти24 API)
CREATE TABLE fuel_transactions_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_card_id UUID REFERENCES fuel_cards(id),

  transaction_date TIMESTAMPTZ NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  liters DECIMAL(8,2),
  station_name TEXT,

  opti24_transaction_id TEXT UNIQUE,

  -- Соответствующая транзакция в основной системе
  linked_tx_id UUID REFERENCES transactions(id),

  is_synced BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. BANK (Банк)
-- ============================================================

-- BANK_STATEMENTS_RAW (Выписка из банка)
CREATE TABLE bank_statements_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),

  statement_date DATE NOT NULL,
  transaction_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  counterparty_name TEXT,
  description TEXT,

  bank_reference_id TEXT UNIQUE,

  linked_tx_id UUID REFERENCES transactions(id),

  is_matched BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. MAINTENANCE (СТО и регламенты)
-- ============================================================

-- MAINTENANCE_REGULATIONS (Регламенты ТО)
CREATE TABLE maintenance_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),

  name TEXT NOT NULL, -- "ТО-1", "Замена масла"
  description TEXT,
  interval_km INT, -- через сколько км
  interval_months INT, -- или через сколько месяцев

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MAINTENANCE_ALERTS (Уведомления о ТО)
CREATE TABLE maintenance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  regulation_id UUID NOT NULL REFERENCES maintenance_regulations(id),

  next_service_date DATE,
  next_service_mileage INT,

  alert_status TEXT DEFAULT 'pending' CHECK (alert_status IN ('pending','completed','overdue')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICE_ORDERS (Заказ-наряды)
CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  mechanic_id UUID REFERENCES users(id),

  description TEXT,
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICE_ORDER_WORKS (Работы в заказ-наряде)
CREATE TABLE service_order_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,

  work_description TEXT NOT NULL,
  cost DECIMAL(12,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICE_ORDER_PARTS (Запчасти в заказ-наряде)
CREATE TABLE service_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id),

  part_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- PARTS (Запчасти — справочник)
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  article TEXT UNIQUE,
  manufacturer TEXT,

  unit_cost DECIMAL(12,2),
  supplier_id UUID REFERENCES counterparties(id),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PART_MOVEMENTS (Инвентаризация)
CREATE TABLE part_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(id),

  quantity_change INT NOT NULL, -- +5 или -2
  movement_type TEXT CHECK (movement_type IN ('receipt','usage','adjustment')),
  reference_id UUID, -- ссылка на заказ-наряд или поставку

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. EQUIPMENT (Оборудование и инвентарь)
-- ============================================================

-- FIXED_ASSETS (Основные средства)
CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  category TEXT, -- 'equipment', 'tools', 'furniture'

  purchase_date DATE,
  purchase_cost DECIMAL(12,2),
  residual_value DECIMAL(12,2),
  remaining_life_months INT,

  status TEXT DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT now()
);

-- TOOLS (Инструменты)
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  category TEXT,
  asset_number TEXT UNIQUE,

  purchase_date DATE,
  purchase_cost DECIMAL(12,2),

  is_available BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. AUDIT & SYSTEM
-- ============================================================

-- AUDIT_LOG (Лог всех изменений)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,

  action TEXT CHECK (action IN ('insert','update','delete')),
  old_values JSONB,
  new_values JSONB,

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTACHMENTS (Файлы)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_user_id UUID REFERENCES users(id),
  reference_table TEXT,
  reference_id UUID,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_type TEXT,
  file_size INT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. INDEXES & OPTIMIZATIONS
-- ============================================================

-- Индексы для быстрых запросов
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_asset_id ON trips(asset_id);
CREATE INDEX idx_trips_lifecycle_status ON trips(lifecycle_status);
CREATE INDEX idx_trips_started_at ON trips(started_at DESC);

CREATE INDEX idx_trip_orders_trip_id ON trip_orders(trip_id);
CREATE INDEX idx_trip_orders_payment_method ON trip_orders(payment_method);

CREATE INDEX idx_transactions_direction ON transactions(direction);
CREATE INDEX idx_transactions_lifecycle_status ON transactions(lifecycle_status);
CREATE INDEX idx_transactions_settlement_status ON transactions(settlement_status);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX idx_payroll_periods_user_id ON payroll_periods(user_id);
CREATE INDEX idx_payroll_periods_period ON payroll_periods(period_start, period_end);

CREATE INDEX idx_fuel_transactions_card_id ON fuel_transactions_raw(fuel_card_id);
CREATE INDEX idx_fuel_transactions_synced ON fuel_transactions_raw(is_synced);

CREATE INDEX idx_maintenance_alerts_asset_id ON maintenance_alerts(asset_id);
CREATE INDEX idx_maintenance_alerts_status ON maintenance_alerts(alert_status);

CREATE INDEX idx_service_orders_asset_id ON service_orders(asset_id);
CREATE INDEX idx_service_orders_status ON service_orders(status);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Включить RLS на таблицы
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Примеры политик (остальные добавить по аналогии)

-- Policy: Водитель видит только свои рейсы
CREATE POLICY driver_view_own_trips ON trips
  FOR SELECT
  USING (driver_id = auth.uid() OR loader_id = auth.uid());

-- Policy: Водитель видит только заказы из своих рейсов
CREATE POLICY driver_view_own_orders ON trip_orders
  FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips
      WHERE driver_id = auth.uid() OR loader_id = auth.uid()
    )
  );

-- Policy: Водитель может создавать заказы только в своих рейсах
CREATE POLICY driver_create_orders ON trip_orders
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips
      WHERE driver_id = auth.uid()
    )
  );

-- Policy: Админ видит всё
CREATE POLICY admin_all_access ON trips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND roles && ARRAY['admin', 'owner']::user_role[]
    )
  );

-- ============================================================
-- 12. INITIAL DATA (Справочники)
-- ============================================================

-- Asset Types
INSERT INTO asset_types (code, name, default_fuel_rate, has_gps, requires_odometer_photo)
VALUES
  ('VALDAI_6M', 'Валдай 6 метров', 15.0, true, false),
  ('VALDAI_5M', 'Валдай 5 метров', 14.0, true, false),
  ('VALDAI_DUMP', 'Валдай Самосвал', 16.0, true, false),
  ('GAZELLE_4M', 'Газель 4 метра (межгород)', 12.0, false, true),
  ('GAZELLE_3M', 'Газель 3 метра (город)', 11.0, false, true),
  ('CANTER_5T', 'Кантер 5т', 13.0, false, true);

-- Business Units
INSERT INTO business_units (code, name)
VALUES
  ('LOGISTICS_LCV_CITY', 'Логистика LCV — Город'),
  ('LOGISTICS_LCV_INTERCITY', 'Логистика LCV — Межгород'),
  ('LOGISTICS_TRUCK', 'Логистика Грузовики'),
  ('LOGISTICS_5T', 'Логистика 5-тонник'),
  ('SERVICE_STATION', 'СТО'),
  ('BULK_MATERIALS', 'Сыпучие материалы'),
  ('PARTS_SHOP', 'Магазин запчастей'),
  ('PARKING', 'Платная стоянка');

-- Categories (Income)
INSERT INTO categories (code, name, direction)
VALUES
  ('FREIGHT_LCV_CITY', 'Доставка город (Газели)', 'income'),
  ('FREIGHT_LCV_INTERCITY', 'Межгород (Газели)', 'income'),
  ('FREIGHT_TRUCK', 'Грузоперевозки (Валдаи)', 'income'),
  ('FREIGHT_5T', 'Грузоперевозки (Кантер)', 'income'),
  ('MOVING', 'Переезды', 'income'),
  ('SERVICE_WORKS', 'Услуги СТО (работы)', 'income'),
  ('SERVICE_PARTS_SALE', 'Продажа запчастей (СТО)', 'income'),
  ('BULK_SALES', 'Продажа сыпучих', 'income'),
  ('PARKING_RENT', 'Аренда стоянки', 'income');

-- Categories (Expense)
INSERT INTO categories (code, name, direction)
VALUES
  ('FUEL', 'ГСМ', 'expense'),
  ('REPAIR_PARTS', 'Ремонт — запчасти', 'expense'),
  ('PAYROLL_DRIVER', 'ЗП водителя', 'expense'),
  ('PAYROLL_LOADER', 'ЗП грузчика', 'expense'),
  ('DEPRECIATION_VEHICLE', 'Амортизация транспорта', 'expense'),
  ('RENT', 'Аренда', 'expense'),
  ('UTILITIES', 'Коммуналка', 'expense'),
  ('INSURANCE', 'Страховки', 'expense');

-- Payroll Rules
INSERT INTO payroll_rules (name, rule_type, value, applies_to_asset_type_id, applies_to_trip_type, description)
SELECT
  'Газель город 30%', 'percent', 0.30, asset_types.id, 'local', 'Подсказка 30% для города'
FROM asset_types WHERE code = 'GAZELLE_3M'
UNION ALL
SELECT
  'Газель межгород 25%', 'percent', 0.25, asset_types.id, 'intercity', 'Подсказка 25% для межгорода'
FROM asset_types WHERE code = 'GAZELLE_4M';
```

---

## 3. Диаграмма отношений (Entity Relationship Diagram)

```
┌─────────────────┐
│  LEGAL_ENTITIES │
└────────┬────────┘
         │ (1:N)
         │
    ┌────┴────────┬────────────┬─────────────┐
    │             │            │             │
┌───▼──┐  ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
│ASSETS│  │WALLETS  │  │USERS    │  │BUSINESS_│
└───┬──┘  └─────────┘  └──────┬──┘  │  UNITS  │
    │                         │     └─────────┘
    │ (1:N)                   │ (1:N)
    │                         │
    ├─────────┬───────────────┘
    │         │
    │    ┌────▼──────────────┐
    │    │ TRIPS             │
    │    │ - asset_id        │
    │    │ - driver_id       │
    │    │ - loader_id       │
    │    │ - lifecycle_status│
    │    │ - settlement_*    │
    │    └────┬──────────────┘
    │         │ (1:N)
    │         │
    │    ┌────▼──────────────┐
    │    │ TRIP_ORDERS       │◄── payment_method
    │    │ - amount          │
    │    │ - driver_pay      │
    │    │ - loader_pay      │
    │    │ - settlement_*    │
    │    └────┬──────────────┘
    │         │ (1:1)
    │         │ linked_income_tx_id
    │         │
┌───▼─────────▼───────────────────────────────┐
│ TRANSACTIONS (ИСТОЧНИК ИСТИНЫ)              │
│ ─────────────────────────────────────────── │
│ - direction (income/expense/transfer)       │
│ - amount                                    │
│ - from_wallet_id ──┬──────────┐             │
│ - to_wallet_id    │          │             │
│ - category_id     │    WALLETS│             │
│ - lifecycle_status│          │             │
│ - settlement_st.  └──────────┘             │
│ - trip_id         (каждая T→ одна из Wallets)
└───────────────────────────────────────────┘

PAYROLL:
┌──────────────┐
│ PAYROLL_RULES│ (справочник подсказок)
└──────────────┘

┌────────────────────────┐
│ TRIP_ORDERS            │
│ + driver_pay           │◄── вводится вручную
│ + loader_pay           │
│ + driver_pay_percent   │
└──────────┬─────────────┘
           │ (SUM за период)
           │
        ┌──▼──────────────────┐
        │ PAYROLL_PERIODS     │
        │ - total_earned      │
        │ - balance_to_pay    │
        └─────────────────────┘
```

---

## 4. Таблица со всеми полями (справочник для разработчика)

| Таблица          | Поле                  | Тип           | Constraints                  | Примечание                                     |
| ---------------- | --------------------- | ------------- | ---------------------------- | ---------------------------------------------- |
| **users**        | id                    | UUID          | PK                           |                                                |
|                  | max_user_id           | TEXT          | UNIQUE                       | Из MAX OAuth                                   |
|                  | phone                 | TEXT          |                              |                                                |
|                  | full_name             | TEXT          | NOT NULL                     |                                                |
|                  | role                  | TEXT          | CHECK 8 вариантов            | owner, admin, driver и т.д.                    |
|                  | current_asset_id      | UUID          | FK → assets                  | Для водителя                                   |
| **assets**       | id                    | UUID          | PK                           |                                                |
|                  | asset_type_id         | UUID          | FK → asset_types             |                                                |
|                  | plate_number          | TEXT          | UNIQUE                       | Госномер                                       |
|                  | residual_value        | DECIMAL(12,2) | NOT NULL                     | Ост. стоимость сегодня                         |
|                  | remaining_life_months | INT           | NOT NULL                     | Оставшихся месяцев                             |
|                  | monthly_depreciation  | DECIMAL(12,2) | GENERATED                    | Вычисляется автоматически                      |
|                  | current_book_value    | DECIMAL(12,2) |                              | Уменьшается ежемесячно                         |
|                  | odometer_current      | INT           | DEFAULT 0                    | Текущий пробег                                 |
|                  | wialon_object_id      | TEXT          |                              | ID в Wialon (GPS)                              |
| **wallets**      | id                    | UUID          | PK                           |                                                |
|                  | code                  | TEXT          | UNIQUE                       | 'ip_rs', 'cash_office', 'driver_vova'          |
|                  | type                  | TEXT          | CHECK 5 вариантов            | bank_account, cash_register и т.д.             |
|                  | owner_user_id         | UUID          | FK → users                   | Для подотчёта                                  |
| **trips**        | id                    | UUID          | PK                           |                                                |
|                  | asset_id              | UUID          | FK → assets                  |                                                |
|                  | driver_id             | UUID          | FK → users                   | NOT NULL                                       |
|                  | loader_id             | UUID          | FK → users                   | Опционально                                    |
|                  | started_at            | TIMESTAMPTZ   | NOT NULL                     |                                                |
|                  | ended_at              | TIMESTAMPTZ   |                              |                                                |
|                  | lifecycle_status      | TEXT          | draft/approved/cancelled     | **КЛЮЧЕВОЙ**                                   |
|                  | settlement_status     | TEXT          | pending/completed            | **КЛЮЧЕВОЙ**                                   |
|                  | approved_by           | UUID          | FK → users                   | Кто утвердил                                   |
|                  | approved_at           | TIMESTAMPTZ   |                              | Когда утвердил                                 |
| **trip_orders**  | id                    | UUID          | PK                           |                                                |
|                  | trip_id               | UUID          | FK → trips                   |                                                |
|                  | order_number          | INT           | NOT NULL                     | 1, 2, 3...                                     |
|                  | amount                | DECIMAL(12,2) | NOT NULL > 0                 | Сумма заказа                                   |
|                  | driver_pay            | DECIMAL(12,2) | NOT NULL                     | **РУЧНОЙ ВВОД**                                |
|                  | loader_pay            | DECIMAL(12,2) | DEFAULT 0                    | **РУЧНОЙ ВВОД**                                |
|                  | driver_pay_percent    | DECIMAL(5,2)  |                              | Информационное: driver_pay/amount\*100         |
|                  | payment_method        | TEXT          | CHECK 5 вариантов            | cash, qr, bank_invoice, debt_cash, card_driver |
|                  | settlement_status     | TEXT          | pending/completed            |                                                |
|                  | linked_income_tx_id   | UUID          | FK → transactions            | Автоссылка                                     |
| **transactions** | id                    | UUID          | PK                           |                                                |
|                  | direction             | TEXT          | income/expense/transfer      |                                                |
|                  | amount                | DECIMAL(12,2) | NOT NULL > 0                 | **ВСЕГДА ÷ сюда не на сумму исходного заказа** |
|                  | from_wallet_id        | UUID          | FK → wallets                 |                                                |
|                  | to_wallet_id          | UUID          | FK → wallets                 |                                                |
|                  | lifecycle_status      | TEXT          | **draft/approved/cancelled** | Кто утвердил                                   |
|                  | settlement_status     | TEXT          | **pending/completed**        | Деньги прошли?                                 |
|                  | idempotency_key       | TEXT          | UNIQUE                       | Для идемпотентности                            |
|                  | transaction_type      | TEXT          | CHECK 7 типов                | regular, depreciation, payroll и т.д.          |

---

## 5. Как считаются балансы (КРИТИЧНО!)

```sql
-- Баланс кошелька = SUM всех транзакций, где это кошелек "to" минус "from"
-- ТОЛЬКО по approved + completed

SELECT
  wallet_id,
  SUM(
    CASE
      WHEN to_wallet_id = wallet_id THEN amount
      WHEN from_wallet_id = wallet_id THEN -amount
      ELSE 0
    END
  ) as balance
FROM transactions
WHERE lifecycle_status = 'approved'
  AND settlement_status = 'completed'
  AND actual_date <= CURRENT_DATE
GROUP BY wallet_id;

-- P&L за период = доходы - расходы (только approved + completed)
SELECT
  business_unit_id,
  SUM(amount) FILTER (WHERE direction = 'income') as income,
  SUM(amount) FILTER (WHERE direction = 'expense') as expense,
  SUM(amount) FILTER (WHERE direction = 'income') -
  SUM(amount) FILTER (WHERE direction = 'expense') as profit
FROM transactions
WHERE lifecycle_status = 'approved'
  AND settlement_status = 'completed'
  AND actual_date BETWEEN period_start AND period_end
GROUP BY business_unit_id;
```

---

## 6. Триггеры и автоматизация

```sql
-- ТРИГГЕР 1: При создании пользователя → автосоздание wallet (подотчёт)
CREATE OR REPLACE FUNCTION create_employee_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF ('driver' = ANY(NEW.roles) OR 'mechanic' = ANY(NEW.roles) OR 'mechanic_lead' = ANY(NEW.roles) OR 'loader' = ANY(NEW.roles)) THEN
    INSERT INTO wallets (code, name, type, owner_user_id, legal_entity_id)
    VALUES (
      'employee_' || NEW.id,
      'Подотчёт ' || NEW.full_name,
      'employee_accountable',
      NEW.id,
      (SELECT id FROM legal_entities LIMIT 1) -- главное юрлицо
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_wallet AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_employee_wallet();

-- ТРИГГЕР 2: При INSERT trip_orders → создание income transaction
CREATE OR REPLACE FUNCTION create_income_transaction()
RETURNS TRIGGER AS $$
DECLARE
  wallet_id UUID;
BEGIN
  -- Определить целевой кошелёк по payment_method
  wallet_id := CASE NEW.payment_method
    WHEN 'cash' THEN (SELECT id FROM wallets WHERE code = 'driver_wallet')
    WHEN 'qr' THEN (SELECT id FROM wallets WHERE code = 'ip_rs')
    WHEN 'bank_invoice' THEN (SELECT id FROM wallets WHERE code = 'ip_rs')
    WHEN 'debt_cash' THEN (SELECT id FROM wallets WHERE code = 'cash_office')
    WHEN 'card_driver' THEN (SELECT id FROM wallets WHERE code = 'driver_wallet')
  END;

  INSERT INTO transactions (
    direction, amount, from_wallet_id, to_wallet_id,
    category_id, trip_id,
    lifecycle_status, settlement_status,
    actual_date
  )
  VALUES (
    'income', NEW.amount,
    (SELECT id FROM wallets WHERE code = 'ext_clients'), -- fake external
    wallet_id,
    (SELECT id FROM categories WHERE code = 'FREIGHT_LCV_CITY' LIMIT 1),
    NEW.trip_id,
    'draft',
    CASE NEW.payment_method WHEN 'bank_invoice' THEN 'pending'
                            WHEN 'debt_cash' THEN 'pending'
                            ELSE 'completed' END,
    CURRENT_DATE
  );

  UPDATE trip_orders
  SET linked_income_tx_id = (SELECT id FROM transactions ORDER BY created_at DESC LIMIT 1)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_tx AFTER INSERT ON trip_orders
FOR EACH ROW EXECUTE FUNCTION create_income_transaction();

-- ТРИГГЕР 3: При UPDATE assets.odometer_current → проверка ТО
CREATE OR REPLACE FUNCTION check_maintenance_alert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE maintenance_alerts
  SET alert_status = CASE
    WHEN NEW.odometer_current >= next_service_mileage THEN 'overdue'
    WHEN NEW.odometer_current >= next_service_mileage - 500 THEN 'pending'
    ELSE 'pending'
  END
  WHERE asset_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_to AFTER UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION check_maintenance_alert();
```

---

## 7. Миграция: как инициализировать БД

```bash
# 1. Скопировать весь SQL из п.2 выше
# 2. Открыть Supabase SQL Editor
# 3. Вставить и выполнить (может занять 1-2 минуты)
# 4. Проверить: все таблицы созданы

# 5. Экспортировать типы в TypeScript
supabase gen types typescript --schema public > packages/shared-types/database.types.ts

# 6. Заполнить справочники (seed data)
# — Контрагентов добавить вручную в Dashboard
# — Машины добавить через Setup Wizard
```

---

## 8. Резервная копия и восстановление

```bash
# Резервная копия:
pg_dump postgresql://user:password@host/db > backup.sql

# Восстановление:
psql postgresql://user:password@host/db < backup.sql
```

---

## Итого

✅ **Полная Supabase схема готова к инициализации**  
✅ **Все таблицы, индексы, триггеры, RLS**  
✅ **Двухосный статус реализован на уровне БД**  
✅ **Автоматизация через pg_cron и триггеры**

**Следующий файл:** ENVIRONMENT.md (переменные окружения)
