# SaldaCargo Р Р†Р вЂљРІР‚Сњ Р В РЎСџР В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Р В РЎв„ўР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р В Р’В° Supabase

**Р В Р Р‹Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњР РЋР С“:** MVP-ready  
**Р В РІР‚в„ўР В Р’ВµР РЋР вЂљР РЋР С“Р В РЎвЂР РЋР РЏ:** 2.3  
**Р В РЎС›Р В РЎвЂР В РЎвЂ” Р В РІР‚ВР В РІР‚Сњ:** PostgreSQL (Supabase)  

---

## 1. Р В Р’ВР В Р вЂ¦Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В Р’В°Р В Р’В»Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ Supabase

```bash
# 1. Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В Р’ВµР В РЎвЂќР РЋРІР‚С™ Р В Р вЂ¦Р В Р’В° supabase.com
# - Р В Р’В Р В Р’ВµР В РЎвЂ“Р В РЎвЂР В РЎвЂўР В Р вЂ¦: Europe (Frankfurt) Р В РўвЂР В Р’В»Р РЋР РЏ Р В Р вЂ¦Р В РЎвЂР В Р’В·Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В»Р В Р’В°Р РЋРІР‚С™Р В Р’ВµР В Р вЂ¦Р РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В РЎвЂР В Р’В· Р В Р Р‹Р В Р’В°Р В Р’В»Р В РўвЂР РЋРІР‚в„–
# - Р В РІР‚в„ўР В Р’ВµР РЋР вЂљР РЋР С“Р В РЎвЂР РЋР РЏ PostgreSQL: 14+

# 2. Р В Р Р‹Р В РЎвЂќР В РЎвЂўР В РЎвЂ”Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В РЎвЂ Р В РЎвЂР В Р’В· Project Settings:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY (Р В РўвЂР В Р’В»Р РЋР РЏ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В°)
# - SUPABASE_SERVICE_ROLE_KEY (Р В РўвЂР В Р’В»Р РЋР РЏ Р РЋР С“Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р’ВµР РЋР вЂљР В Р’В°)

# 3. Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚С™Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р РЋРІР‚в„–: Р В Р’В·Р В Р’В°Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ SQL Р В Р вЂ  Supabase SQL Editor
```

---

## 2. Р В РЎСџР В РЎвЂєР В РІР‚С”Р В РЎСљР В Р’В«Р В РІвЂћСћ SQL INIT SCRIPT

Р В Р Р‹Р В РЎвЂќР В РЎвЂўР В РЎвЂ”Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р В Р’ВµР РЋР С“Р РЋР Р‰ Р В РЎвЂќР В РЎвЂўР В РўвЂ Р В Р вЂ¦Р В РЎвЂР В Р’В¶Р В Р’Вµ Р В Р вЂ  Supabase Р Р†РІР‚В РІР‚в„ў SQL Editor Р Р†РІР‚В РІР‚в„ў Run.

