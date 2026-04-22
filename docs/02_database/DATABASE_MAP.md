# SaldaCargo вЂ” РџРѕР»РЅР°СЏ РљР°СЂС‚Р° Supabase

**РЎС‚Р°С‚СѓСЃ:** MVP-ready  
**Р’РµСЂСЃРёСЏ:** 2.3  
**РўРёРї Р‘Р”:** PostgreSQL (Supabase)  

---

## 1. РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Supabase

```bash
# 1. РЎРѕР·РґР°С‚СЊ РїСЂРѕРµРєС‚ РЅР° supabase.com
# - Р РµРіРёРѕРЅ: Europe (Frankfurt) РґР»СЏ РЅРёР·РєРѕР№ Р»Р°С‚РµРЅС†РёРё РёР· РЎР°Р»РґС‹
# - Р’РµСЂСЃРёСЏ PostgreSQL: 14+

# 2. РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РєР»СЋС‡Рё РёР· Project Settings:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY (РґР»СЏ РєР»РёРµРЅС‚Р°)
# - SUPABASE_SERVICE_ROLE_KEY (РґР»СЏ СЃРµСЂРІРµСЂР°)

# 3. РЎРѕР·РґР°С‚СЊ С‚Р°Р±Р»РёС†С‹: Р·Р°РїСѓСЃС‚РёС‚СЊ SQL РІ Supabase SQL Editor
```

---

## 2. РџРћР›РќР«Р™ SQL INIT SCRIPT

РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РІРµСЃСЊ РєРѕРґ РЅРёР¶Рµ РІ Supabase в†’ SQL Editor в†’ Run.

