# DB Schema & Flow Map v2 (SaldaCargo)

**РЎС‚Р°С‚СѓСЃ:** MVP-ready
**Changelog v2:** Р СѓС‡РЅРѕР№ РІРІРѕРґ Р—Рџ РїРѕ РєР°Р¶РґРѕРјСѓ Р·Р°РєР°Р·Сѓ, СѓРїСЂРѕС‰С‘РЅРЅС‹Рµ assets, pg_cron РІРјРµСЃС‚Рѕ Vercel Cron, QR РєР°Рє СЃРїРѕСЃРѕР± РѕРїР»Р°С‚С‹.

---

## 1. РЎРїСЂР°РІРѕС‡РЅРёРєРё Рё РЇРґСЂРѕ (Core)

### РўР°Р±Р»РёС†С‹

#### `users`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
max_user_id     TEXT UNIQUE
phone           TEXT
full_name       TEXT NOT NULL
role            TEXT NOT NULL CHECK (role IN ('owner','admin','dispatcher','driver','mechanic','mechanic_lead','loader','accountant'))
is_active       BOOLEAN DEFAULT true
current_asset_id UUID REFERENCES assets(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `legal_entities`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
type            TEXT NOT NULL CHECK (type IN ('IP','OOO','SELF_EMPLOYED'))
inn             TEXT
tax_regime      TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `business_units`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
is_active       BOOLEAN DEFAULT true
```

#### `asset_types`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
default_fuel_rate DECIMAL(5,2)
has_gps         BOOLEAN DEFAULT false
requires_odometer_photo BOOLEAN DEFAULT true
```

#### `assets` (РЈРџР РћР©РЃРќРќРђРЇ вЂ” Р±РµР· РґР°С‚С‹/С†РµРЅС‹ РїРѕРєСѓРїРєРё)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_type_id         UUID NOT NULL REFERENCES asset_types(id)
business_unit_id      UUID REFERENCES business_units(id)
legal_entity_id       UUID REFERENCES legal_entities(id)
plate_number          TEXT UNIQUE NOT NULL
vin                   TEXT
year                  INT
odometer_current      INT DEFAULT 0
-- РђРјРѕСЂС‚РёР·Р°С†РёСЏ РїРѕ РѕСЃС‚Р°С‚РѕС‡РЅРѕР№ СЃС‚РѕРёРјРѕСЃС‚Рё
residual_value        DECIMAL(12,2) NOT NULL       -- РѕСЃС‚Р°С‚РѕС‡РЅР°СЏ СЃС‚РѕРёРјРѕСЃС‚СЊ РќРђ РњРћРњР•РќРў Р’Р’РћР”Рђ
remaining_life_months INT NOT NULL                  -- РѕСЃС‚Р°РІС€РёР№СЃСЏ СЃСЂРѕРє СЃР»СѓР¶Р±С‹ РІ РјРµСЃ
monthly_depreciation  DECIMAL(12,2)                 -- = residual_value / remaining_life_months (РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ)
current_book_value    DECIMAL(12,2)                 -- С‚РµРєСѓС‰Р°СЏ (СѓРјРµРЅСЊС€Р°РµС‚СЃСЏ РµР¶РµРјРµСЃСЏС‡РЅРѕ)
-- GPS
wialon_object_id      TEXT                          -- ID РІ Wialon (С‚РѕР»СЊРєРѕ РґР»СЏ GPS-РјР°С€РёРЅ)
status                TEXT DEFAULT 'active' CHECK (status IN ('active','repair','reserve','sold','written_off'))
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

**РџСЂРё INSERT:** `monthly_depreciation = residual_value / remaining_life_months`, `current_book_value = residual_value`.

#### `wallets`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
type            TEXT NOT NULL CHECK (type IN ('bank_account','cash_register','employee_accountable','fuel_card','external_virtual'))
legal_entity_id UUID REFERENCES legal_entities(id)
owner_user_id   UUID REFERENCES users(id)
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

вљЎ **РўСЂРёРіРіРµСЂ:** РџСЂРё INSERT user WHERE role IN ('driver','mechanic','mechanic_lead') в†’ Р°РІС‚РѕСЃРѕР·РґР°РЅРёРµ wallet.

#### `categories`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
direction       TEXT NOT NULL CHECK (direction IN ('income','expense'))
parent_id       UUID REFERENCES categories(id)
sort_order      INT DEFAULT 0
```

#### `counterparties`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
type            TEXT NOT NULL CHECK (type IN ('client','supplier','both'))
inn             TEXT
phone           TEXT
contact_person  TEXT
default_payment_terms TEXT DEFAULT 'on_delivery'
credit_limit    DECIMAL(12,2) DEFAULT 0
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

### API Routes вЂ” Core

```
POST   /api/auth/max                   -- Р°РІС‚РѕСЂРёР·Р°С†РёСЏ С‡РµСЂРµР· MAX
GET    /api/auth/me

CRUD:  /api/users, /api/legal-entities, /api/assets, /api/wallets,
       /api/categories, /api/counterparties, /api/business-units

POST   /api/setup/seed                 -- Setup Wizard (batch insert)
GET    /api/setup/status
```

---

## 2. Р РµР№СЃС‹ Рё Р—Р°РєР°Р·С‹ (Logistics)

### РўР°Р±Р»РёС†С‹

#### `trips`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id              UUID NOT NULL REFERENCES assets(id)
driver_id             UUID NOT NULL REFERENCES users(id)
loader_id             UUID REFERENCES users(id)           -- РіСЂСѓР·С‡РёРє (РµСЃР»Рё РµСЃС‚СЊ РІ СЌРєРёРїР°Р¶Рµ)
trip_type             TEXT DEFAULT 'local' CHECK (trip_type IN ('local','intercity','moving','hourly'))
started_at            TIMESTAMPTZ NOT NULL
ended_at              TIMESTAMPTZ
odometer_start        INT
odometer_end          INT
odometer_start_photo  TEXT                                 -- URL Supabase Storage
odometer_end_photo    TEXT
gps_verified_mileage  INT                                  -- РѕС‚ Wialon
gps_deviation_percent DECIMAL(5,2)                         -- |GPS-РѕРґРѕРјРµС‚СЂ|/GPS*100
gps_alert             BOOLEAN DEFAULT false
route_description     TEXT
lifecycle_status      TEXT DEFAULT 'draft'
approved_by           UUID REFERENCES users(id)
approved_at           TIMESTAMPTZ
cancelled_reason      TEXT
status                TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled'))
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

#### `trip_orders` в­ђ РќРћР’РђРЇ вЂ” СЃС‚СЂРѕРєРё РїСѓС‚РµРІРѕРіРѕ Р»РёСЃС‚Р°

Р­С‚Рѕ **РєР»СЋС‡РµРІР°СЏ РЅРѕРІР°СЏ С‚Р°Р±Р»РёС†Р°**, РєРѕС‚РѕСЂРѕР№ РЅРµ Р±С‹Р»Рѕ. РљР°Р¶РґР°СЏ СЃС‚СЂРѕРєР° РїСѓС‚РµРІРѕРіРѕ Р»РёСЃС‚Р° = РѕРґРЅР° Р·Р°РїРёСЃСЊ. РРјРµРЅРЅРѕ Р·РґРµСЃСЊ С…СЂР°РЅРёС‚СЃСЏ Р—Рџ РїРѕ РєР°Р¶РґРѕРјСѓ Р·Р°РєР°Р·Сѓ.

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID NOT NULL REFERENCES trips(id)
order_number          INT NOT NULL                         -- РїРѕСЂСЏРґРєРѕРІС‹Р№ РЅРѕРјРµСЂ РІ Р»РёСЃС‚Рµ (1, 2, 3...)
counterparty_id       UUID REFERENCES counterparties(id)   -- null РґР»СЏ "Р±/РЅ"
client_name           TEXT                                  -- СЃРІРѕР±РѕРґРЅС‹Р№ С‚РµРєСЃС‚ РґР»СЏ Р±С‹СЃС‚СЂРѕРіРѕ РІРІРѕРґР° ("Р›РµРІС€Р°", "РРЅС‚РµСЂСЊРµСЂ")
description           TEXT                                  -- "РџРµСЂРµРµР·Рґ", "Р”РѕСЃС‚Р°РІРєР°" Рё С‚.Рґ.
amount                DECIMAL(12,2) NOT NULL                -- СЃСѓРјРјР° Р·Р°РєР°Р·Р°
driver_pay            DECIMAL(12,2) NOT NULL DEFAULT 0     -- Р—Рџ РІРѕРґРёС‚РµР»СЏ (СЂСѓС‡РЅРѕР№ РІРІРѕРґ)
loader_pay            DECIMAL(12,2) DEFAULT 0              -- Р—Рџ РіСЂСѓР·С‡РёРєР° (СЂСѓС‡РЅРѕР№ РІРІРѕРґ)
driver_pay_percent    DECIMAL(5,2)                          -- Р°РІС‚РѕРІС‹С‡РёСЃР»РµРЅРёРµ: driver_pay/amount*100
payment_method        TEXT NOT NULL CHECK (payment_method IN ('cash','qr','bank_invoice','debt_cash','card_driver'))
settlement_status     TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed'))
-- pending С‚РѕР»СЊРєРѕ РґР»СЏ: bank_invoice Рё debt_cash
linked_income_tx_id   UUID REFERENCES transactions(id)     -- Р°РІС‚РѕСЃРѕР·РґР°С‘С‚СЃСЏ РїСЂРё INSERT
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```

**Р›РѕРіРёРєР°:**
- РџСЂРё РєР°Р¶РґРѕРј INSERT РІ `trip_orders` Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°С‘С‚СЃСЏ `transaction` (income).
- `driver_pay` Рё `loader_pay` Р·Р°РїРёСЃС‹РІР°СЋС‚СЃСЏ РєР°Рє РµСЃС‚СЊ. Р¤РѕСЂРјСѓР»Р° РЅРµ РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚.
- `driver_pay_percent` = РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅРѕРµ РїРѕР»Рµ РґР»СЏ РѕС‚С‡С‘С‚РѕРІ.
- РС‚РѕРіРѕ Р—Рџ Р·Р° СЂРµР№СЃ = SUM(driver_pay) РїРѕ trip_orders + SUM(loader_pay).

#### `trip_expenses` вЂ” СЂР°СЃС…РѕРґС‹ РІ СЂРµР№СЃРµ (РѕС‚РґРµР»РµРЅС‹ РѕС‚ trip_orders)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID NOT NULL REFERENCES trips(id)
category_id           UUID NOT NULL REFERENCES categories(id) -- FUEL, PARKING, REPAIR Рё С‚.Рґ.
amount                DECIMAL(12,2) NOT NULL
payment_method        TEXT NOT NULL CHECK (payment_method IN ('cash','card_driver','fuel_card'))
description           TEXT
receipt_photo         TEXT                                  -- URL С„РѕС‚Рѕ С‡РµРєР°
linked_expense_tx_id  UUID REFERENCES transactions(id)
created_at            TIMESTAMPTZ DEFAULT now()
```

### РџРѕС‚РѕРєРё РґР°РЅРЅС‹С…

```
[M] Р’РѕРґРёС‚РµР»СЊ в†’ "РќР°С‡Р°С‚СЊ СЂРµР№СЃ":
    1. Р’С‹Р±РѕСЂ РјР°С€РёРЅС‹ (Р°РІС‚Рѕ РµСЃР»Рё Р·Р°РєСЂРµРїР»РµРЅР°)
    2. Р’С‹Р±РѕСЂ РіСЂСѓР·С‡РёРєР° (РёР· СЃРїРёСЃРєР° РёР»Рё "Р‘РµР· РіСЂСѓР·С‡РёРєР°")
    3. Р’РІРѕРґ РѕРґРѕРјРµС‚СЂР° + РѕР±СЏР·Р°С‚РµР»СЊРЅРѕРµ С„РѕС‚Рѕ (Р“Р°Р·РµР»СЊ)
    в†’ INSERT trip (in_progress, draft)

[M] Р’РѕРґРёС‚РµР»СЊ в†’ "+ Р—Р°РєР°Р·" (РєР°Р¶РґР°СЏ СЃС‚СЂРѕРєР° РїСѓС‚РµРІРѕРіРѕ Р»РёСЃС‚Р°):
    1. РљР»РёРµРЅС‚: autocomplete РёР»Рё "Р±/РЅ" (С‚РµРєСЃС‚)
    2. РЎСѓРјРјР°: 2700
    3. Р—Рџ РІРѕРґРёС‚РµР»СЏ: [1000] (РїРѕРґСЃРєР°Р·РєР° СЃРµСЂС‹Рј: "~810 (30%)")
    4. Р—Рџ РіСЂСѓР·С‡РёРєР°: [1000] (РµСЃР»Рё РµСЃС‚СЊ РіСЂСѓР·С‡РёРє; РїРѕРґСЃРєР°Р·РєР°: "~810 (30%)")
    5. РћРїР»Р°С‚Р°: рџ’µ РќР°Р» / рџ“± QR / рџЏ¦ Р‘РµР·РЅР°Р» / вЏі Р”РѕР»Рі / рџ’і РќР° РєР°СЂС‚Сѓ
    в†’ INSERT trip_orders
    в†’ INSERT transaction (income, draft)

[M] Р’РѕРґРёС‚РµР»СЊ в†’ "+ Р Р°СЃС…РѕРґ":
    1. РљР°С‚РµРіРѕСЂРёСЏ: Р“РЎРњ / РЎС‚РѕСЏРЅРєР° / РњРѕР№РєР° / РњРµР»РєРёР№ СЂРµРјРѕРЅС‚ / РџСЂРѕС‡РµРµ
    2. РЎСѓРјРјР°: 1000
    3. Р¤РѕС‚Рѕ С‡РµРєР° (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
    в†’ INSERT trip_expenses
    в†’ INSERT transaction (expense, draft)

[M] Р’РѕРґРёС‚РµР»СЊ в†’ "рџЏЃ Р—Р°РІРµСЂС€РёС‚СЊ СЂРµР№СЃ":
    1. РћРґРѕРјРµС‚СЂ РєРѕРЅРµС‡РЅС‹Р№ + С„РѕС‚Рѕ
    2. РЎРІРѕРґРєР°:
       Р—Р°РєР°Р·РѕРІ: 6, Р’С‹СЂСѓС‡РєР°: 16 050
       Р—Рџ РІРѕРґРёС‚РµР»СЏ: 5 350, Р—Рџ РіСЂСѓР·С‡РёРєР°: 4 950
       Р Р°СЃС…РѕРґС‹: 1 000
       РџСЂРёР±С‹Р»СЊ: 4 750
    3. "РћС‚РїСЂР°РІРёС‚СЊ РЅР° СЂРµРІСЊСЋ"
    в†’ UPDATE trip (completed, draft)
    в†’ UPDATE assets.odometer_current вљЎ С‚СЂРёРіРіРµСЂ РўРћ
    в†’ Р•СЃР»Рё GPS: РІС‹Р·РѕРІ Wialon в†’ Р·Р°РїРёСЃСЊ gps_verified_mileage

[D] Admin в†’ "Р РµРІСЊСЋ СЃРјРµРЅС‹":
    в†’ Р’РёРґРёС‚ РІСЃРµ trip Р·Р° СЃРµРіРѕРґРЅСЏ РІ draft
    в†’ РџРѕ РєР°Р¶РґРѕРјСѓ: СЃРїРёСЃРѕРє trip_orders СЃ % РІРѕРґРёС‚РµР»СЏ
    в†’ вљ пёЏ РџРѕРґСЃРІРµС‚РєР° РµСЃР»Рё % > 40% РёР»Рё < 25%
    в†’ "вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ РІСЃС‘" РёР»Рё "вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
    в†’ UPDATE trip + РІСЃРµ trip_orders в†’ lifecycle: approved
    в†’ Р’СЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ transactions в†’ lifecycle: approved
```

### API Routes вЂ” Logistics

```
POST   /api/trips/start                -- РЅР°С‡Р°Р»Рѕ СЂРµР№СЃР°
GET    /api/trips/active               -- С‚РµРєСѓС‰РёР№ Р°РєС‚РёРІРЅС‹Р№ СЂРµР№СЃ
POST   /api/trips/:id/orders           -- РґРѕР±Р°РІРёС‚СЊ Р·Р°РєР°Р· (СЃС‚СЂРѕРєСѓ РїСѓС‚РµРІРѕРіРѕ Р»РёСЃС‚Р°)
POST   /api/trips/:id/expenses         -- РґРѕР±Р°РІРёС‚СЊ СЂР°СЃС…РѕРґ
POST   /api/trips/:id/complete         -- Р·Р°РІРµСЂС€РёС‚СЊ СЂРµР№СЃ
POST   /api/trips/:id/approve          -- РїРѕРґС‚РІРµСЂРґРёС‚СЊ (admin)
POST   /api/trips/:id/cancel           -- РѕС‚РјРµРЅРёС‚СЊ (admin)
GET    /api/trips                      -- СЃРїРёСЃРѕРє
GET    /api/trips/:id                  -- РґРµС‚Р°Р»Рё СЃ orders Рё expenses

GET    /api/trips/:id/summary          -- СЃРІРѕРґРєР° (РґР»СЏ СЌРєСЂР°РЅР° Р·Р°РІРµСЂС€РµРЅРёСЏ):
       {
         orders_count: 6,
         total_revenue: 16050,
         total_driver_pay: 5350,
         total_loader_pay: 4950,
         total_expenses: 1000,
         profit: 4750,
         avg_driver_percent: 33.3,
         pending_debts: [{ client: "Р±/РЅ", amount: 700 }]
       }
```

---

## 3. Р¤РёРЅР°РЅСЃС‹ (Finance)

### `transactions` (Р±РµР· РёР·РјРµРЅРµРЅРёР№ СЃС‚СЂСѓРєС‚СѓСЂРЅРѕ РѕС‚ v2)

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
direction           TEXT NOT NULL CHECK (direction IN ('income','expense','transfer'))
amount              DECIMAL(12,2) NOT NULL CHECK (amount > 0)
from_wallet_id      UUID REFERENCES wallets(id)
to_wallet_id        UUID REFERENCES wallets(id)
category_id         UUID REFERENCES categories(id)
counterparty_id     UUID REFERENCES counterparties(id)
legal_entity_id     UUID REFERENCES legal_entities(id)
business_unit_id    UUID REFERENCES business_units(id)
asset_id            UUID REFERENCES assets(id)
trip_id             UUID REFERENCES trips(id)
service_order_id    UUID REFERENCES service_orders(id)
lifecycle_status    TEXT DEFAULT 'draft'
settlement_status   TEXT DEFAULT 'completed'
approved_by         UUID REFERENCES users(id)
approved_at         TIMESTAMPTZ
cancelled_reason    TEXT
cancelled_by        UUID REFERENCES users(id)
planned_date        DATE
actual_date         DATE DEFAULT CURRENT_DATE
description         TEXT
idempotency_key     TEXT UNIQUE
transaction_type    TEXT DEFAULT 'regular' CHECK (transaction_type IN 
  ('regular','initial_balance','depreciation','payroll','fuel_auto','bank_auto','cash_collect'))
created_by          UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()

CHECK (from_wallet_id IS DISTINCT FROM to_wallet_id)
```

### `payroll_rules` вЂ” С‚РµРїРµСЂСЊ СЃРїСЂР°РІРѕС‡РЅРёРє РїРѕРґСЃРєР°Р·РѕРє

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  TEXT NOT NULL               -- "Р“Р°Р·РµР»СЊ Р»РѕРєР°Р» 30%", "Р’Р°Р»РґР°Р№ 10в‚Ѕ/РєРј"
rule_type             TEXT NOT NULL               -- 'percent' | 'per_km' | 'fixed_daily' | 'hourly_split'
value                 DECIMAL(10,4) NOT NULL      -- 0.30 | 10 | 1000 | 3000
split_config          JSONB                        -- {"driver":0.33,"loader":0.33,"company":0.34}
applies_to_asset_type_id UUID REFERENCES asset_types(id)
applies_to_trip_type  TEXT
description           TEXT                         -- РїРѕСЏСЃРЅРµРЅРёРµ РґР»СЏ UI
is_active             BOOLEAN DEFAULT true
created_at            TIMESTAMPTZ DEFAULT now()
```

### `payroll_periods` вЂ” СЂР°СЃС‡С‘С‚ Р—Рџ Р·Р° РїРµСЂРёРѕРґ

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL REFERENCES users(id)
period_start        DATE NOT NULL
period_end          DATE NOT NULL
total_trips         INT DEFAULT 0
total_revenue       DECIMAL(12,2) DEFAULT 0       -- РІС‹СЂСѓС‡РєР° РїСЂРёРІСЏР·Р°РЅРЅС‹С… СЂРµР№СЃРѕРІ
total_earned        DECIMAL(12,2) DEFAULT 0       -- SUM(driver_pay РёР»Рё loader_pay РёР· trip_orders)
advances_paid       DECIMAL(12,2) DEFAULT 0       -- СѓР¶Рµ РІС‹РґР°РЅРЅС‹Рµ Р°РІР°РЅСЃС‹
balance_to_pay      DECIMAL(12,2) DEFAULT 0       -- total_earned - advances_paid
status              TEXT DEFAULT 'draft'
calculation_details JSONB                          -- РґРµС‚Р°Р»РёР·Р°С†РёСЏ: [{trip_id, date, revenue, pay}, ...]
approved_by         UUID REFERENCES users(id)
approved_at         TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
```

### Р›РѕРіРёРєР° СЂР°СЃС‡С‘С‚Р° Р—Рџ Р·Р° РїРµСЂРёРѕРґ

```
Р”Р»СЏ РІРѕРґРёС‚РµР»СЏ:
  total_earned = SUM(trip_orders.driver_pay) WHERE trip.driver_id = user_id 
                 AND trip.lifecycle_status = 'approved'
                 AND trip.ended_at BETWEEN period_start AND period_end

Р”Р»СЏ РіСЂСѓР·С‡РёРєР°:
  total_earned = SUM(trip_orders.loader_pay) WHERE trip.loader_id = user_id 
                 AND trip.lifecycle_status = 'approved'
                 AND trip.ended_at BETWEEN period_start AND period_end

advances_paid = SUM(transactions WHERE direction='expense' 
                AND category IN ('PAYROLL_DRIVER','PAYROLL_LOADER') 
                AND user_id = ... AND date BETWEEN ...)

balance_to_pay = total_earned - advances_paid
```

**Р’Р°Р¶РЅРѕ:** Р—Рџ СЃС‡РёС‚Р°РµС‚СЃСЏ РёР· Р Р•РђР›Р¬РќРћ Р’Р’Р•Р”РЃРќРќР«РҐ С†РёС„СЂ РІ `trip_orders`, РЅРµ РїРѕ С„РѕСЂРјСѓР»Р°Рј. Р¤РѕСЂРјСѓР»С‹ вЂ” С‚РѕР»СЊРєРѕ РїРѕРґСЃРєР°Р·РєРё.

### API Routes вЂ” Finance

```
GET    /api/transactions               -- СЃ С„РёР»СЊС‚СЂР°РјРё
POST   /api/transactions               -- СЂСѓС‡РЅРѕРµ СЃРѕР·РґР°РЅРёРµ (admin/owner)
PATCH  /api/transactions/:id           -- РїСЂР°РІРєР° (admin)
POST   /api/transactions/:id/approve
POST   /api/transactions/:id/cancel
POST   /api/transactions/:id/complete  -- settlement в†’ completed
POST   /api/transactions/approve-batch -- СЂРµРІСЊСЋ СЃРјРµРЅС‹

GET    /api/money-map                  -- Р“Р»Р°РІРЅР°СЏ
GET    /api/receivables                -- РґРµР±РёС‚РѕСЂРєР°
GET    /api/payables                   -- РєСЂРµРґРёС‚РѕСЂРєР°

POST   /api/payroll/calculate          -- СЂР°СЃС‡С‘С‚ Р—Рџ
GET    /api/payroll/periods
POST   /api/payroll/periods/:id/approve
POST   /api/payroll/periods/:id/pay

GET    /api/my/balance                 -- РїРѕРґРѕС‚С‡С‘С‚
GET    /api/my/payroll                 -- Р—Рџ

POST   /api/admin/run-depreciation     -- СЂСѓС‡РЅР°СЏ РєРЅРѕРїРєР° "РќР°С‡РёСЃР»РёС‚СЊ Р°РјРѕСЂС‚РёР·Р°С†РёСЋ"
POST   /api/admin/sync-opti24          -- СЂСѓС‡РЅР°СЏ РєРЅРѕРїРєР° "РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РћРїС‚Рё24"
```

---

## 4. РРЅС‚РµРіСЂР°С†РёРё (Р±РµР· СЃС‚СЂСѓРєС‚СѓСЂРЅС‹С… РёР·РјРµРЅРµРЅРёР№)

### РћРїС‚Рё24

РўР°Р±Р»РёС†С‹: `fuel_cards`, `fuel_transactions_raw` вЂ” Р±РµР· РёР·РјРµРЅРµРЅРёР№.

**РР·РјРµРЅРµРЅРёРµ:** РІРјРµСЃС‚Рѕ Vercel Cron вЂ” РєРЅРѕРїРєР° В«рџ”„ РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РћРїС‚Рё24В» РІ Dashboard:
```
[D] Admin Р¶РјС‘С‚ РєРЅРѕРїРєСѓ в†’ POST /api/admin/sync-opti24
в†’ Edge Function / API Route РґС‘СЂРіР°РµС‚ РћРїС‚Рё24 API
в†’ Р—Р°РїРёСЃРё РІ fuel_transactions_raw в†’ auto-approved transactions
в†’ РћС‚РІРµС‚: "РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅРѕ: 12 РЅРѕРІС‹С… Р·Р°РїСЂР°РІРѕРє Р·Р° 1 847в‚Ѕ"
```

РџРѕР·Р¶Рµ: pg_cron РІ Supabase (Р±РµСЃРїР»Р°С‚РЅРѕ) Р·Р°РїСѓСЃРєР°РµС‚ С‚Сѓ Р¶Рµ С„СѓРЅРєС†РёСЋ РєР°Р¶РґС‹Рµ 15 РјРёРЅ.

### Wialon

Р‘РµР· РёР·РјРµРЅРµРЅРёР№. Р’С‹Р·С‹РІР°РµС‚СЃСЏ РїСЂРё Р·Р°РєСЂС‹С‚РёРё СЂРµР№СЃР° РЅР° Р’Р°Р»РґР°Рµ.

### Р‘Р°РЅРє

Р‘РµР· РёР·РјРµРЅРµРЅРёР№. MVP: СЂСѓС‡РЅРѕР№ РёРјРїРѕСЂС‚ CSV. РџРѕС‚РѕРј: API.

---

## 5. РЎРўРћ Рё Р РµРіР»Р°РјРµРЅС‚С‹ (Р±РµР· СЃС‚СЂСѓРєС‚СѓСЂРЅС‹С… РёР·РјРµРЅРµРЅРёР№)

РўР°Р±Р»РёС†С‹: `maintenance_regulations`, `maintenance_alerts`, `service_orders`, `service_order_works`, `service_order_parts`, `parts`, `part_movements` вЂ” Р±РµР· РёР·РјРµРЅРµРЅРёР№ РѕС‚ Flow Map v1.

---

## 6. РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ (Р±РµР· РёР·РјРµРЅРµРЅРёР№)

РўР°Р±Р»РёС†С‹: `fixed_assets`, `tools` вЂ” Р±РµР· РёР·РјРµРЅРµРЅРёР№.

---

## 7. РЎРёСЃС‚РµРјР° (Р±РµР· РёР·РјРµРЅРµРЅРёР№)

РўР°Р±Р»РёС†С‹: `audit_log`, `attachments` вЂ” Р±РµР· РёР·РјРµРЅРµРЅРёР№.

---

## 8. РџРѕР»РЅС‹Р№ SQL Init Script (РїРѕСЂСЏРґРѕРє СЃРѕР·РґР°РЅРёСЏ)

```sql
-- 1. Enums / Types (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ, РјРѕР¶РЅРѕ CHECK constraints)
-- 2. Core
CREATE TABLE legal_entities (...);
CREATE TABLE business_units (...);
CREATE TABLE asset_types (...);
CREATE TABLE users (...);
CREATE TABLE assets (...);
CREATE TABLE wallets (...);
CREATE TABLE categories (...);
CREATE TABLE counterparties (...);

-- 3. Logistics
CREATE TABLE trips (...);
CREATE TABLE trip_orders (...);
CREATE TABLE trip_expenses (...);

-- 4. Finance
CREATE TABLE transactions (...);
CREATE TABLE payroll_rules (...);
CREATE TABLE payroll_periods (...);

-- 5. Fuel
CREATE TABLE fuel_cards (...);
CREATE TABLE fuel_transactions_raw (...);

-- 6. Bank
CREATE TABLE bank_statements_raw (...);

-- 7. Maintenance
CREATE TABLE maintenance_regulations (...);
CREATE TABLE maintenance_alerts (...);
CREATE TABLE service_orders (...);
CREATE TABLE service_order_works (...);
CREATE TABLE service_order_parts (...);
CREATE TABLE parts (...);
CREATE TABLE part_movements (...);

-- 8. Equipment
CREATE TABLE fixed_assets (...);
CREATE TABLE tools (...);

-- 9. System
CREATE TABLE audit_log (...);
CREATE TABLE attachments (...);

-- 10. Triggers
CREATE TRIGGER on_user_driver_created ...;
CREATE TRIGGER on_asset_odometer_update ...;
CREATE TRIGGER on_transaction_change ...;

-- 11. Seed
INSERT INTO business_units ...;
INSERT INTO asset_types ...;
INSERT INTO categories ...;
INSERT INTO payroll_rules ...;
-- Р РµРіР»Р°РјРµРЅС‚С‹ РўРћ (С€Р°Р±Р»РѕРЅС‹)
```

РћР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ С‚Р°Р±Р»РёС†: **22**. Р’СЃРµ СЃРѕР·РґР°СЋС‚СЃСЏ РѕРґРЅРёРј СЃРєСЂРёРїС‚РѕРј РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё Supabase.

---

## 9. Mini App вЂ” СЌРєСЂР°РЅС‹ РІРѕРґРёС‚РµР»СЏ (UX-flow)

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  рџЏ  Р“Р›РђР’РќРђРЇ (РІРѕРґРёС‚РµР»СЊ)    в”‚
в”‚                          в”‚
в”‚  [рџЏЃ РќР°С‡Р°С‚СЊ СЂРµР№СЃ]        в”‚  в†ђ Р±РѕР»СЊС€Р°СЏ РєРЅРѕРїРєР°
в”‚                          в”‚
в”‚  рџ’° РњРѕР№ РїРѕРґРѕС‚С‡С‘С‚: 10 100 в”‚
в”‚  рџ“Љ Р—Рџ Р·Р° Р°РІРіСѓСЃС‚: 45 200 в”‚
в”‚                          в”‚
в”‚  рџ“‹ РњРѕРё СЂРµР№СЃС‹ (РёСЃС‚РѕСЂРёСЏ)  в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
         в”‚
         в–ј (РЅР°Р¶Р°Р» "РќР°С‡Р°С‚СЊ СЂРµР№СЃ")
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  рџљљ РќРђР§РђР›Рћ Р Р•Р™РЎРђ         в”‚
в”‚                          в”‚
в”‚  РњР°С€РёРЅР°: [866 в–ј]         в”‚
в”‚  Р“СЂСѓР·С‡РёРє: [РЎРµСЂС‘РіР° в–ј]     в”‚
в”‚           [Р‘РµР· РіСЂСѓР·С‡.]   в”‚
в”‚  РћРґРѕРјРµС‚СЂ: [______]       в”‚
в”‚  рџ“· [Р¤РѕС‚Рѕ РѕРґРѕРјРµС‚СЂР°] в†ђРѕР±СЏР·в”‚
в”‚                          в”‚
в”‚  [в–¶ РџРћР•РҐРђР›Р]             в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
         в”‚
         в–ј
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  рџљљ Р Р•Р™РЎ #247 (РІ РїСѓС‚Рё)   в”‚
в”‚  866 В· Р’РѕРІР° + РЎРµСЂС‘РіР°     в”‚
в”‚  РќР°С‡Р°Р»Рѕ: 08:30, 142 580РєРјв”‚
в”‚                          в”‚
в”‚  в”Ђв”Ђв”Ђ Р—Р°РєР°Р·С‹ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ в”‚
в”‚  1. РРЅС‚РµСЂСЊРµСЂ  2700  вњ…    в”‚
в”‚  2. РџРµСЂРµРµР·Рґ   6000  вњ…    в”‚
в”‚  3. Р”РёРІ        2000  вњ…    в”‚
в”‚                          в”‚
в”‚  Р’С‹СЂСѓС‡РєР°:     10 700     в”‚
в”‚  Р—Рџ РІРѕРґ:       3 650     в”‚
в”‚  Р—Рџ РіСЂСѓР·:      3 650     в”‚
в”‚                          в”‚
в”‚  [вћ• Р—Р°РєР°Р·] [рџ’ё Р Р°СЃС…РѕРґ]   в”‚
в”‚                          в”‚
в”‚  [рџЏЃ Р—Р°РІРµСЂС€РёС‚СЊ СЂРµР№СЃ]     в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
         в”‚
         в–ј (РЅР°Р¶Р°Р» "+ Р—Р°РєР°Р·")
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  вћ• РќРћР’Р«Р™ Р—РђРљРђР—           в”‚
в”‚                          в”‚
в”‚  РљР»РёРµРЅС‚: [Р›РµРІС€Р°____в–ј]    в”‚
в”‚          [+ РќРѕРІС‹Р№]       в”‚
в”‚                          в”‚
в”‚  РЎСѓРјРјР°:  [650_________]  в”‚
в”‚                          в”‚
в”‚  Р—Рџ РІРѕРґРёС‚РµР»СЏ:            в”‚
в”‚  [200_________]          в”‚
в”‚  рџ’Ў РїРѕРґСЃРєР°Р·РєР°: ~195 (30%)в”‚
в”‚                          в”‚
в”‚  Р—Рџ РіСЂСѓР·С‡РёРєР°:            в”‚
в”‚  [0___________]          в”‚
в”‚  рџ’Ў РїРѕРґСЃРєР°Р·РєР°: ~195 (30%)в”‚
в”‚                          в”‚
в”‚  РћРїР»Р°С‚Р°:                 в”‚
в”‚  [рџ’µ РќР°Р»] [рџ“±QR] [рџЏ¦РЎС‡]  в”‚
в”‚  [вЏіР”РѕР»Рі] [рџ’іРљР°СЂС‚Р°]      в”‚
в”‚                          в”‚
в”‚  [вњ… Р”РћР‘РђР’РРўР¬]            в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
         в”‚
         в–ј (РЅР°Р¶Р°Р» "Р—Р°РІРµСЂС€РёС‚СЊ СЂРµР№СЃ")
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  рџЏЃ Р—РђР’Р•Р РЁР•РќРР• Р Р•Р™РЎРђ     в”‚
в”‚                          в”‚
в”‚  РћРґРѕРјРµС‚СЂ: [142 640___]   в”‚
в”‚  рџ“· [Р¤РѕС‚Рѕ РѕРґРѕРјРµС‚СЂР°]      в”‚
в”‚                          в”‚
в”‚  в”Ђв”Ђв”Ђ РРўРћР“Р в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ в”‚
в”‚  Р—Р°РєР°Р·РѕРІ: 6              в”‚
в”‚  Р’С‹СЂСѓС‡РєР°:      16 050    в”‚
в”‚  Р—Рџ РІРѕРґРёС‚РµР»СЏ:   5 350    в”‚
в”‚  Р—Рџ РіСЂСѓР·С‡РёРєР°:   4 950    в”‚
в”‚  Р Р°СЃС…РѕРґС‹ (Р“РЎРњ): 1 000    в”‚
в”‚  в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ в”‚
в”‚  РџСЂРёР±С‹Р»СЊ:        4 750   в”‚
в”‚                          в”‚
в”‚  вЏі Р”РѕР»РіРё: 700в‚Ѕ (1 РєР»РёРµРЅС‚)в”‚
в”‚                          в”‚
в”‚  [рџ“¤ РћРўРџР РђР’РРўР¬ РќРђ Р Р•Р’Р¬Р®] в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

---

## 10. Dashboard вЂ” СЌРєСЂР°РЅ В«Р РµРІСЊСЋ СЃРјРµРЅС‹В»

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚  рџ“‹ Р Р•Р’Р¬Р® РЎРњР•РќР« В· 19 Р°РІРіСѓСЃС‚Р° 2024                               в”‚
в”‚  12 Р·Р°РїРёСЃРµР№ РѕС‚ 2 РјР°С€РёРЅ В· 25 450в‚Ѕ РІС‹СЂСѓС‡РєРё В· РћР¶РёРґР°РµС‚ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏв”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚                                                                 в”‚
в”‚  рџљљ РњР°С€РёРЅР° 866 В· Р’РѕРІР° + РЎРµСЂС‘РіР°                                  в”‚
в”‚  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђв”‚
в”‚  в”‚ # в”‚ РљР»РёРµРЅС‚    в”‚ РЎСѓРјРјР° в”‚ Р—Рџ Р’РѕРґ в”‚  %  в”‚ Р—Рџ Р“СЂ в”‚ РћРїР»Р°С‚Р°    в”‚в”‚
в”‚  в”‚ 1 в”‚ РРЅС‚РµСЂСЊРµСЂ  в”‚ 2 700 в”‚ 1 000  в”‚ 37% в”‚ 1 000 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 2 в”‚ РџРµСЂРµРµР·Рґ   в”‚ 6 000 в”‚ 2 000  в”‚ 33% в”‚ 2 000 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 3 в”‚ Р”РёРІ       в”‚ 2 000 в”‚   650  в”‚ 33% в”‚   650 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 4 в”‚ Р”РёРІ       в”‚ 4 000 в”‚ 1 300  в”‚ 33% в”‚ 1 300 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 5 в”‚ Р›РµРІС€Р°     в”‚   650 в”‚   200  в”‚ 31% в”‚     0 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 6 в”‚ Р±/РЅ    вљ пёЏ в”‚   700 в”‚   200  в”‚ 29% в”‚     0 в”‚ вЏі Р”РѕР»Рі   в”‚в”‚
в”‚  в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤в”‚
в”‚  в”‚ РС‚РѕРіРѕ:        в”‚16 050 в”‚ 5 350  в”‚ 33% в”‚ 4 950 в”‚            в”‚в”‚
в”‚  в”‚ Р“РЎРњ: 1 000  РџСЂРёР±С‹Р»СЊ: 4 750  РџСЂРѕР±РµРі: 60 РєРј                 в”‚в”‚
в”‚  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”в”‚
в”‚  [вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ 866] [вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ]                        в”‚
в”‚                                                                 в”‚
в”‚  рџљљ РњР°С€РёРЅР° 099 В· Р”РµРЅРёСЃ + Р’РѕРІР°(РіСЂСѓР·)                             в”‚
в”‚  в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђв”‚
в”‚  в”‚ # в”‚ РљР»РёРµРЅС‚    в”‚ РЎСѓРјРјР° в”‚ Р—Рџ Р’РѕРґ в”‚  %  в”‚ Р—Рџ Р“СЂ в”‚ РћРїР»Р°С‚Р°    в”‚в”‚
в”‚  в”‚ 1 в”‚ Р“СЂСѓС‚      в”‚ 1 300 в”‚   500  в”‚вљ 38% в”‚   350 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 2 в”‚ РњРёСЃС‚РµСЂ    в”‚   700 в”‚   200  в”‚ 29% в”‚     0 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 3 в”‚ Р±/РЅ       в”‚ 1 000 в”‚   300  в”‚ 30% в”‚     0 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 4 в”‚ Р±/РЅ       в”‚ 1 000 в”‚   300  в”‚ 30% в”‚     0 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 5 в”‚ Р›РµРІС€Р°     в”‚ 1 150 в”‚   450  в”‚вљ 39% в”‚   250 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 6 в”‚ 650Г—5     в”‚ 3 250 в”‚ 1 000  в”‚ 31% в”‚     0 в”‚ рџ’µ РќР°Р»    в”‚в”‚
в”‚  в”‚ 7 в”‚ РџРµСЂРµРµР·РґвЏі в”‚ 1 000 в”‚   300  в”‚ 30% в”‚     0 в”‚ вЏі Р”РѕР»Рі   в”‚в”‚
в”‚  в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤в”‚
в”‚  в”‚ РС‚РѕРіРѕ:        в”‚ 9 400 в”‚ 3 050  в”‚ 32% в”‚   600 в”‚            в”‚в”‚
в”‚  в”‚ Р“РЎРњ: 1 000  РџСЂРёР±С‹Р»СЊ: 4 750  РџСЂРѕР±РµРі: 45 РєРј                 в”‚в”‚
в”‚  в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”в”‚
в”‚  [вњ… РџРѕРґС‚РІРµСЂРґРёС‚СЊ 099] [вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ]                        в”‚
в”‚                                                                 в”‚
в”њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”¤
в”‚  рџ’° РРўРћР“Рћ Р—Рђ Р”Р•РќР¬                                              в”‚
в”‚  Р’С‹СЂСѓС‡РєР°: 25 450 в”‚ Р¤РћРў: 13 950 (54.8%) в”‚ Р“РЎРњ: 2 000           в”‚
в”‚  РџСЂРёР±С‹Р»СЊ: 9 500  в”‚ Р”РѕР»РіРё: 1 700        в”‚ РњР°С€РёРЅ: 2/11          в”‚
в”‚                                                                 в”‚
в”‚  [вњ… РџРћР”РўР’Р•Р Р”РРўР¬ Р’РЎРЃ Р—Рђ 19.08]                                  в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”
```

вљ пёЏ вЂ” РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ, РµСЃР»Рё % РІРѕРґРёС‚РµР»СЏ РІС‹С…РѕРґРёС‚ Р·Р° СЂР°РјРєРё 25вЂ“40%.

---

**Р­С‚РѕС‚ РґРѕРєСѓРјРµРЅС‚ вЂ” Р¶РёРІРѕР№. РћР±РЅРѕРІР»СЏРµС‚СЃСЏ РїСЂРё РєР°Р¶РґРѕРј РёР·РјРµРЅРµРЅРёРё.**