```sql
-- ============================================================
-- 0. EXTENSIONS & UTILS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- 1. CORE TABLES (Р В Р Р‹Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂ Р В РЎвЂ Р В РЎвЂўР РЋР С“Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р РЋР С“Р РЋРЎвЂњР РЋРІР‚В°Р В Р вЂ¦Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂ)
-- ============================================================

-- LEGAL_ENTITIES (Р В Р’В®Р РЋР вЂљР В Р’В»Р В РЎвЂР РЋРІР‚В Р В Р’В°)
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

-- BUSINESS_UNITS (Р В РЎСљР В Р’В°Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В Р’В±Р В РЎвЂР В Р’В·Р В Р вЂ¦Р В Р’ВµР РЋР С“Р В Р’В°)
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'LOGISTICS_LCV_CITY', 'LOGISTICS_TRUCK'
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ASSET_TYPES (Р В РЎС›Р В РЎвЂР В РЎвЂ”Р РЋРІР‚в„– Р В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р В РЎвЂўР В Р вЂ : Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РІвЂћвЂ“, Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В РЎвЂ Р РЋРІР‚С™.Р В РўвЂ.)
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'VALDAI_6M', 'GAZELLE_3M'
  name TEXT NOT NULL,
  default_fuel_rate DECIMAL(5,2), -- Р В Р’В»Р В РЎвЂР РЋРІР‚С™Р РЋР вЂљР РЋРІР‚в„– Р В Р вЂ¦Р В Р’В° 100Р В РЎвЂќР В РЎВ
  has_gps BOOLEAN DEFAULT false,
  requires_odometer_photo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USERS (Р В РЎСџР В Р’ВµР РЋР вЂљР РЋР С“Р В РЎвЂўР В Р вЂ¦Р В Р’В°Р В Р’В»: Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р В РЎвЂ, Р В РЎВР В Р’ВµР РЋРІР‚В¦Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂ, Р В Р’В°Р В РўвЂР В РЎВР В РЎвЂР В Р вЂ¦)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_user_id TEXT UNIQUE, -- ID Р В РЎвЂР В Р’В· MAX OAuth
  phone TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','dispatcher','driver','mechanic','mechanic_lead','loader','accountant')),
  is_active BOOLEAN DEFAULT true,
  current_asset_id UUID, -- Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰ Р Р†Р вЂљРІР‚Сњ Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР В Р’ВµР В РЎвЂ”Р В Р’В»Р РЋРІР‚ВР В Р вЂ¦Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Р В РЎВР В Р’В°Р РЋРІвЂљВ¬Р В РЎвЂР В Р вЂ¦Р В Р’В°
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT fk_current_asset FOREIGN KEY (current_asset_id) REFERENCES asset_types(id)
);

-- ASSETS (Р В РЎвЂ™Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂ”Р В Р’В°Р РЋР вЂљР В РЎвЂќ: Р В РЎВР В Р’В°Р РЋРІвЂљВ¬Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„–, Р В РЎвЂўР В Р’В±Р В РЎвЂўР РЋР вЂљР РЋРЎвЂњР В РўвЂР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  business_unit_id UUID REFERENCES business_units(id),
  legal_entity_id UUID REFERENCES legal_entities(id),
  
  plate_number TEXT UNIQUE NOT NULL, -- Р В РЎвЂ™099Р В РЎвЂ™Р В РЎвЂ™
  vin TEXT UNIQUE,
  year INT,
  odometer_current INT DEFAULT 0,
  
  -- Р В РЎвЂ™Р В РЎС™Р В РЎвЂєР В Р’В Р В РЎС›Р В Р’ВР В РІР‚вЂќР В РЎвЂ™Р В Р’В¦Р В Р’ВР В Р вЂЎ Р В РЎСџР В РЎвЂє Р В РЎвЂєР В Р Р‹Р В РЎС›Р В РЎвЂ™Р В РЎС›Р В РЎвЂєР В Р’В§Р В РЎСљР В РЎвЂєР В РІвЂћСћ Р В Р Р‹Р В РЎС›Р В РЎвЂєР В Р’ВР В РЎС™Р В РЎвЂєР В Р Р‹Р В РЎС›Р В Р’В
  residual_value DECIMAL(12,2) NOT NULL, -- Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В Р’В°Р РЋР РЏ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰
  remaining_life_months INT NOT NULL, -- Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р РЋРІвЂљВ¬Р В РЎвЂР В РІвЂћвЂ“Р РЋР С“Р РЋР РЏ Р РЋР С“Р РЋР вЂљР В РЎвЂўР В РЎвЂќ Р В Р вЂ  Р В РЎВР В Р’ВµР РЋР С“
  monthly_depreciation DECIMAL(12,2) GENERATED ALWAYS AS (residual_value / remaining_life_months) STORED,
  current_book_value DECIMAL(12,2), -- Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’В°Р РЋР РЏ (Р РЋРЎвЂњР В РЎВР В Р’ВµР В Р вЂ¦Р РЋР Р‰Р РЋРІвЂљВ¬Р В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’ВµР В Р’В¶Р В Р’ВµР В РЎВР В Р’ВµР РЋР С“Р РЋР РЏР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂў)
  
  -- GPS
  wialon_object_id TEXT,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active','repair','reserve','sold','written_off')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- WALLETS (Р В РЎв„ўР В РЎвЂўР РЋРІвЂљВ¬Р В Р’ВµР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂ: Р В РЎвЂќР В Р’В°Р РЋР С“Р РЋР С“Р В Р’В°, Р РЋР вЂљ/Р РЋР С“, Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂўР РЋРІР‚С™Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™Р РЋРІР‚в„–)
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

-- CATEGORIES (Р В РЎв„ўР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР В РЎвЂ Р В РўвЂР В РЎвЂўР РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В РЎвЂўР В Р вЂ /Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В РЎвЂўР В Р вЂ )
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'FREIGHT_LCV_CITY', 'FUEL', 'PAYROLL_DRIVER'
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
  parent_id UUID REFERENCES categories(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- COUNTERPARTIES (Р В РЎв„ўР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРІР‚в„– Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р РЋРІР‚В°Р В РЎвЂР В РЎвЂќР В РЎвЂ)
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
-- 2. LOGISTICS (Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋР С“Р РЋРІР‚в„– Р В РЎвЂ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„–)
-- ============================================================

-- TRIPS (Р В РЎСџР РЋРЎвЂњР РЋРІР‚С™Р В Р’ВµР В Р вЂ Р РЋРІР‚в„–Р В Р’Вµ Р В Р’В»Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„–)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  loader_id UUID REFERENCES users(id), -- Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р РЋРІР‚РЋР В РЎвЂР В РЎвЂќ
  
  trip_type TEXT DEFAULT 'local' CHECK (trip_type IN ('local','intercity','moving','hourly')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- Р В РЎвЂєР В РўвЂР В РЎвЂўР В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљ
  odometer_start INT,
  odometer_end INT,
  odometer_start_photo TEXT, -- URL Р В Р вЂ  Supabase Storage
  odometer_end_photo TEXT,
  
  -- GPS (Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РІвЂћвЂ“)
  gps_verified_mileage INT,
  gps_deviation_percent DECIMAL(5,2),
  gps_alert BOOLEAN DEFAULT false,
  
  route_description TEXT,
  
  -- Р В РІР‚СњР В РІР‚в„ўР В Р в‚¬Р В РўС’Р В РЎвЂєР В Р Р‹Р В РЎСљР В Р’В«Р В РІвЂћСћ Р В Р Р‹Р В РЎС›Р В РЎвЂ™Р В РЎС›Р В Р в‚¬Р В Р Р‹
  lifecycle_status TEXT DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','approved','cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_ORDERS Р Р†Р’В­РЎвЂ™ Р В РЎСљР В РЎвЂєР В РІР‚в„ўР В РЎвЂ™Р В Р вЂЎ Р В РЎС›Р В РЎвЂ™Р В РІР‚ВР В РІР‚С”Р В Р’ВР В Р’В¦Р В РЎвЂ™ - Р В Р Р‹Р В РЎС›Р В Р’В Р В РЎвЂєР В РЎв„ўР В Р’В Р В РЎСџР В Р в‚¬Р В РЎС›Р В РІР‚СћР В РІР‚в„ўР В РЎвЂєР В РІР‚СљР В РЎвЂє Р В РІР‚С”Р В Р’ВР В Р Р‹Р В РЎС›Р В РЎвЂ™
CREATE TABLE trip_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  
  order_number INT NOT NULL, -- 1, 2, 3...
  counterparty_id UUID REFERENCES counterparties(id),
  client_name TEXT, -- Р РЋР С“Р В Р вЂ Р В РЎвЂўР В Р’В±Р В РЎвЂўР В РўвЂР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚С™ ("Р В РІР‚С”Р В Р’ВµР В Р вЂ Р РЋРІвЂљВ¬Р В Р’В°", "Р В Р’В±/Р В Р вЂ¦")
  description TEXT, -- "Р В РЎСџР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’ВµР В Р’В·Р В РўвЂ", "Р В РІР‚СњР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂќР В Р’В°"
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  
  -- Р В РІР‚вЂќР В РЎСџ Р В Р’В Р В Р в‚¬Р В Р’В§Р В РЎСљР В РЎвЂєР В РІвЂћСћ Р В РІР‚в„ўР В РІР‚в„ўР В РЎвЂєР В РІР‚Сњ
  driver_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  loader_pay DECIMAL(12,2) DEFAULT 0,
  driver_pay_percent DECIMAL(5,2), -- Р В РЎвЂР В Р вЂ¦Р РЋРІР‚С›Р В РЎвЂўР РЋР вЂљР В РЎВР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂўР В Р вЂ¦Р В Р вЂ¦Р В РЎвЂўР В Р’Вµ: driver_pay/amount*100
  
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash',           -- Р В Р вЂ¦Р В Р’В°Р В Р’В»Р В РЎвЂР РЋРІР‚РЋР В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ
    'qr',             -- QR Р В Р вЂ¦Р В Р’В° Р РЋР вЂљ/Р РЋР С“ (Р В РЎвЂ”Р РЋР вЂљР В РЎвЂР РЋРІР‚В¦Р В РЎвЂўР В РўвЂ Р В РЎВР В РЎвЂ“Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’ВµР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“)
    'bank_invoice',   -- Р РЋР С“Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРЎвЂњ (Р В РўвЂР В Р’ВµР В Р’В±Р В РЎвЂР РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂќР В Р’В°)
    'debt_cash',      -- Р В РўвЂР В РЎвЂўР В Р’В»Р В РЎвЂ“ Р В Р вЂ¦Р В Р’В°Р В Р’В»Р В РЎвЂР РЋРІР‚РЋР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“
    'card_driver'     -- Р В Р вЂ¦Р В Р’В° Р В РЎвЂќР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р РЋРЎвЂњ Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР РЏ
  )),
  
  settlement_status TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed')),
  -- pending Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В РўвЂР В Р’В»Р РЋР РЏ: bank_invoice Р В РЎвЂ debt_cash
  
  linked_income_tx_id UUID REFERENCES transactions(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP_EXPENSES (Р В Р’В Р В Р’В°Р РЋР С“Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР РЋРІР‚в„– Р В Р вЂ  Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋР С“Р В Р’Вµ)
CREATE TABLE trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card_driver','fuel_card')),
  description TEXT,
  receipt_photo TEXT, -- URL Р РЋРІР‚С›Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂў Р РЋРІР‚РЋР В Р’ВµР В РЎвЂќР В Р’В°
  linked_expense_tx_id UUID REFERENCES transactions(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TRANSACTIONS (Р В Р’В¤Р В РЎвЂР В Р вЂ¦Р В Р’В°Р В Р вЂ¦Р РЋР С“Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР РЏ Р РЋР С“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РЎВР В Р’В°)
-- ============================================================

-- TRANSACTIONS (Р В Р’ВР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќ Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„–)
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
  
  -- Р В РІР‚СњР В РІР‚в„ўР В Р в‚¬Р В РўС’Р В РЎвЂєР В Р Р‹Р В РЎСљР В Р’В«Р В РІвЂћСћ Р В Р Р‹Р В РЎС›Р В РЎвЂ™Р В РЎС›Р В Р в‚¬Р В Р Р‹
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
-- 4. PAYROLL (Р В РІР‚вЂќР В РЎСџ Р В РЎвЂ Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™Р РЋРІР‚в„–)
-- ============================================================

-- PAYROLL_RULES (Р В Р Р‹Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋР С“Р В РЎвЂќР В Р’В°Р В Р’В·Р В РЎвЂўР В РЎвЂќ Р В РўвЂР В Р’В»Р РЋР РЏ Р В РІР‚вЂќР В РЎСџ)
CREATE TABLE payroll_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL, -- "Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ 30%"
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percent', 'per_km', 'fixed_daily', 'hourly_split')),
  value DECIMAL(10,4) NOT NULL,
  split_config JSONB, -- {"driver":0.33, "loader":0.33, "company":0.34}
  
  applies_to_asset_type_id UUID REFERENCES asset_types(id),
  applies_to_trip_type TEXT,
  description TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PAYROLL_PERIODS (Р В Р’В Р В Р’В°Р РЋР С“Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™ Р В РІР‚вЂќР В РЎСџ Р В Р’В·Р В Р’В° Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В РЎвЂР В РЎвЂўР В РўвЂ)
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_trips INT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0, -- SUM(driver_pay Р В РЎвЂР В Р’В»Р В РЎвЂ loader_pay)
  advances_paid DECIMAL(12,2) DEFAULT 0,
  balance_to_pay DECIMAL(12,2) DEFAULT 0,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  calculation_details JSONB, -- Р В РўвЂР В Р’ВµР РЋРІР‚С™Р В Р’В°Р В Р’В»Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. FUEL (Р В РЎС›Р В РЎвЂўР В РЎвЂ”Р В Р’В»Р В РЎвЂР В Р вЂ Р В РЎвЂў Р Р†Р вЂљРІР‚Сњ Р В РЎвЂєР В РЎвЂ”Р РЋРІР‚С™Р В РЎвЂ24)
-- ============================================================

-- FUEL_CARDS (Р В РЎС›Р В РЎвЂўР В РЎвЂ”Р В Р’В»Р В РЎвЂР В Р вЂ Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂќР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р РЋРІР‚в„–)
CREATE TABLE fuel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT UNIQUE NOT NULL,
  asset_id UUID REFERENCES assets(id),
  balance DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FUEL_TRANSACTIONS_RAW (Р В РІР‚вЂќР В Р’В°Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂќР В РЎвЂ Р В РЎвЂР В Р’В· Р В РЎвЂєР В РЎвЂ”Р РЋРІР‚С™Р В РЎвЂ24 API)
CREATE TABLE fuel_transactions_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_card_id UUID REFERENCES fuel_cards(id),
  
  transaction_date TIMESTAMPTZ NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  liters DECIMAL(8,2),
  station_name TEXT,
  
  opti24_transaction_id TEXT UNIQUE,
  
  -- Р В Р Р‹Р В РЎвЂўР В РЎвЂўР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋРІР‚С™Р В Р вЂ Р РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В Р’В°Р РЋР РЏ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР РЋР РЏ Р В Р вЂ  Р В РЎвЂўР РЋР С“Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“ Р РЋР С“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РЎВР В Р’Вµ
  linked_tx_id UUID REFERENCES transactions(id),
  
  is_synced BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. BANK (Р В РІР‚ВР В Р’В°Р В Р вЂ¦Р В РЎвЂќ)
-- ============================================================

-- BANK_STATEMENTS_RAW (Р В РІР‚в„ўР РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂР РЋР С“Р В РЎвЂќР В Р’В° Р В РЎвЂР В Р’В· Р В Р’В±Р В Р’В°Р В Р вЂ¦Р В РЎвЂќР В Р’В°)
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
-- 7. MAINTENANCE (Р В Р Р‹Р В РЎС›Р В РЎвЂє Р В РЎвЂ Р РЋР вЂљР В Р’ВµР В РЎвЂ“Р В Р’В»Р В Р’В°Р В РЎВР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРІР‚в„–)
-- ============================================================

-- MAINTENANCE_REGULATIONS (Р В Р’В Р В Р’ВµР В РЎвЂ“Р В Р’В»Р В Р’В°Р В РЎВР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРІР‚в„– Р В РЎС›Р В РЎвЂє)
CREATE TABLE maintenance_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id),
  
  name TEXT NOT NULL, -- "Р В РЎС›Р В РЎвЂє-1", "Р В РІР‚вЂќР В Р’В°Р В РЎВР В Р’ВµР В Р вЂ¦Р В Р’В° Р В РЎВР В Р’В°Р РЋР С“Р В Р’В»Р В Р’В°"
  description TEXT,
  interval_km INT, -- Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· Р РЋР С“Р В РЎвЂќР В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В РЎвЂќР В РЎВ
  interval_months INT, -- Р В РЎвЂР В Р’В»Р В РЎвЂ Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· Р РЋР С“Р В РЎвЂќР В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В РЎВР В Р’ВµР РЋР С“Р РЋР РЏР РЋРІР‚В Р В Р’ВµР В Р вЂ 
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MAINTENANCE_ALERTS (Р В Р в‚¬Р В Р вЂ Р В Р’ВµР В РўвЂР В РЎвЂўР В РЎВР В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В РЎвЂў Р В РЎС›Р В РЎвЂє)
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

-- SERVICE_ORDERS (Р В РІР‚вЂќР В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·-Р В Р вЂ¦Р В Р’В°Р РЋР вЂљР РЋР РЏР В РўвЂР РЋРІР‚в„–)
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

-- SERVICE_ORDER_WORKS (Р В Р’В Р В Р’В°Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р РЋРІР‚в„– Р В Р вЂ  Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·-Р В Р вЂ¦Р В Р’В°Р РЋР вЂљР РЋР РЏР В РўвЂР В Р’Вµ)
CREATE TABLE service_order_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  
  work_description TEXT NOT NULL,
  cost DECIMAL(12,2),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICE_ORDER_PARTS (Р В РІР‚вЂќР В Р’В°Р В РЎвЂ”Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В РЎвЂ Р В Р вЂ  Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·-Р В Р вЂ¦Р В Р’В°Р РЋР вЂљР РЋР РЏР В РўвЂР В Р’Вµ)
CREATE TABLE service_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  part_id UUID REFERENCES parts(id),
  
  part_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PARTS (Р В РІР‚вЂќР В Р’В°Р В РЎвЂ”Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В РЎвЂ Р Р†Р вЂљРІР‚Сњ Р РЋР С“Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќ)
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

-- PART_MOVEMENTS (Р В Р’ВР В Р вЂ¦Р В Р вЂ Р В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В°Р РЋР вЂљР В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ)
CREATE TABLE part_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(id),
  
  quantity_change INT NOT NULL, -- +5 Р В РЎвЂР В Р’В»Р В РЎвЂ -2
  movement_type TEXT CHECK (movement_type IN ('receipt','usage','adjustment')),
  reference_id UUID, -- Р РЋР С“Р РЋР С“Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂќР В Р’В° Р В Р вЂ¦Р В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·-Р В Р вЂ¦Р В Р’В°Р РЋР вЂљР РЋР РЏР В РўвЂ Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂќР РЋРЎвЂњ
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. EQUIPMENT (Р В РЎвЂєР В Р’В±Р В РЎвЂўР РЋР вЂљР РЋРЎвЂњР В РўвЂР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В РЎвЂ Р В РЎвЂР В Р вЂ¦Р В Р вЂ Р В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В°Р РЋР вЂљР РЋР Р‰)
-- ============================================================

-- FIXED_ASSETS (Р В РЎвЂєР РЋР С“Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р РЋР С“Р РЋР вЂљР В Р’ВµР В РўвЂР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р В Р’В°)
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

-- TOOLS (Р В Р’ВР В Р вЂ¦Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР РЋРЎвЂњР В РЎВР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРІР‚в„–)
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

-- AUDIT_LOG (Р В РІР‚С”Р В РЎвЂўР В РЎвЂ“ Р В Р вЂ Р РЋР С“Р В Р’ВµР РЋРІР‚В¦ Р В РЎвЂР В Р’В·Р В РЎВР В Р’ВµР В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“)
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

-- ATTACHMENTS (Р В Р’В¤Р В Р’В°Р В РІвЂћвЂ“Р В Р’В»Р РЋРІР‚в„–)
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

-- Р В Р’ВР В Р вЂ¦Р В РўвЂР В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚в„– Р В РўвЂР В Р’В»Р РЋР РЏ Р В Р’В±Р РЋРІР‚в„–Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚В¦ Р В Р’В·Р В Р’В°Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР РЋР С“Р В РЎвЂўР В Р вЂ 
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

-- Р В РІР‚в„ўР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р РЋР Р‰ RLS Р В Р вЂ¦Р В Р’В° Р РЋРІР‚С™Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р РЋРІР‚в„–
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Р В РЎСџР РЋР вЂљР В РЎвЂР В РЎВР В Р’ВµР РЋР вЂљР РЋРІР‚в„– Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В РЎвЂР РЋРІР‚С™Р В РЎвЂР В РЎвЂќ (Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂў Р В Р’В°Р В Р вЂ¦Р В Р’В°Р В Р’В»Р В РЎвЂўР В РЎвЂ“Р В РЎвЂР В РЎвЂ)

-- Policy: Р В РІР‚в„ўР В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В Р вЂ Р В РЎвЂР В РўвЂР В РЎвЂР РЋРІР‚С™ Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р РЋР С“Р В Р вЂ Р В РЎвЂўР В РЎвЂ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋР С“Р РЋРІР‚в„–
CREATE POLICY driver_view_own_trips ON trips
  FOR SELECT
  USING (driver_id = auth.uid() OR loader_id = auth.uid());

-- Policy: Р В РІР‚в„ўР В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В Р вЂ Р В РЎвЂР В РўвЂР В РЎвЂР РЋРІР‚С™ Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„– Р В РЎвЂР В Р’В· Р РЋР С“Р В Р вЂ Р В РЎвЂўР В РЎвЂР РЋРІР‚В¦ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋР С“Р В РЎвЂўР В Р вЂ 
CREATE POLICY driver_view_own_orders ON trip_orders
  FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE driver_id = auth.uid() OR loader_id = auth.uid()
    )
  );

-- Policy: Р В РІР‚в„ўР В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰ Р В РЎВР В РЎвЂўР В Р’В¶Р В Р’ВµР РЋРІР‚С™ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„– Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р В Р вЂ  Р РЋР С“Р В Р вЂ Р В РЎвЂўР В РЎвЂР РЋРІР‚В¦ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋР С“Р В Р’В°Р РЋРІР‚В¦
CREATE POLICY driver_create_orders ON trip_orders
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips 
      WHERE driver_id = auth.uid()
    )
  );

-- Policy: Р В РЎвЂ™Р В РўвЂР В РЎВР В РЎвЂР В Р вЂ¦ Р В Р вЂ Р В РЎвЂР В РўвЂР В РЎвЂР РЋРІР‚С™ Р В Р вЂ Р РЋР С“Р РЋРІР‚В
CREATE POLICY admin_all_access ON trips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ============================================================
-- 12. INITIAL DATA (Р В Р Р‹Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂ)
-- ============================================================

-- Asset Types
INSERT INTO asset_types (code, name, default_fuel_rate, has_gps, requires_odometer_photo)
VALUES
  ('VALDAI_6M', 'Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РІвЂћвЂ“ 6 Р В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљР В РЎвЂўР В Р вЂ ', 15.0, true, false),
  ('VALDAI_5M', 'Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РІвЂћвЂ“ 5 Р В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљР В РЎвЂўР В Р вЂ ', 14.0, true, false),
  ('VALDAI_DUMP', 'Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РІвЂћвЂ“ Р В Р Р‹Р В Р’В°Р В РЎВР В РЎвЂўР РЋР С“Р В Р вЂ Р В Р’В°Р В Р’В»', 16.0, true, false),
  ('GAZELLE_4M', 'Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р РЋР Р‰ 4 Р В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљР В Р’В° (Р В РЎВР В Р’ВµР В Р’В¶Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ)', 12.0, false, true),
  ('GAZELLE_3M', 'Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р РЋР Р‰ 3 Р В РЎВР В Р’ВµР РЋРІР‚С™Р РЋР вЂљР В Р’В° (Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ)', 11.0, false, true),
  ('CANTER_5T', 'Р В РЎв„ўР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР РЋР вЂљ 5Р РЋРІР‚С™', 13.0, false, true);

-- Business Units
INSERT INTO business_units (code, name)
VALUES
  ('LOGISTICS_LCV_CITY', 'Р В РІР‚С”Р В РЎвЂўР В РЎвЂ“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂР В РЎвЂќР В Р’В° LCV Р Р†Р вЂљРІР‚Сњ Р В РІР‚СљР В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ'),
  ('LOGISTICS_LCV_INTERCITY', 'Р В РІР‚С”Р В РЎвЂўР В РЎвЂ“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂР В РЎвЂќР В Р’В° LCV Р Р†Р вЂљРІР‚Сњ Р В РЎС™Р В Р’ВµР В Р’В¶Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ'),
  ('LOGISTICS_TRUCK', 'Р В РІР‚С”Р В РЎвЂўР В РЎвЂ“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂР В РЎвЂќР В Р’В° Р В РІР‚СљР РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂўР В Р вЂ Р В РЎвЂР В РЎвЂќР В РЎвЂ'),
  ('LOGISTICS_5T', 'Р В РІР‚С”Р В РЎвЂўР В РЎвЂ“Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂР В РЎвЂќР В Р’В° 5-Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ¦Р В Р вЂ¦Р В РЎвЂР В РЎвЂќ'),
  ('SERVICE_STATION', 'Р В Р Р‹Р В РЎС›Р В РЎвЂє'),
  ('BULK_MATERIALS', 'Р В Р Р‹Р РЋРІР‚в„–Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚РЋР В РЎвЂР В Р’Вµ Р В РЎВР В Р’В°Р РЋРІР‚С™Р В Р’ВµР РЋР вЂљР В РЎвЂР В Р’В°Р В Р’В»Р РЋРІР‚в„–'),
  ('PARTS_SHOP', 'Р В РЎС™Р В Р’В°Р В РЎвЂ“Р В Р’В°Р В Р’В·Р В РЎвЂР В Р вЂ¦ Р В Р’В·Р В Р’В°Р В РЎвЂ”Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РІвЂћвЂ“'),
  ('PARKING', 'Р В РЎСџР В Р’В»Р В Р’В°Р РЋРІР‚С™Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР РЏР В Р вЂ¦Р В РЎвЂќР В Р’В°');

-- Categories (Income)
INSERT INTO categories (code, name, direction)
VALUES
  ('FREIGHT_LCV_CITY', 'Р В РІР‚СњР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂќР В Р’В° Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ (Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р В РЎвЂ)', 'income'),
  ('FREIGHT_LCV_INTERCITY', 'Р В РЎС™Р В Р’ВµР В Р’В¶Р В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РўвЂ (Р В РІР‚СљР В Р’В°Р В Р’В·Р В Р’ВµР В Р’В»Р В РЎвЂ)', 'income'),
  ('FREIGHT_TRUCK', 'Р В РІР‚СљР РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В Р вЂ Р В РЎвЂўР В Р’В·Р В РЎвЂќР В РЎвЂ (Р В РІР‚в„ўР В Р’В°Р В Р’В»Р В РўвЂР В Р’В°Р В РЎвЂ)', 'income'),
  ('FREIGHT_5T', 'Р В РІР‚СљР РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В Р вЂ Р В РЎвЂўР В Р’В·Р В РЎвЂќР В РЎвЂ (Р В РЎв„ўР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР РЋР вЂљ)', 'income'),
  ('MOVING', 'Р В РЎСџР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’ВµР В Р’В·Р В РўвЂР РЋРІР‚в„–', 'income'),
  ('SERVICE_WORKS', 'Р В Р в‚¬Р РЋР С“Р В Р’В»Р РЋРЎвЂњР В РЎвЂ“Р В РЎвЂ Р В Р Р‹Р В РЎС›Р В РЎвЂє (Р РЋР вЂљР В Р’В°Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р РЋРІР‚в„–)', 'income'),
  ('SERVICE_PARTS_SALE', 'Р В РЎСџР РЋР вЂљР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В¶Р В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂ”Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РІвЂћвЂ“ (Р В Р Р‹Р В РЎС›Р В РЎвЂє)', 'income'),
  ('BULK_SALES', 'Р В РЎСџР РЋР вЂљР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В¶Р В Р’В° Р РЋР С“Р РЋРІР‚в„–Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚РЋР В РЎвЂР РЋРІР‚В¦', 'income'),
  ('PARKING_RENT', 'Р В РЎвЂ™Р РЋР вЂљР В Р’ВµР В Р вЂ¦Р В РўвЂР В Р’В° Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР РЏР В Р вЂ¦Р В РЎвЂќР В РЎвЂ', 'income');

-- Categories (Expense)
INSERT INTO categories (code, name, direction)
VALUES
  ('FUEL', 'Р В РІР‚СљР В Р Р‹Р В РЎС™', 'expense'),
  ('REPAIR_PARTS', 'Р В Р’В Р В Р’ВµР В РЎВР В РЎвЂўР В Р вЂ¦Р РЋРІР‚С™ Р Р†Р вЂљРІР‚Сњ Р В Р’В·Р В Р’В°Р В РЎвЂ”Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В РЎвЂ', 'expense'),
  ('PAYROLL_DRIVER', 'Р В РІР‚вЂќР В РЎСџ Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР РЏ', 'expense'),
  ('PAYROLL_LOADER', 'Р В РІР‚вЂќР В РЎСџ Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р РЋРІР‚РЋР В РЎвЂР В РЎвЂќР В Р’В°', 'expense'),
  ('DEPRECIATION_VEHICLE', 'Р В РЎвЂ™Р В РЎВР В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р РЋР С“Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р В Р’В°', 'expense'),
  ('RENT', 'Р В РЎвЂ™Р РЋР вЂљР В Р’ВµР В Р вЂ¦Р В РўвЂР В Р’В°', 'expense'),
  ('UTILITIES', 'Р В РЎв„ўР В РЎвЂўР В РЎВР В РЎВР РЋРЎвЂњР В Р вЂ¦Р В Р’В°Р В Р’В»Р В РЎвЂќР В Р’В°', 'expense'),
  ('INSURANCE', 'Р В Р Р‹Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р РЋРІР‚В¦Р В РЎвЂўР В Р вЂ Р В РЎвЂќР В РЎвЂ', 'expense');

-- ============================================================
-- 13. DATA FLOWS (Р вЂР С‘Р В·Р Р…Р ВµРЎРѓ-Р В»Р С•Р С–Р С‘Р С”Р В°)
-- ============================================================

-- [M] Р вЂ™Р С•Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉ -> "Р СњР В°РЎвЂЎР В°РЎвЂљРЎРЉ РЎР‚Р ВµР в„–РЎРѓ":
--   1. Р вЂ™РЎвЂ№Р В±Р С•РЎР‚ Р СР В°РЎв‚¬Р С‘Р Р…РЎвЂ№ + Р С›Р Т‘Р С•Р СР ВµРЎвЂљРЎР‚ + Р В¤Р С•РЎвЂљР С•
--   -> INSERT trip (status: in_progress, lifecycle: draft)

-- [M] Р вЂ™Р С•Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉ -> "+ Р вЂ”Р В°Р С”Р В°Р В·":
--   1. Р РЋРЎС“Р СР СР В° + Р вЂ”Р Сџ (Р Р†Р Р†Р С•Р Т‘ Р Р†РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹) + Р РЋР С—Р С•РЎРѓР С•Р В± Р С•Р С—Р В»Р В°РЎвЂљРЎвЂ№
--   -> INSERT trip_orders
--   -> INSERT transaction (income, draft)

-- [D] Admin -> "Р В Р ВµР Р†РЎРЉРЎР‹ РЎРѓР СР ВµР Р…РЎвЂ№":
--   -> Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° % Р вЂ”Р Сџ (Р С—Р С•Р Т‘РЎРѓР Р†Р ВµРЎвЂљР С”Р В° 25-40%)
--   -> Р С™Р Р…Р С•Р С—Р С”Р В° "Р Р€РЎвЂљР Р†Р ВµРЎР‚Р Т‘Р С‘РЎвЂљРЎРЉ"
--   -> UPDATE trip + orders + transactions -> lifecycle: approved

```sql
-- Р СџРЎР‚Р С‘Р СР ВµРЎР‚: Р ВРЎвЂљР С•Р С–Р С• Р вЂ”Р Сџ Р В·Р В° РЎР‚Р ВµР в„–РЎРѓ
SELECT SUM(driver_pay) FROM trip_orders WHERE trip_id = '...';
```

---

## 3. Р В РІР‚СњР В РЎвЂР В Р’В°Р В РЎвЂ“Р РЋР вЂљР В Р’В°Р В РЎВР В РЎВР В Р’В° Р В РЎвЂўР РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂўР РЋРІвЂљВ¬Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“ (Entity Relationship Diagram)

```
Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
Р Р†РІР‚СњРІР‚С™  LEGAL_ENTITIES Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
         Р Р†РІР‚СњРІР‚С™ (1:N)
         Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРўвЂР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
    Р Р†РІР‚СњРІР‚С™             Р Р†РІР‚СњРІР‚С™            Р Р†РІР‚СњРІР‚С™             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™  Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™  Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™  Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