```sql
-- ============================================================
-- 0. EXTENSIONS & UTILS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- 1. CORE TABLES (РЎРїСЂР°РІРѕС‡РЅРёРєРё Рё РѕСЃРЅРѕРІРЅС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё)
-- ============================================================

-- LEGAL_ENTITIES (Р®СЂР»РёС†Р°)
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

-- BUSINESS_UNITS (РќР°РїСЂР°РІР»РµРЅРёСЏ Р±РёР·РЅРµСЃР°)
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'LOGISTICS_LCV_CITY', 'LOGISTICS_TRUCK'
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ASSET_TYPES (РўРёРїС‹ Р°РєС‚РёРІРѕРІ: Р’Р°Р»РґР°Р№, Р“Р°Р·РµР»СЊ Рё С‚.Рґ.)
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'VALDAI_6M', 'GAZELLE_3M'
  name TEXT NOT NULL,
  default_fuel_rate DECIMAL(5,2), -- Р»РёС‚СЂС‹ РЅР° 100РєРј
  has_gps BOOLEAN DEFAULT false,
  requires_odometer_photo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USERS (РџРµСЂСЃРѕРЅР°Р»: РІРѕРґРёС‚РµР»Рё, РјРµС…Р°РЅРёРєРё, Р°РґРјРёРЅ)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_user_id TEXT UNIQUE, -- ID РёР· MAX OAuth
  phone TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','dispatcher','driver','mechanic','mechanic_lead','loader','accountant')),
  is_active BOOLEAN DEFAULT true,
  current_asset_id UUID, -- РµСЃР»Рё РІРѕРґРёС‚РµР»СЊ вЂ” Р·Р°РєСЂРµРїР»С‘РЅРЅР°СЏ РјР°С€РёРЅР°
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT fk_current_asset FOREIGN KEY (current_asset_id) REFERENCES asset_types(id)
);

-- ASSETS (РђРІС‚РѕРїР°СЂРє: РјР°С€РёРЅС‹, РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  business_unit_id UUID REFERENCES business_units(id),
  legal_entity_id UUID REFERENCES legal_entities(id),
  
  plate_number TEXT UNIQUE NOT NULL, -- Рђ099РђРђ
  vin TEXT UNIQUE,
  year INT,
  odometer_current INT DEFAULT 0,
  
  -- РђРњРћР РўРР—РђР¦РРЇ РџРћ РћРЎРўРђРўРћР§РќРћР™ РЎРўРћРРњРћРЎРўР
  residual_value DECIMAL(12,2) NOT NULL, -- РѕСЃС‚Р°С‚РѕС‡РЅР°СЏ СЃС‚РѕРёРјРѕСЃС‚СЊ
  remaining_life_months INT NOT NULL, -- РѕСЃС‚Р°РІС€РёР№СЃСЏ СЃСЂРѕРє РІ РјРµСЃ
  monthly_depreciation DECIMAL(12,2) GENERATED ALWAYS AS (residual_value / remaining_life_months) STORED,
  current_book_value DECIMAL(12,2), -- С‚РµРєСѓС‰Р°СЏ (СѓРјРµРЅСЊС€Р°РµС‚СЃСЏ РµР¶РµРјРµСЃСЏС‡РЅРѕ)
  
  -- GPS
  wialon_object_id TEXT,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active','repair','reserve','sold','written_off')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- WALLETS (РљРѕС€РµР»СЊРєРё: РєР°СЃСЃР°, СЂ/СЃ, РїРѕРґРѕС‚С‡С‘С‚С‹)
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

-- CATEGORIES (РљР°С‚РµРіРѕСЂРёРё РґРѕС…РѕРґРѕРІ/СЂР°СЃС…РѕРґРѕРІ)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'FREIGHT_LCV_CITY', 'FUEL', 'PAYROLL_DRIVER'
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
  parent_id UUID REFERENCES categories(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- COUNTERPARTIES (РљР»РёРµРЅС‚С‹ Рё РїРѕСЃС‚Р°РІС‰РёРєРё)
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
-- 2. LOGISTICS (Р РµР№СЃС‹ Рё Р·Р°РєР°Р·С‹)
-- ============================================================

-- TRIPS (РџСѓС‚РµРІС‹Рµ Р»РёСЃС‚С‹)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  loader_id UUID REFERENCES users(id), -- РµСЃР»Рё РµСЃС‚СЊ РіСЂСѓР·С‡РёРє
  
  trip_type TEXT DEFAULT 'local' CHECK (trip_type IN ('local','intercity','moving','hourly')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- РћРґРѕРјРµС‚СЂ
  odometer_start INT,
  odometer_end INT,
  odometer_start_photo TEXT, -- URL РІ Supabase Storage
  odometer_end_photo TEXT,
  
  -- GPS (РµСЃР»Рё Р’Р°Р»РґР°Р№)
  gps_verified_mileage INT,
  gps_deviation_percent DECIMAL(5,2),
  gps_alert BOOLEAN DEFAULT false,
  
  route_description TEXT,
  
  -- Р”Р’РЈРҐРћРЎРќР«Р™ РЎРўРђРўРЈРЎ
  lifecycle_status TEXT DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','approved','cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_ORDERS в­ђ РќРћР’РђРЇ РўРђР‘Р›РР¦Рђ - РЎРўР РћРљР РџРЈРўР•Р’РћР“Рћ Р›РРЎРўРђ
CREATE TABLE trip_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  
  order_number INT NOT NULL, -- 1, 2, 3...
  counterparty_id UUID REFERENCES counterparties(id),
  client_name TEXT, -- СЃРІРѕР±РѕРґРЅС‹Р№ С‚РµРєСЃС‚ ("Р›РµРІС€Р°", "Р±/РЅ")
  description TEXT, -- "РџРµСЂРµРµР·Рґ", "Р”РѕСЃС‚Р°РІРєР°"
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  
  -- Р—Рџ Р РЈР§РќРћР™ Р’Р’РћР”
  driver_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  loader_pay DECIMAL(12,2) DEFAULT 0,
  driver_pay_percent DECIMAL(5,2), -- РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅРѕРµ: driver_pay/amount*100
  
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash',           -- РЅР°Р»РёС‡РЅС‹Рµ
    'qr',             -- QR РЅР° СЂ/СЃ (РїСЂРёС…РѕРґ РјРіРЅРѕРІРµРЅРЅС‹Р№)
    'bank_invoice',   -- СЃС‡С‘С‚ РєР»РёРµРЅС‚Сѓ (РґРµР±РёС‚РѕСЂРєР°)
    'debt_cash',      -- РґРѕР»Рі РЅР°Р»РёС‡РЅС‹Р№
    'card_driver'     -- РЅР° РєР°СЂС‚Сѓ РІРѕРґРёС‚РµР»СЏ
  )),
  
  settlement_status TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed')),
  -- pending С‚РѕР»СЊРєРѕ РґР»СЏ: bank_invoice Рё debt_cash
  
  linked_income_tx_id UUID REFERENCES transactions(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_EXPENSES (Р Р°СЃС…РѕРґС‹ РІ СЂРµР№СЃРµ)
CREATE TABLE trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card_driver','fuel_card')),
  description TEXT,
  receipt_photo TEXT, -- URL С„РѕС‚Рѕ С‡РµРєР°
  linked_expense_tx_id UUID REFERENCES transactions(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TRANSACTIONS (Р¤РёРЅР°РЅСЃРѕРІР°СЏ СЃРёСЃС‚РµРјР°)
-- ============================================================

-- TRANSACTIONS (РСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹)
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
  
  -- Р”Р’РЈРҐРћРЎРќР«Р™ РЎРўРђРўРЈРЎ
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
-- 4. PAYROLL (Р—Рџ Рё СЂР°СЃС‡С‘С‚С‹)
-- ============================================================

-- PAYROLL_RULES (РЎРїСЂР°РІРѕС‡РЅРёРє РїРѕРґСЃРєР°Р·РѕРє РґР»СЏ Р—Рџ)
CREATE TABLE payroll_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL, -- "Р“Р°Р·РµР»СЊ РіРѕСЂРѕРґ 30%"
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percent', 'per_km', 'fixed_daily', 'hourly_split')),
  value DECIMAL(10,4) NOT NULL,
  split_config JSONB, -- {"driver":0.33, "loader":0.33, "company":0.34}
  
  applies_to_asset_type_id UUID REFERENCES asset_types(id),
  applies_to_trip_type TEXT,
  description TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PAYROLL_PERIODS (Р Р°СЃС‡С‘С‚ Р—Рџ Р·Р° РїРµСЂРёРѕРґ)
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_trips INT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0, -- SUM(driver_pay РёР»Рё loader_pay)
  advances_paid DECIMAL(12,2) DEFAULT 0,
  balance_to_pay DECIMAL(12,2) DEFAULT 0,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  calculation_details JSONB, -- РґРµС‚Р°Р»РёР·Р°С†РёСЏ
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. FUEL (РўРѕРїР»РёРІРѕ вЂ” РћРїС‚Рё24)
-- ============================================================

-- FUEL_CARDS (РўРѕРїР»РёРІРЅС‹Рµ РєР°СЂС‚С‹)
CREATE TABLE fuel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT UNIQUE NOT NULL,
  asset_id UUID REFERENCES assets(id),
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FUEL_TRANSACTIONS_RAW (Р—Р°РїСЂР°РІРєРё РёР· РћРїС‚Рё24 API)
CREATE TABLE fuel_transactions_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_card_id UUID REFERENCES fuel_cards(id),
  
  transaction_date TIMESTAMPTZ NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  liters DECIMAL(8,2),
  station_name TEXT,
  
  opti24_transaction_id TEXT UNIQUE,
  
  -- РЎРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰Р°СЏ С‚СЂР°РЅР·Р°РєС†РёСЏ РІ РѕСЃРЅРѕРІРЅРѕР№ СЃРёСЃС‚РµРјРµ
  linked_tx_id UUID REFERENCES transactions(id),
  
  is_synced BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. BANK (Р‘Р°РЅРє)
-- ============================================================

-- BANK_STATEMENTS_RAW (Р’С‹РїРёСЃРєР° РёР· Р±Р°РЅРєР°)
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
-- 7. MAINTENANCE (РЎРўРћ Рё СЂРµРіР»Р°РјРµРЅС‚С‹)
-- ============================================================

-- MAINTENANCE_REGULATIONS (Р РµРіР»Р°РјРµРЅС‚С‹ РўРћ)
CREATE TABLE maintenance_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  
  name TEXT NOT NULL, -- "РўРћ-1", "Р—Р°РјРµРЅР° РјР°СЃР»Р°"
  description TEXT,
  interval_km INT, -- С‡РµСЂРµР· СЃРєРѕР»СЊРєРѕ РєРј
  interval_months INT, -- РёР»Рё С‡РµСЂРµР· СЃРєРѕР»СЊРєРѕ РјРµСЃСЏС†РµРІ
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MAINTENANCE_ALERTS (РЈРІРµРґРѕРјР»РµРЅРёСЏ Рѕ РўРћ)
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

-- SERVICE_ORDERS (Р—Р°РєР°Р·-РЅР°СЂСЏРґС‹)
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

-- SERVICE_ORDER_WORKS (Р Р°Р±РѕС‚С‹ РІ Р·Р°РєР°Р·-РЅР°СЂСЏРґРµ)
CREATE TABLE service_order_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  
  work_description TEXT NOT NULL,
  cost DECIMAL(12,2),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICE_ORDER_PARTS (Р—Р°РїС‡Р°СЃС‚Рё РІ Р·Р°РєР°Р·-РЅР°СЂСЏРґРµ)
CREATE TABLE service_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id),
  
  part_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PARTS (Р—Р°РїС‡Р°СЃС‚Рё вЂ” СЃРїСЂР°РІРѕС‡РЅРёРє)
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

-- PART_MOVEMENTS (РРЅРІРµРЅС‚Р°СЂРёР·Р°С†РёСЏ)
CREATE TABLE part_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(id),
  
  quantity_change INT NOT NULL, -- +5 РёР»Рё -2
  movement_type TEXT CHECK (movement_type IN ('receipt','usage','adjustment')),
  reference_id UUID, -- СЃСЃС‹Р»РєР° РЅР° Р·Р°РєР°Р·-РЅР°СЂСЏРґ РёР»Рё РїРѕСЃС‚Р°РІРєСѓ
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. EQUIPMENT (РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ Рё РёРЅРІРµРЅС‚Р°СЂСЊ)
-- ============================================================

-- FIXED_ASSETS (РћСЃРЅРѕРІРЅС‹Рµ СЃСЂРµРґСЃС‚РІР°)
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

-- TOOLS (РРЅСЃС‚СЂСѓРјРµРЅС‚С‹)
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

-- AUDIT_LOG (Р›РѕРі РІСЃРµС… РёР·РјРµРЅРµРЅРёР№)
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

-- ATTACHMENTS (Р¤Р°Р№Р»С‹)
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

-- РРЅРґРµРєСЃС‹ РґР»СЏ Р±С‹СЃС‚СЂС‹С… Р·Р°РїСЂРѕСЃРѕРІ
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

-- Р’РєР»СЋС‡РёС‚СЊ RLS РЅР° С‚Р°Р±Р»РёС†С‹
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- РџСЂРёРјРµСЂС‹ РїРѕР»РёС‚РёРє (РѕСЃС‚Р°Р»СЊРЅС‹Рµ РґРѕР±Р°РІРёС‚СЊ РїРѕ Р°РЅР°Р»РѕРіРёРё)

-- Policy: Р’РѕРґРёС‚РµР»СЊ РІРёРґРёС‚ С‚РѕР»СЊРєРѕ СЃРІРѕРё СЂРµР№СЃС‹
CREATE POLICY driver_view_own_trips ON trips
  FOR SELECT
  USING (driver_id = auth.uid() OR loader_id = auth.uid());

-- Policy: Р’РѕРґРёС‚РµР»СЊ РІРёРґРёС‚ С‚РѕР»СЊРєРѕ Р·Р°РєР°Р·С‹ РёР· СЃРІРѕРёС… СЂРµР№СЃРѕРІ
CREATE POLICY driver_view_own_orders ON trip_orders
  FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE driver_id = auth.uid() OR loader_id = auth.uid()
    )
  );

-- Policy: Р’РѕРґРёС‚РµР»СЊ РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ Р·Р°РєР°Р·С‹ С‚РѕР»СЊРєРѕ РІ СЃРІРѕРёС… СЂРµР№СЃР°С…
CREATE POLICY driver_create_orders ON trip_orders
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips 
      WHERE driver_id = auth.uid()
    )
  );

-- Policy: РђРґРјРёРЅ РІРёРґРёС‚ РІСЃС‘
CREATE POLICY admin_all_access ON trips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================================
-- 12. INITIAL DATA (РЎРїСЂР°РІРѕС‡РЅРёРєРё)
-- ============================================================

-- Asset Types
INSERT INTO asset_types (code, name, default_fuel_rate, has_gps, requires_odometer_photo)
VALUES
  ('VALDAI_6M', 'Р’Р°Р»РґР°Р№ 6 РјРµС‚СЂРѕРІ', 15.0, true, false),
  ('VALDAI_5M', 'Р’Р°Р»РґР°Р№ 5 РјРµС‚СЂРѕРІ', 14.0, true, false),
  ('VALDAI_DUMP', 'Р’Р°Р»РґР°Р№ РЎР°РјРѕСЃРІР°Р»', 16.0, true, false),
  ('GAZELLE_4M', 'Р“Р°Р·РµР»СЊ 4 РјРµС‚СЂР° (РјРµР¶РіРѕСЂРѕРґ)', 12.0, false, true),
  ('GAZELLE_3M', 'Р“Р°Р·РµР»СЊ 3 РјРµС‚СЂР° (РіРѕСЂРѕРґ)', 11.0, false, true),
  ('CANTER_5T', 'РљР°РЅС‚РµСЂ 5С‚', 13.0, false, true);

-- Business Units
INSERT INTO business_units (code, name)
VALUES
  ('LOGISTICS_LCV_CITY', 'Р›РѕРіРёСЃС‚РёРєР° LCV вЂ” Р“РѕСЂРѕРґ'),
  ('LOGISTICS_LCV_INTERCITY', 'Р›РѕРіРёСЃС‚РёРєР° LCV вЂ” РњРµР¶РіРѕСЂРѕРґ'),
  ('LOGISTICS_TRUCK', 'Р›РѕРіРёСЃС‚РёРєР° Р“СЂСѓР·РѕРІРёРєРё'),
  ('LOGISTICS_5T', 'Р›РѕРіРёСЃС‚РёРєР° 5-С‚РѕРЅРЅРёРє'),
  ('SERVICE_STATION', 'РЎРўРћ'),
  ('BULK_MATERIALS', 'РЎС‹РїСѓС‡РёРµ РјР°С‚РµСЂРёР°Р»С‹'),
  ('PARTS_SHOP', 'РњР°РіР°Р·РёРЅ Р·Р°РїС‡Р°СЃС‚РµР№'),
  ('PARKING', 'РџР»Р°С‚РЅР°СЏ СЃС‚РѕСЏРЅРєР°');

-- Categories (Income)
INSERT INTO categories (code, name, direction)
VALUES
  ('FREIGHT_LCV_CITY', 'Р”РѕСЃС‚Р°РІРєР° РіРѕСЂРѕРґ (Р“Р°Р·РµР»Рё)', 'income'),
  ('FREIGHT_LCV_INTERCITY', 'РњРµР¶РіРѕСЂРѕРґ (Р“Р°Р·РµР»Рё)', 'income'),
  ('FREIGHT_TRUCK', 'Р“СЂСѓР·РѕРїРµСЂРµРІРѕР·РєРё (Р’Р°Р»РґР°Рё)', 'income'),
  ('FREIGHT_5T', 'Р“СЂСѓР·РѕРїРµСЂРµРІРѕР·РєРё (РљР°РЅС‚РµСЂ)', 'income'),
  ('MOVING', 'РџРµСЂРµРµР·РґС‹', 'income'),
  ('SERVICE_WORKS', 'РЈСЃР»СѓРіРё РЎРўРћ (СЂР°Р±РѕС‚С‹)', 'income'),
  ('SERVICE_PARTS_SALE', 'РџСЂРѕРґР°Р¶Р° Р·Р°РїС‡Р°СЃС‚РµР№ (РЎРўРћ)', 'income'),
  ('BULK_SALES', 'РџСЂРѕРґР°Р¶Р° СЃС‹РїСѓС‡РёС…', 'income'),
  ('PARKING_RENT', 'РђСЂРµРЅРґР° СЃС‚РѕСЏРЅРєРё', 'income');

-- Categories (Expense)
INSERT INTO categories (code, name, direction)
VALUES
  ('FUEL', 'Р“РЎРњ', 'expense'),
  ('REPAIR_PARTS', 'Р РµРјРѕРЅС‚ вЂ” Р·Р°РїС‡Р°СЃС‚Рё', 'expense'),
  ('PAYROLL_DRIVER', 'Р—Рџ РІРѕРґРёС‚РµР»СЏ', 'expense'),
  ('PAYROLL_LOADER', 'Р—Рџ РіСЂСѓР·С‡РёРєР°', 'expense'),
  ('DEPRECIATION_VEHICLE', 'РђРјРѕСЂС‚РёР·Р°С†РёСЏ С‚СЂР°РЅСЃРїРѕСЂС‚Р°', 'expense'),
  ('RENT', 'РђСЂРµРЅРґР°', 'expense'),
  ('UTILITIES', 'РљРѕРјРјСѓРЅР°Р»РєР°', 'expense'),
  ('INSURANCE', 'РЎС‚СЂР°С…РѕРІРєРё', 'expense');

-- ============================================================
-- 13. DATA FLOWS (Бизнес-логика)
-- ============================================================

-- [M] Водитель -> "Начать рейс":
--   1. Выбор машины + Одометр + Фото
--   -> INSERT trip (status: in_progress, lifecycle: draft)

-- [M] Водитель -> "+ Заказ":
--   1. Сумма + ЗП (ввод вручную) + Способ оплаты
--   -> INSERT trip_orders
--   -> INSERT transaction (income, draft)

-- [D] Admin -> "Ревью смены":
--   -> Проверка % ЗП (подсветка 25-40%)
--   -> Кнопка "Утвердить"
--   -> UPDATE trip + orders + transactions -> lifecycle: approved

```sql
-- Пример: Итого ЗП за рейс
SELECT SUM(driver_pay) FROM trip_orders WHERE trip_id = '...';
```

---

## 3. Р”РёР°РіСЂР°РјРјР° РѕС‚РЅРѕС€РµРЅРёР№ (Entity Relationship Diagram)

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  LEGAL_ENTITIES в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
         в”‚ (1:N)
         в”‚
    в”Њв”Ђв”Ђв”Ђв”Ђв”ґв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
    в”‚             в”‚            в”‚             в”‚
в”Њв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”ђ  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”ђ  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”ђ  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”ђ
в”‚ASSETSв”‚  в”‚WALLETS  в”‚  в”‚USERS    в”‚  в”‚BUSINESS_в”‚
в””в”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”  в”‚  UNITS  в”‚
    в”‚                         в”‚     в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
    в”‚ (1:N)                   в”‚ (1:N)
    в”‚                         в”‚
    в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
    в”‚         в”‚
    в”‚    в”Њв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
    в”‚    в”‚ TRIPS             в”‚
    в”‚    в”‚ - asset_id        в”‚
    в”‚    в”‚ - driver_id       в”‚
    в”‚    в”‚ - loader_id       в”‚
    в”‚    в”‚ - lifecycle_statusв”‚
    в”‚    в”‚ - settlement_*    в”‚
    в”‚    в””в”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
    в”‚         в”‚ (1:N)
    в”‚         в”‚
    в”‚    в”Њв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
    в”‚    в”‚ TRIP_ORDERS       в”‚в—„в”Ђв”Ђ payment_method
    в”‚    в”‚ - amount          в”‚
    в”‚    в”‚ - driver_pay      в”‚
    в”‚    в”‚ - loader_pay      в”‚
    в”‚    в”‚ - settlement_*    в”‚
    в”‚    в””в”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
    в”‚         в”‚ (1:1)
    в”‚         в”‚ linked_income_tx_id
    в”‚         в”‚
в”Њв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв–јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ TRANSACTIONS (РРЎРўРћР§РќРРљ РРЎРўРРќР«)              в”‚
в”‚ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ в”‚
в”‚ - direction (income/expense/transfer)       в”‚
в”‚ - amount                                    в”‚
в”‚ - from_wallet_id в”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ             в”‚
в”‚ - to_wallet_id    в”‚          в”‚             в”‚
в”‚ - category_id     в”‚    WALLETSв”‚             в”‚
в”‚ - lifecycle_statusв”‚          в”‚             в”‚
в”‚ - settlement_st.  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”             в”‚
в”‚ - trip_id         (РєР°Р¶РґР°СЏ Tв†’ РѕРґРЅР° РёР· Wallets)
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

PAYROLL:
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ PAYROLL_RULESв”‚ (СЃРїСЂР°РІРѕС‡РЅРёРє РїРѕРґСЃРєР°Р·РѕРє)
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ TRIP_ORDERS            в”‚
в”‚ + driver_pay           в”‚в—„в”Ђв”Ђ РІРІРѕРґРёС‚СЃСЏ РІСЂСѓС‡РЅСѓСЋ
в”‚ + loader_pay           в”‚
в”‚ + driver_pay_percent   в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¬в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
           в”‚ (SUM Р·Р° РїРµСЂРёРѕРґ)
           в”‚
        в”Њв”Ђв”Ђв–јв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
        в”‚ PAYROLL_PERIODS     в”‚
        в”‚ - total_earned      в”‚
        в”‚ - balance_to_pay    в”‚
        в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

---

## 4. РўР°Р±Р»РёС†Р° СЃРѕ РІСЃРµРјРё РїРѕР»СЏРјРё (СЃРїСЂР°РІРѕС‡РЅРёРє РґР»СЏ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°)

| РўР°Р±Р»РёС†Р° | РџРѕР»Рµ | РўРёРї | Constraints | РџСЂРёРјРµС‡Р°РЅРёРµ |
|---------|------|-----|-------------|-----------|
| **users** | id | UUID | PK | |
| | max_user_id | TEXT | UNIQUE | РР· MAX OAuth |
| | phone | TEXT | | |
| | full_name | TEXT | NOT NULL | |
| | role | TEXT | CHECK 8 РІР°СЂРёР°РЅС‚РѕРІ | owner, admin, driver Рё С‚.Рґ. |
| | current_asset_id | UUID | FK в†’ assets | Р”Р»СЏ РІРѕРґРёС‚РµР»СЏ |
| **assets** | id | UUID | PK | |
| | asset_type_id | UUID | FK в†’ asset_types | |
| | plate_number | TEXT | UNIQUE | Р“РѕСЃРЅРѕРјРµСЂ |
| | residual_value | DECIMAL(12,2) | NOT NULL | РћСЃС‚. СЃС‚РѕРёРјРѕСЃС‚СЊ СЃРµРіРѕРґРЅСЏ |
| | remaining_life_months | INT | NOT NULL | РћСЃС‚Р°РІС€РёС…СЃСЏ РјРµСЃСЏС†РµРІ |
| | monthly_depreciation | DECIMAL(12,2) | GENERATED | Р’С‹С‡РёСЃР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё |
| | current_book_value | DECIMAL(12,2) | | РЈРјРµРЅСЊС€Р°РµС‚СЃСЏ РµР¶РµРјРµСЃСЏС‡РЅРѕ |
| | odometer_current | INT | DEFAULT 0 | РўРµРєСѓС‰РёР№ РїСЂРѕР±РµРі |
| | wialon_object_id | TEXT | | ID РІ Wialon (GPS) |
| **wallets** | id | UUID | PK | |
| | code | TEXT | UNIQUE | 'ip_rs', 'cash_office', 'driver_vova' |
| | type | TEXT | CHECK 5 РІР°СЂРёР°РЅС‚РѕРІ | bank_account, cash_register Рё С‚.Рґ. |
| | owner_user_id | UUID | FK в†’ users | Р”Р»СЏ РїРѕРґРѕС‚С‡С‘С‚Р° |
| **trips** | id | UUID | PK | |
| | asset_id | UUID | FK в†’ assets | |
| | driver_id | UUID | FK в†’ users | NOT NULL |
| | loader_id | UUID | FK в†’ users | РћРїС†РёРѕРЅР°Р»СЊРЅРѕ |
| | started_at | TIMESTAMPTZ | NOT NULL | |
| | ended_at | TIMESTAMPTZ | | |
| | lifecycle_status | TEXT | draft/approved/cancelled | **РљР›Р®Р§Р•Р’РћР™** |
| | settlement_status | TEXT | pending/completed | **РљР›Р®Р§Р•Р’РћР™** |
| | approved_by | UUID | FK в†’ users | РљС‚Рѕ СѓС‚РІРµСЂРґРёР» |
| | approved_at | TIMESTAMPTZ | | РљРѕРіРґР° СѓС‚РІРµСЂРґРёР» |
| **trip_orders** | id | UUID | PK | |
| | trip_id | UUID | FK в†’ trips | |
| | order_number | INT | NOT NULL | 1, 2, 3... |
| | amount | DECIMAL(12,2) | NOT NULL > 0 | РЎСѓРјРјР° Р·Р°РєР°Р·Р° |
| | driver_pay | DECIMAL(12,2) | NOT NULL | **Р РЈР§РќРћР™ Р’Р’РћР”** |
| | loader_pay | DECIMAL(12,2) | DEFAULT 0 | **Р РЈР§РќРћР™ Р’Р’РћР”** |
| | driver_pay_percent | DECIMAL(5,2) | | РРЅС„РѕСЂРјР°С†РёРѕРЅРЅРѕРµ: driver_pay/amount*100 |
| | payment_method | TEXT | CHECK 5 РІР°СЂРёР°РЅС‚РѕРІ | cash, qr, bank_invoice, debt_cash, card_driver |
| | settlement_status | TEXT | pending/completed | |
| | linked_income_tx_id | UUID | FK в†’ transactions | РђРІС‚РѕСЃСЃС‹Р»РєР° |
| **transactions** | id | UUID | PK | |
| | direction | TEXT | income/expense/transfer | |
| | amount | DECIMAL(12,2) | NOT NULL > 0 | **Р’РЎР•Р“Р”Рђ Г· СЃСЋРґР° РЅРµ РЅР° СЃСѓРјРјСѓ РёСЃС…РѕРґРЅРѕРіРѕ Р·Р°РєР°Р·Р°** |
| | from_wallet_id | UUID | FK в†’ wallets | |
| | to_wallet_id | UUID | FK в†’ wallets | |
| | lifecycle_status | TEXT | **draft/approved/cancelled** | РљС‚Рѕ СѓС‚РІРµСЂРґРёР» |
| | settlement_status | TEXT | **pending/completed** | Р”РµРЅСЊРіРё РїСЂРѕС€Р»Рё? |
| | idempotency_key | TEXT | UNIQUE | Р”Р»СЏ РёРґРµРјРїРѕС‚РµРЅС‚РЅРѕСЃС‚Рё |
| | transaction_type | TEXT | CHECK 7 С‚РёРїРѕРІ | regular, depreciation, payroll Рё С‚.Рґ. |

---

## 5. РљР°Рє СЃС‡РёС‚Р°СЋС‚СЃСЏ Р±Р°Р»Р°РЅСЃС‹ (РљР РРўРР§РќРћ!)

```sql
-- Р‘Р°Р»Р°РЅСЃ РєРѕС€РµР»СЊРєР° = SUM РІСЃРµС… С‚СЂР°РЅР·Р°РєС†РёР№, РіРґРµ СЌС‚Рѕ РєРѕС€РµР»РµРє "to" РјРёРЅСѓСЃ "from"
-- РўРћР›Р¬РљРћ РїРѕ approved + completed

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