Р Р†РІР‚СњРІР‚С™ASSETSР Р†РІР‚СњРІР‚С™  Р Р†РІР‚СњРІР‚С™WALLETS  Р Р†РІР‚СњРІР‚С™  Р Р†РІР‚СњРІР‚С™USERS    Р Р†РІР‚СњРІР‚С™  Р Р†РІР‚СњРІР‚С™BUSINESS_Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В  Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В  Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В  Р Р†РІР‚СњРІР‚С™  UNITS  Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™                         Р Р†РІР‚СњРІР‚С™     Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
    Р Р†РІР‚СњРІР‚С™ (1:N)                   Р Р†РІР‚СњРІР‚С™ (1:N)
    Р Р†РІР‚СњРІР‚С™                         Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРЎС™Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ TRIPS             Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - asset_id        Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - driver_id       Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - loader_id       Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - lifecycle_statusР Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - settlement_*    Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™ (1:N)
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ TRIP_ORDERS       Р Р†РІР‚СњРІР‚С™Р Р†РІР‚вЂќРІР‚С›Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљ payment_method
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - amount          Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - driver_pay      Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - loader_pay      Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚С™ - settlement_*    Р Р†РІР‚СњРІР‚С™
    Р Р†РІР‚СњРІР‚С™    Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™ (1:1)
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™ linked_income_tx_id
    Р Р†РІР‚СњРІР‚С™         Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
Р Р†РІР‚СњРІР‚С™ TRANSACTIONS (Р В Р’ВР В Р Р‹Р В РЎС›Р В РЎвЂєР В Р’В§Р В РЎСљР В Р’ВР В РЎв„ў Р В Р’ВР В Р Р‹Р В РЎС›Р В Р’ВР В РЎСљР В Р’В«)              Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљ Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - direction (income/expense/transfer)       Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - amount                                    Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - from_wallet_id Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - to_wallet_id    Р Р†РІР‚СњРІР‚С™          Р Р†РІР‚СњРІР‚С™             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - category_id     Р Р†РІР‚СњРІР‚С™    WALLETSР Р†РІР‚СњРІР‚С™             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - lifecycle_statusР Р†РІР‚СњРІР‚С™          Р Р†РІР‚СњРІР‚С™             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - settlement_st.  Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В             Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ - trip_id         (Р В РЎвЂќР В Р’В°Р В Р’В¶Р В РўвЂР В Р’В°Р РЋР РЏ TР Р†РІР‚В РІР‚в„ў Р В РЎвЂўР В РўвЂР В Р вЂ¦Р В Р’В° Р В РЎвЂР В Р’В· Wallets)
Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В

PAYROLL:
Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
Р Р†РІР‚СњРІР‚С™ PAYROLL_RULESР Р†РІР‚СњРІР‚С™ (Р РЋР С“Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋР С“Р В РЎвЂќР В Р’В°Р В Р’В·Р В РЎвЂўР В РЎвЂќ)
Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В

Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
Р Р†РІР‚СњРІР‚С™ TRIP_ORDERS            Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ + driver_pay           Р Р†РІР‚СњРІР‚С™Р Р†РІР‚вЂќРІР‚С›Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљ Р В Р вЂ Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р вЂ Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р РЋРЎвЂњР РЋР вЂ№
Р Р†РІР‚СњРІР‚С™ + loader_pay           Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚С™ + driver_pay_percent   Р Р†РІР‚СњРІР‚С™
Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В¬Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
           Р Р†РІР‚СњРІР‚С™ (SUM Р В Р’В·Р В Р’В° Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В РЎвЂР В РЎвЂўР В РўвЂ)
           Р Р†РІР‚СњРІР‚С™
        Р Р†РІР‚СњР Р‰Р Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚вЂњРЎВР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњРЎвЂ™
        Р Р†РІР‚СњРІР‚С™ PAYROLL_PERIODS     Р Р†РІР‚СњРІР‚С™
        Р Р†РІР‚СњРІР‚С™ - total_earned      Р Р†РІР‚СњРІР‚С™
        Р Р†РІР‚СњРІР‚С™ - balance_to_pay    Р Р†РІР‚СњРІР‚С™
        Р Р†РІР‚СњРІР‚СњР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР вЂљР Р†РІР‚СњР’В