-- P&L Р·Р° РїРµСЂРёРѕРґ = РґРѕС…РѕРґС‹ - СЂР°СЃС…РѕРґС‹ (С‚РѕР»СЊРєРѕ approved + completed)
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

## 6. РўСЂРёРіРіРµСЂС‹ Рё Р°РІС‚РѕРјР°С‚РёР·Р°С†РёСЏ

```sql
-- РўР РР“Р“Р•Р  1: РџСЂРё СЃРѕР·РґР°РЅРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ в†’ Р°РІС‚РѕСЃРѕР·РґР°РЅРёРµ wallet (РїРѕРґРѕС‚С‡С‘С‚)
CREATE OR REPLACE FUNCTION create_employee_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('driver', 'mechanic', 'mechanic_lead', 'loader') THEN
    INSERT INTO wallets (code, name, type, owner_user_id, legal_entity_id)
    VALUES (
      'employee_' || NEW.id,
      'РџРѕРґРѕС‚С‡С‘С‚ ' || NEW.full_name,
      'employee_accountable',
      NEW.id,
      (SELECT id FROM legal_entities LIMIT 1) -- РіР»Р°РІРЅРѕРµ СЋСЂР»РёС†Рѕ
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_wallet AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_employee_wallet();

-- РўР РР“Р“Р•Р  2: РџСЂРё INSERT trip_orders в†’ СЃРѕР·РґР°РЅРёРµ income transaction
CREATE OR REPLACE FUNCTION create_income_transaction()
RETURNS TRIGGER AS $$
DECLARE
  wallet_id UUID;
BEGIN
  -- РћРїСЂРµРґРµР»РёС‚СЊ С†РµР»РµРІРѕР№ РєРѕС€РµР»С‘Рє РїРѕ payment_method
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

-- РўР РР“Р“Р•Р  3: РџСЂРё UPDATE assets.odometer_current в†’ РїСЂРѕРІРµСЂРєР° РўРћ
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

## 7. РњРёРіСЂР°С†РёСЏ: РєР°Рє РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Р‘Р”

```bash
# 1. РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РІРµСЃСЊ SQL РёР· Рї.2 РІС‹С€Рµ
# 2. РћС‚РєСЂС‹С‚СЊ Supabase SQL Editor
# 3. Р’СЃС‚Р°РІРёС‚СЊ Рё РІС‹РїРѕР»РЅРёС‚СЊ (РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ 1-2 РјРёРЅСѓС‚С‹)
# 4. РџСЂРѕРІРµСЂРёС‚СЊ: РІСЃРµ С‚Р°Р±Р»РёС†С‹ СЃРѕР·РґР°РЅС‹