```

---

## 4. Р В РЎС›Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р В Р’В° Р РЋР С“Р В РЎвЂў Р В Р вЂ Р РЋР С“Р В Р’ВµР В РЎВР В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋР РЏР В РЎВР В РЎвЂ (Р РЋР С“Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќ Р В РўвЂР В Р’В»Р РЋР РЏ Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋР вЂљР В Р’В°Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р РЋРІР‚РЋР В РЎвЂР В РЎвЂќР В Р’В°)

| Р В РЎС›Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р В Р’В° | Р В РЎСџР В РЎвЂўР В Р’В»Р В Р’Вµ | Р В РЎС›Р В РЎвЂР В РЎвЂ” | Constraints | Р В РЎСџР РЋР вЂљР В РЎвЂР В РЎВР В Р’ВµР РЋРІР‚РЋР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ |
|---------|------|-----|-------------|-----------|
| **users** | id | UUID | PK | |
| | max_user_id | TEXT | UNIQUE | Р В Р’ВР В Р’В· MAX OAuth |
| | phone | TEXT | | |
| | full_name | TEXT | NOT NULL | |
| | role | TEXT | CHECK 8 Р В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ  | owner, admin, driver Р В РЎвЂ Р РЋРІР‚С™.Р В РўвЂ. |
| | current_asset_id | UUID | FK Р Р†РІР‚В РІР‚в„ў assets | Р В РІР‚СњР В Р’В»Р РЋР РЏ Р В Р вЂ Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР РЏ |
| **assets** | id | UUID | PK | |
| | asset_type_id | UUID | FK Р Р†РІР‚В РІР‚в„ў asset_types | |
| | plate_number | TEXT | UNIQUE | Р В РІР‚СљР В РЎвЂўР РЋР С“Р В Р вЂ¦Р В РЎвЂўР В РЎВР В Р’ВµР РЋР вЂљ |
| | residual_value | DECIMAL(12,2) | NOT NULL | Р В РЎвЂєР РЋР С“Р РЋРІР‚С™. Р РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎвЂР В РЎВР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р РЋР С“Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР В РўвЂР В Р вЂ¦Р РЋР РЏ |
| | remaining_life_months | INT | NOT NULL | Р В РЎвЂєР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р РЋРІвЂљВ¬Р В РЎвЂР РЋРІР‚В¦Р РЋР С“Р РЋР РЏ Р В РЎВР В Р’ВµР РЋР С“Р РЋР РЏР РЋРІР‚В Р В Р’ВµР В Р вЂ  |
| | monthly_depreciation | DECIMAL(12,2) | GENERATED | Р В РІР‚в„ўР РЋРІР‚в„–Р РЋРІР‚РЋР В РЎвЂР РЋР С“Р В Р’В»Р РЋР РЏР В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р В РЎвЂќР В РЎвЂ |
| | current_book_value | DECIMAL(12,2) | | Р В Р в‚¬Р В РЎВР В Р’ВµР В Р вЂ¦Р РЋР Р‰Р РЋРІвЂљВ¬Р В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’ВµР В Р’В¶Р В Р’ВµР В РЎВР В Р’ВµР РЋР С“Р РЋР РЏР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂў |
| | odometer_current | INT | DEFAULT 0 | Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В Р’В±Р В Р’ВµР В РЎвЂ“ |
| | wialon_object_id | TEXT | | ID Р В Р вЂ  Wialon (GPS) |
| **wallets** | id | UUID | PK | |
| | code | TEXT | UNIQUE | 'ip_rs', 'cash_office', 'driver_vova' |
| | type | TEXT | CHECK 5 Р В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ  | bank_account, cash_register Р В РЎвЂ Р РЋРІР‚С™.Р В РўвЂ. |
| | owner_user_id | UUID | FK Р Р†РІР‚В РІР‚в„ў users | Р В РІР‚СњР В Р’В»Р РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂўР РЋРІР‚С™Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™Р В Р’В° |
| **trips** | id | UUID | PK | |
| | asset_id | UUID | FK Р Р†РІР‚В РІР‚в„ў assets | |
| | driver_id | UUID | FK Р Р†РІР‚В РІР‚в„ў users | NOT NULL |
| | loader_id | UUID | FK Р Р†РІР‚В РІР‚в„ў users | Р В РЎвЂєР В РЎвЂ”Р РЋРІР‚В Р В РЎвЂР В РЎвЂўР В Р вЂ¦Р В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂў |
| | started_at | TIMESTAMPTZ | NOT NULL | |
| | ended_at | TIMESTAMPTZ | | |
| | lifecycle_status | TEXT | draft/approved/cancelled | **Р В РЎв„ўР В РІР‚С”Р В Р’В®Р В Р’В§Р В РІР‚СћР В РІР‚в„ўР В РЎвЂєР В РІвЂћСћ** |
| | settlement_status | TEXT | pending/completed | **Р В РЎв„ўР В РІР‚С”Р В Р’В®Р В Р’В§Р В РІР‚СћР В РІР‚в„ўР В РЎвЂєР В РІвЂћСћ** |
| | approved_by | UUID | FK Р Р†РІР‚В РІР‚в„ў users | Р В РЎв„ўР РЋРІР‚С™Р В РЎвЂў Р РЋРЎвЂњР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В РўвЂР В РЎвЂР В Р’В» |
| | approved_at | TIMESTAMPTZ | | Р В РЎв„ўР В РЎвЂўР В РЎвЂ“Р В РўвЂР В Р’В° Р РЋРЎвЂњР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В РўвЂР В РЎвЂР В Р’В» |
| **trip_orders** | id | UUID | PK | |
| | trip_id | UUID | FK Р Р†РІР‚В РІР‚в„ў trips | |
| | order_number | INT | NOT NULL | 1, 2, 3... |
| | amount | DECIMAL(12,2) | NOT NULL > 0 | Р В Р Р‹Р РЋРЎвЂњР В РЎВР В РЎВР В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р В Р’В° |
| | driver_pay | DECIMAL(12,2) | NOT NULL | **Р В Р’В Р В Р в‚¬Р В Р’В§Р В РЎСљР В РЎвЂєР В РІвЂћСћ Р В РІР‚в„ўР В РІР‚в„ўР В РЎвЂєР В РІР‚Сњ** |
| | loader_pay | DECIMAL(12,2) | DEFAULT 0 | **Р В Р’В Р В Р в‚¬Р В Р’В§Р В РЎСљР В РЎвЂєР В РІвЂћСћ Р В РІР‚в„ўР В РІР‚в„ўР В РЎвЂєР В РІР‚Сњ** |
| | driver_pay_percent | DECIMAL(5,2) | | Р В Р’ВР В Р вЂ¦Р РЋРІР‚С›Р В РЎвЂўР РЋР вЂљР В РЎВР В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂўР В Р вЂ¦Р В Р вЂ¦Р В РЎвЂўР В Р’Вµ: driver_pay/amount*100 |
| | payment_method | TEXT | CHECK 5 Р В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ  | cash, qr, bank_invoice, debt_cash, card_driver |
| | settlement_status | TEXT | pending/completed | |
| | linked_income_tx_id | UUID | FK Р Р†РІР‚В РІР‚в„ў transactions | Р В РЎвЂ™Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР РЋР С“Р РЋР С“Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂќР В Р’В° |
| **transactions** | id | UUID | PK | |
| | direction | TEXT | income/expense/transfer | |
| | amount | DECIMAL(12,2) | NOT NULL > 0 | **Р В РІР‚в„ўР В Р Р‹Р В РІР‚СћР В РІР‚СљР В РІР‚СњР В РЎвЂ™ Р вЂњР’В· Р РЋР С“Р РЋР вЂ№Р В РўвЂР В Р’В° Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В° Р РЋР С“Р РЋРЎвЂњР В РЎВР В РЎВР РЋРЎвЂњ Р В РЎвЂР РЋР С“Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В Р вЂ¦Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р В Р’В°** |
| | from_wallet_id | UUID | FK Р Р†РІР‚В РІР‚в„ў wallets | |
| | to_wallet_id | UUID | FK Р Р†РІР‚В РІР‚в„ў wallets | |
| | lifecycle_status | TEXT | **draft/approved/cancelled** | Р В РЎв„ўР РЋРІР‚С™Р В РЎвЂў Р РЋРЎвЂњР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В РўвЂР В РЎвЂР В Р’В» |
| | settlement_status | TEXT | **pending/completed** | Р В РІР‚СњР В Р’ВµР В Р вЂ¦Р РЋР Р‰Р В РЎвЂ“Р В РЎвЂ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР РЋРІвЂљВ¬Р В Р’В»Р В РЎвЂ? |
| | idempotency_key | TEXT | UNIQUE | Р В РІР‚СњР В Р’В»Р РЋР РЏ Р В РЎвЂР В РўвЂР В Р’ВµР В РЎВР В РЎвЂ”Р В РЎвЂўР РЋРІР‚С™Р В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В РЎвЂ |
| | transaction_type | TEXT | CHECK 7 Р РЋРІР‚С™Р В РЎвЂР В РЎвЂ”Р В РЎвЂўР В Р вЂ  | regular, depreciation, payroll Р В РЎвЂ Р РЋРІР‚С™.Р В РўвЂ. |

---

## 5. Р В РЎв„ўР В Р’В°Р В РЎвЂќ Р РЋР С“Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р В Р’В°Р РЋР вЂ№Р РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’В±Р В Р’В°Р В Р’В»Р В Р’В°Р В Р вЂ¦Р РЋР С“Р РЋРІР‚в„– (Р В РЎв„ўР В Р’В Р В Р’ВР В РЎС›Р В Р’ВР В Р’В§Р В РЎСљР В РЎвЂє!)

```sql
-- Р В РІР‚ВР В Р’В°Р В Р’В»Р В Р’В°Р В Р вЂ¦Р РЋР С“ Р В РЎвЂќР В РЎвЂўР РЋРІвЂљВ¬Р В Р’ВµР В Р’В»Р РЋР Р‰Р В РЎвЂќР В Р’В° = SUM Р В Р вЂ Р РЋР С“Р В Р’ВµР РЋРІР‚В¦ Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋРІР‚В Р В РЎвЂР В РІвЂћвЂ“, Р В РЎвЂ“Р В РўвЂР В Р’Вµ Р РЋР РЉР РЋРІР‚С™Р В РЎвЂў Р В РЎвЂќР В РЎвЂўР РЋРІвЂљВ¬Р В Р’ВµР В Р’В»Р В Р’ВµР В РЎвЂќ "to" Р В РЎВР В РЎвЂР В Р вЂ¦Р РЋРЎвЂњР РЋР С“ "from"
-- Р В РЎС›Р В РЎвЂєР В РІР‚С”Р В Р’В¬Р В РЎв„ўР В РЎвЂє Р В РЎвЂ”Р В РЎвЂў approved + completed

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

-- P&L Р В Р’В·Р В Р’В° Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В РЎвЂР В РЎвЂўР В РўвЂ = Р В РўвЂР В РЎвЂўР РЋРІР‚В¦Р В РЎвЂўР В РўвЂР РЋРІР‚в„– - Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР РЋРІР‚в„– (Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў approved + completed)
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

## 6. Р В РЎС›Р РЋР вЂљР В РЎвЂР В РЎвЂ“Р В РЎвЂ“Р В Р’ВµР РЋР вЂљР РЋРІР‚в„– Р В РЎвЂ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ

```sql
-- Р В РЎС›Р В Р’В Р В Р’ВР В РІР‚СљР В РІР‚СљР В РІР‚СћР В Р’В  1: Р В РЎСџР РЋР вЂљР В РЎвЂ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В Р’В·Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР РЏ Р Р†РІР‚В РІР‚в„ў Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ wallet (Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂўР РЋРІР‚С™Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™)
CREATE OR REPLACE FUNCTION create_employee_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('driver', 'mechanic', 'mechanic_lead', 'loader') THEN
    INSERT INTO wallets (code, name, type, owner_user_id, legal_entity_id)
    VALUES (
      'employee_' || NEW.id,
      'Р В РЎСџР В РЎвЂўР В РўвЂР В РЎвЂўР РЋРІР‚С™Р РЋРІР‚РЋР РЋРІР‚ВР РЋРІР‚С™ ' || NEW.full_name,
      'employee_accountable',
      NEW.id,
      (SELECT id FROM legal_entities LIMIT 1) -- Р В РЎвЂ“Р В Р’В»Р В Р’В°Р В Р вЂ Р В Р вЂ¦Р В РЎвЂўР В Р’Вµ Р РЋР вЂ№Р РЋР вЂљР В Р’В»Р В РЎвЂР РЋРІР‚В Р В РЎвЂў
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_wallet AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_employee_wallet();

-- Р В РЎС›Р В Р’В Р В Р’ВР В РІР‚СљР В РІР‚СљР В РІР‚СћР В Р’В  2: Р В РЎСџР РЋР вЂљР В РЎвЂ INSERT trip_orders Р Р†РІР‚В РІР‚в„ў Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ income transaction
CREATE OR REPLACE FUNCTION create_income_transaction()
RETURNS TRIGGER AS $$
DECLARE
  wallet_id UUID;
BEGIN
  -- Р В РЎвЂєР В РЎвЂ”Р РЋР вЂљР В Р’ВµР В РўвЂР В Р’ВµР В Р’В»Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚В Р В Р’ВµР В Р’В»Р В Р’ВµР В Р вЂ Р В РЎвЂўР В РІвЂћвЂ“ Р В РЎвЂќР В РЎвЂўР РЋРІвЂљВ¬Р В Р’ВµР В Р’В»Р РЋРІР‚ВР В РЎвЂќ Р В РЎвЂ”Р В РЎвЂў payment_method
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

-- Р В РЎС›Р В Р’В Р В Р’ВР В РІР‚СљР В РІР‚СљР В РІР‚СћР В Р’В  3: Р В РЎСџР РЋР вЂљР В РЎвЂ UPDATE assets.odometer_current Р Р†РІР‚В РІР‚в„ў Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’ВµР РЋР вЂљР В РЎвЂќР В Р’В° Р В РЎС›Р В РЎвЂє
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

## 7. Р В РЎС™Р В РЎвЂР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ: Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р В РЎвЂР В Р вЂ¦Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В Р’В°Р В Р’В»Р В РЎвЂР В Р’В·Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РІР‚ВР В РІР‚Сњ

```bash
# 1. Р В Р Р‹Р В РЎвЂќР В РЎвЂўР В РЎвЂ”Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р В Р’ВµР РЋР С“Р РЋР Р‰ SQL Р В РЎвЂР В Р’В· Р В РЎвЂ”.2 Р В Р вЂ Р РЋРІР‚в„–Р РЋРІвЂљВ¬Р В Р’Вµ
# 2. Р В РЎвЂєР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Supabase SQL Editor
# 3. Р В РІР‚в„ўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ Р В Р вЂ Р РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ (Р В РЎВР В РЎвЂўР В Р’В¶Р В Р’ВµР РЋРІР‚С™ Р В Р’В·Р В Р’В°Р В Р вЂ¦Р РЋР РЏР РЋРІР‚С™Р РЋР Р‰ 1-2 Р В РЎВР В РЎвЂР В Р вЂ¦Р РЋРЎвЂњР РЋРІР‚С™Р РЋРІР‚в„–)
# 4. Р В РЎСџР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’ВµР РЋР вЂљР В РЎвЂР РЋРІР‚С™Р РЋР Р‰: Р В Р вЂ Р РЋР С“Р В Р’Вµ Р РЋРІР‚С™Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р РЋРІР‚в„– Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р РЋРІР‚в„–