# 5. Р­РєСЃРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ С‚РёРїС‹ РІ TypeScript
supabase gen types typescript --schema public > packages/shared-types/database.types.ts

# 6. Р—Р°РїРѕР»РЅРёС‚СЊ СЃРїСЂР°РІРѕС‡РЅРёРєРё (seed data)
# вЂ” РљРѕРЅС‚СЂР°РіРµРЅС‚РѕРІ РґРѕР±Р°РІРёС‚СЊ РІСЂСѓС‡РЅСѓСЋ РІ Dashboard
# вЂ” РњР°С€РёРЅС‹ РґРѕР±Р°РІРёС‚СЊ С‡РµСЂРµР· Setup Wizard
```

---

## 8. Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ

```bash
# Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ:
pg_dump postgresql://user:password@host/db > backup.sql

# Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ:
psql postgresql://user:password@host/db < backup.sql
```

---

## РС‚РѕРіРѕ

вњ… **РџРѕР»РЅР°СЏ Supabase СЃС…РµРјР° РіРѕС‚РѕРІР° Рє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё**  
вњ… **Р’СЃРµ С‚Р°Р±Р»РёС†С‹, РёРЅРґРµРєСЃС‹, С‚СЂРёРіРіРµСЂС‹, RLS**  
вњ… **Р”РІСѓС…РѕСЃРЅС‹Р№ СЃС‚Р°С‚СѓСЃ СЂРµР°Р»РёР·РѕРІР°РЅ РЅР° СѓСЂРѕРІРЅРµ Р‘Р”**  
вњ… **РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ С‡РµСЂРµР· pg_cron Рё С‚СЂРёРіРіРµСЂС‹**  

**РЎР»РµРґСѓСЋС‰РёР№ С„Р°Р№Р»:** ENVIRONMENT.md (РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ)