# 5. Р В Р’В­Р В РЎвЂќР РЋР С“Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР РЋРІР‚С™Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚С™Р В РЎвЂР В РЎвЂ”Р РЋРІР‚в„– Р В Р вЂ  TypeScript
supabase gen types typescript --schema public > packages/shared-types/database.types.ts

# 6. Р В РІР‚вЂќР В Р’В°Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋР С“Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂ (seed data)
# Р Р†Р вЂљРІР‚Сњ Р В РЎв„ўР В РЎвЂўР В Р вЂ¦Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В РЎвЂ“Р В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ  Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р РЋР вЂљР РЋРЎвЂњР РЋРІР‚РЋР В Р вЂ¦Р РЋРЎвЂњР РЋР вЂ№ Р В Р вЂ  Dashboard
# Р Р†Р вЂљРІР‚Сњ Р В РЎС™Р В Р’В°Р РЋРІвЂљВ¬Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„– Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· Setup Wizard
```

---

## 8. Р В Р’В Р В Р’ВµР В Р’В·Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Р В РЎвЂќР В РЎвЂўР В РЎвЂ”Р В РЎвЂР РЋР РЏ Р В РЎвЂ Р В Р вЂ Р В РЎвЂўР РЋР С“Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ

```bash
# Р В Р’В Р В Р’ВµР В Р’В·Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Р В РЎвЂќР В РЎвЂўР В РЎвЂ”Р В РЎвЂР РЋР РЏ:
pg_dump postgresql://user:password@host/db > backup.sql

# Р В РІР‚в„ўР В РЎвЂўР РЋР С“Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ:
psql postgresql://user:password@host/db < backup.sql
```

---

## Р В Р’ВР РЋРІР‚С™Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў

Р Р†РЎС™РІР‚В¦ **Р В РЎСџР В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’В°Р РЋР РЏ Supabase Р РЋР С“Р РЋРІР‚В¦Р В Р’ВµР В РЎВР В Р’В° Р В РЎвЂ“Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В° Р В РЎвЂќ Р В РЎвЂР В Р вЂ¦Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В Р’В°Р В Р’В»Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР В РЎвЂ**  
Р Р†РЎС™РІР‚В¦ **Р В РІР‚в„ўР РЋР С“Р В Р’Вµ Р РЋРІР‚С™Р В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂР РЋРІР‚В Р РЋРІР‚в„–, Р В РЎвЂР В Р вЂ¦Р В РўвЂР В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚в„–, Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂР В РЎвЂ“Р В РЎвЂ“Р В Р’ВµР РЋР вЂљР РЋРІР‚в„–, RLS**  
Р Р†РЎС™РІР‚В¦ **Р В РІР‚СњР В Р вЂ Р РЋРЎвЂњР РЋРІР‚В¦Р В РЎвЂўР РЋР С“Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњР РЋР С“ Р РЋР вЂљР В Р’ВµР В Р’В°Р В Р’В»Р В РЎвЂР В Р’В·Р В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦ Р В Р вЂ¦Р В Р’В° Р РЋРЎвЂњР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р вЂ¦Р В Р’Вµ Р В РІР‚ВР В РІР‚Сњ**  
Р Р†РЎС™РІР‚В¦ **Р В РЎвЂ™Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР В Р’В·Р В Р’В°Р РЋРІР‚В Р В РЎвЂР РЋР РЏ Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· pg_cron Р В РЎвЂ Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂР В РЎвЂ“Р В РЎвЂ“Р В Р’ВµР РЋР вЂљР РЋРІР‚в„–**  

**Р В Р Р‹Р В Р’В»Р В Р’ВµР В РўвЂР РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р РЋРІР‚С›Р В Р’В°Р В РІвЂћвЂ“Р В Р’В»:** ENVIRONMENT.md (Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В РЎВР В Р’ВµР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂўР В РЎвЂќР РЋР вЂљР РЋРЎвЂњР В Р’В¶Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ)
