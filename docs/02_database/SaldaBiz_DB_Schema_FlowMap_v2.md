# DB Schema & Flow Map v2 (SaldaBiz)

**Статус:** MVP-ready
**Changelog v2:** Ручной ввод ЗП по каждому заказу, упрощённые assets, pg_cron вместо Vercel Cron, QR как способ оплаты.

---

## 1. Справочники и Ядро (Core)

### Таблицы

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

#### `assets` (УПРОЩЁННАЯ — без даты/цены покупки)
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_type_id         UUID NOT NULL REFERENCES asset_types(id)
business_unit_id      UUID REFERENCES business_units(id)
legal_entity_id       UUID REFERENCES legal_entities(id)
plate_number          TEXT UNIQUE NOT NULL
vin                   TEXT
year                  INT
odometer_current      INT DEFAULT 0
-- Амортизация по остаточной стоимости
residual_value        DECIMAL(12,2) NOT NULL       -- остаточная стоимость НА МОМЕНТ ВВОДА
remaining_life_months INT NOT NULL                  -- оставшийся срок службы в мес
monthly_depreciation  DECIMAL(12,2)                 -- = residual_value / remaining_life_months (вычисляется)
current_book_value    DECIMAL(12,2)                 -- текущая (уменьшается ежемесячно)
-- GPS
wialon_object_id      TEXT                          -- ID в Wialon (только для GPS-машин)
status                TEXT DEFAULT 'active' CHECK (status IN ('active','repair','reserve','sold','written_off'))
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

**При INSERT:** `monthly_depreciation = residual_value / remaining_life_months`, `current_book_value = residual_value`.

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

⚡ **Триггер:** При INSERT user WHERE role IN ('driver','mechanic','mechanic_lead') → автосоздание wallet.

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

### API Routes — Core

```
POST   /api/auth/max                   -- авторизация через MAX
GET    /api/auth/me

CRUD:  /api/users, /api/legal-entities, /api/assets, /api/wallets,
       /api/categories, /api/counterparties, /api/business-units

POST   /api/setup/seed                 -- Setup Wizard (batch insert)
GET    /api/setup/status
```

---

## 2. Рейсы и Заказы (Logistics)

### Таблицы

#### `trips`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id              UUID NOT NULL REFERENCES assets(id)
driver_id             UUID NOT NULL REFERENCES users(id)
loader_id             UUID REFERENCES users(id)           -- грузчик (если есть в экипаже)
trip_type             TEXT DEFAULT 'local' CHECK (trip_type IN ('local','intercity','moving','hourly'))
started_at            TIMESTAMPTZ NOT NULL
ended_at              TIMESTAMPTZ
odometer_start        INT
odometer_end          INT
odometer_start_photo  TEXT                                 -- URL Supabase Storage
odometer_end_photo    TEXT
gps_verified_mileage  INT                                  -- от Wialon
gps_deviation_percent DECIMAL(5,2)                         -- |GPS-одометр|/GPS*100
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

#### `trip_orders` ⭐ НОВАЯ — строки путевого листа

Это **ключевая новая таблица**, которой не было. Каждая строка путевого листа = одна запись. Именно здесь хранится ЗП по каждому заказу.

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID NOT NULL REFERENCES trips(id)
order_number          INT NOT NULL                         -- порядковый номер в листе (1, 2, 3...)
counterparty_id       UUID REFERENCES counterparties(id)   -- null для "б/н"
client_name           TEXT                                  -- свободный текст для быстрого ввода ("Левша", "Интерьер")
description           TEXT                                  -- "Переезд", "Доставка" и т.д.
amount                DECIMAL(12,2) NOT NULL                -- сумма заказа
driver_pay            DECIMAL(12,2) NOT NULL DEFAULT 0     -- ЗП водителя (ручной ввод)
loader_pay            DECIMAL(12,2) DEFAULT 0              -- ЗП грузчика (ручной ввод)
driver_pay_percent    DECIMAL(5,2)                          -- автовычисление: driver_pay/amount*100
payment_method        TEXT NOT NULL CHECK (payment_method IN ('cash','qr','bank_invoice','debt_cash','card_driver'))
settlement_status     TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending','completed'))
-- pending только для: bank_invoice и debt_cash
linked_income_tx_id   UUID REFERENCES transactions(id)     -- автосоздаётся при INSERT
notes                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```

**Логика:**
- При каждом INSERT в `trip_orders` автоматически создаётся `transaction` (income).
- `driver_pay` и `loader_pay` записываются как есть. Формула не пересчитывает.
- `driver_pay_percent` = информационное поле для отчётов.
- Итого ЗП за рейс = SUM(driver_pay) по trip_orders + SUM(loader_pay).

#### `trip_expenses` — расходы в рейсе (отделены от trip_orders)

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id               UUID NOT NULL REFERENCES trips(id)
category_id           UUID NOT NULL REFERENCES categories(id) -- FUEL, PARKING, REPAIR и т.д.
amount                DECIMAL(12,2) NOT NULL
payment_method        TEXT NOT NULL CHECK (payment_method IN ('cash','card_driver','fuel_card'))
description           TEXT
receipt_photo         TEXT                                  -- URL фото чека
linked_expense_tx_id  UUID REFERENCES transactions(id)
created_at            TIMESTAMPTZ DEFAULT now()
```

### Потоки данных

```
[M] Водитель → "Начать рейс":
    1. Выбор машины (авто если закреплена)
    2. Выбор грузчика (из списка или "Без грузчика")
    3. Ввод одометра + обязательное фото (Газель)
    → INSERT trip (in_progress, draft)

[M] Водитель → "+ Заказ" (каждая строка путевого листа):
    1. Клиент: autocomplete или "б/н" (текст)
    2. Сумма: 2700
    3. ЗП водителя: [1000] (подсказка серым: "~810 (30%)")
    4. ЗП грузчика: [1000] (если есть грузчик; подсказка: "~810 (30%)")
    5. Оплата: 💵 Нал / 📱 QR / 🏦 Безнал / ⏳ Долг / 💳 На карту
    → INSERT trip_orders
    → INSERT transaction (income, draft)

[M] Водитель → "+ Расход":
    1. Категория: ГСМ / Стоянка / Мойка / Мелкий ремонт / Прочее
    2. Сумма: 1000
    3. Фото чека (опционально)
    → INSERT trip_expenses
    → INSERT transaction (expense, draft)

[M] Водитель → "🏁 Завершить рейс":
    1. Одометр конечный + фото
    2. Сводка:
       Заказов: 6, Выручка: 16 050
       ЗП водителя: 5 350, ЗП грузчика: 4 950
       Расходы: 1 000
       Прибыль: 4 750
    3. "Отправить на ревью"
    → UPDATE trip (completed, draft)
    → UPDATE assets.odometer_current ⚡ триггер ТО
    → Если GPS: вызов Wialon → запись gps_verified_mileage

[D] Admin → "Ревью смены":
    → Видит все trip за сегодня в draft
    → По каждому: список trip_orders с % водителя
    → ⚠️ Подсветка если % > 40% или < 25%
    → "✅ Подтвердить всё" или "✏️ Редактировать"
    → UPDATE trip + все trip_orders → lifecycle: approved
    → Все связанные transactions → lifecycle: approved
```

### API Routes — Logistics

```
POST   /api/trips/start                -- начало рейса
GET    /api/trips/active               -- текущий активный рейс
POST   /api/trips/:id/orders           -- добавить заказ (строку путевого листа)
POST   /api/trips/:id/expenses         -- добавить расход
POST   /api/trips/:id/complete         -- завершить рейс
POST   /api/trips/:id/approve          -- подтвердить (admin)
POST   /api/trips/:id/cancel           -- отменить (admin)
GET    /api/trips                      -- список
GET    /api/trips/:id                  -- детали с orders и expenses

GET    /api/trips/:id/summary          -- сводка (для экрана завершения):
       {
         orders_count: 6,
         total_revenue: 16050,
         total_driver_pay: 5350,
         total_loader_pay: 4950,
         total_expenses: 1000,
         profit: 4750,
         avg_driver_percent: 33.3,
         pending_debts: [{ client: "б/н", amount: 700 }]
       }
```

---

## 3. Финансы (Finance)

### `transactions` (без изменений структурно от v2)

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

### `payroll_rules` — теперь справочник подсказок

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                  TEXT NOT NULL               -- "Газель локал 30%", "Валдай 10₽/км"
rule_type             TEXT NOT NULL               -- 'percent' | 'per_km' | 'fixed_daily' | 'hourly_split'
value                 DECIMAL(10,4) NOT NULL      -- 0.30 | 10 | 1000 | 3000
split_config          JSONB                        -- {"driver":0.33,"loader":0.33,"company":0.34}
applies_to_asset_type_id UUID REFERENCES asset_types(id)
applies_to_trip_type  TEXT
description           TEXT                         -- пояснение для UI
is_active             BOOLEAN DEFAULT true
created_at            TIMESTAMPTZ DEFAULT now()
```

### `payroll_periods` — расчёт ЗП за период

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL REFERENCES users(id)
period_start        DATE NOT NULL
period_end          DATE NOT NULL
total_trips         INT DEFAULT 0
total_revenue       DECIMAL(12,2) DEFAULT 0       -- выручка привязанных рейсов
total_earned        DECIMAL(12,2) DEFAULT 0       -- SUM(driver_pay или loader_pay из trip_orders)
advances_paid       DECIMAL(12,2) DEFAULT 0       -- уже выданные авансы
balance_to_pay      DECIMAL(12,2) DEFAULT 0       -- total_earned - advances_paid
status              TEXT DEFAULT 'draft'
calculation_details JSONB                          -- детализация: [{trip_id, date, revenue, pay}, ...]
approved_by         UUID REFERENCES users(id)
approved_at         TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
```

### Логика расчёта ЗП за период

```
Для водителя:
  total_earned = SUM(trip_orders.driver_pay) WHERE trip.driver_id = user_id 
                 AND trip.lifecycle_status = 'approved'
                 AND trip.ended_at BETWEEN period_start AND period_end

Для грузчика:
  total_earned = SUM(trip_orders.loader_pay) WHERE trip.loader_id = user_id 
                 AND trip.lifecycle_status = 'approved'
                 AND trip.ended_at BETWEEN period_start AND period_end

advances_paid = SUM(transactions WHERE direction='expense' 
                AND category IN ('PAYROLL_DRIVER','PAYROLL_LOADER') 
                AND user_id = ... AND date BETWEEN ...)

balance_to_pay = total_earned - advances_paid
```

**Важно:** ЗП считается из РЕАЛЬНО ВВЕДЁННЫХ цифр в `trip_orders`, не по формулам. Формулы — только подсказки.

### API Routes — Finance

```
GET    /api/transactions               -- с фильтрами
POST   /api/transactions               -- ручное создание (admin/owner)
PATCH  /api/transactions/:id           -- правка (admin)
POST   /api/transactions/:id/approve
POST   /api/transactions/:id/cancel
POST   /api/transactions/:id/complete  -- settlement → completed
POST   /api/transactions/approve-batch -- ревью смены

GET    /api/money-map                  -- Главная
GET    /api/receivables                -- дебиторка
GET    /api/payables                   -- кредиторка

POST   /api/payroll/calculate          -- расчёт ЗП
GET    /api/payroll/periods
POST   /api/payroll/periods/:id/approve
POST   /api/payroll/periods/:id/pay

GET    /api/my/balance                 -- подотчёт
GET    /api/my/payroll                 -- ЗП

POST   /api/admin/run-depreciation     -- ручная кнопка "Начислить амортизацию"
POST   /api/admin/sync-opti24          -- ручная кнопка "Синхронизировать Опти24"
```

---

## 4. Интеграции (без структурных изменений)

### Опти24

Таблицы: `fuel_cards`, `fuel_transactions_raw` — без изменений.

**Изменение:** вместо Vercel Cron — кнопка «🔄 Синхронизировать Опти24» в Dashboard:
```
[D] Admin жмёт кнопку → POST /api/admin/sync-opti24
→ Edge Function / API Route дёргает Опти24 API
→ Записи в fuel_transactions_raw → auto-approved transactions
→ Ответ: "Синхронизировано: 12 новых заправок за 1 847₽"
```

Позже: pg_cron в Supabase (бесплатно) запускает ту же функцию каждые 15 мин.

### Wialon

Без изменений. Вызывается при закрытии рейса на Валдае.

### Банк

Без изменений. MVP: ручной импорт CSV. Потом: API.

---

## 5. СТО и Регламенты (без структурных изменений)

Таблицы: `maintenance_regulations`, `maintenance_alerts`, `service_orders`, `service_order_works`, `service_order_parts`, `parts`, `part_movements` — без изменений от Flow Map v1.

---

## 6. Оборудование (без изменений)

Таблицы: `fixed_assets`, `tools` — без изменений.

---

## 7. Система (без изменений)

Таблицы: `audit_log`, `attachments` — без изменений.

---

## 8. Полный SQL Init Script (порядок создания)

```sql
-- 1. Enums / Types (опционально, можно CHECK constraints)
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
-- Регламенты ТО (шаблоны)
```

Общее количество таблиц: **22**. Все создаются одним скриптом при инициализации Supabase.

---

## 9. Mini App — экраны водителя (UX-flow)

```
┌──────────────────────────┐
│  🏠 ГЛАВНАЯ (водитель)    │
│                          │
│  [🏁 Начать рейс]        │  ← большая кнопка
│                          │
│  💰 Мой подотчёт: 10 100 │
│  📊 ЗП за август: 45 200 │
│                          │
│  📋 Мои рейсы (история)  │
└──────────────────────────┘
         │
         ▼ (нажал "Начать рейс")
┌──────────────────────────┐
│  🚚 НАЧАЛО РЕЙСА         │
│                          │
│  Машина: [866 ▼]         │
│  Грузчик: [Серёга ▼]     │
│           [Без грузч.]   │
│  Одометр: [______]       │
│  📷 [Фото одометра] ←обяз│
│                          │
│  [▶ ПОЕХАЛИ]             │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│  🚚 РЕЙС #247 (в пути)   │
│  866 · Вова + Серёга     │
│  Начало: 08:30, 142 580км│
│                          │
│  ─── Заказы ──────────── │
│  1. Интерьер  2700  ✅    │
│  2. Переезд   6000  ✅    │
│  3. Див        2000  ✅    │
│                          │
│  Выручка:     10 700     │
│  ЗП вод:       3 650     │
│  ЗП груз:      3 650     │
│                          │
│  [➕ Заказ] [💸 Расход]   │
│                          │
│  [🏁 Завершить рейс]     │
└──────────────────────────┘
         │
         ▼ (нажал "+ Заказ")
┌──────────────────────────┐
│  ➕ НОВЫЙ ЗАКАЗ           │
│                          │
│  Клиент: [Левша____▼]    │
│          [+ Новый]       │
│                          │
│  Сумма:  [650_________]  │
│                          │
│  ЗП водителя:            │
│  [200_________]          │
│  💡 подсказка: ~195 (30%)│
│                          │
│  ЗП грузчика:            │
│  [0___________]          │
│  💡 подсказка: ~195 (30%)│
│                          │
│  Оплата:                 │
│  [💵 Нал] [📱QR] [🏦Сч]  │
│  [⏳Долг] [💳Карта]      │
│                          │
│  [✅ ДОБАВИТЬ]            │
└──────────────────────────┘
         │
         ▼ (нажал "Завершить рейс")
┌──────────────────────────┐
│  🏁 ЗАВЕРШЕНИЕ РЕЙСА     │
│                          │
│  Одометр: [142 640___]   │
│  📷 [Фото одометра]      │
│                          │
│  ─── ИТОГИ ───────────── │
│  Заказов: 6              │
│  Выручка:      16 050    │
│  ЗП водителя:   5 350    │
│  ЗП грузчика:   4 950    │
│  Расходы (ГСМ): 1 000    │
│  ─────────────────────── │
│  Прибыль:        4 750   │
│                          │
│  ⏳ Долги: 700₽ (1 клиент)│
│                          │
│  [📤 ОТПРАВИТЬ НА РЕВЬЮ] │
└──────────────────────────┘
```

---

## 10. Dashboard — экран «Ревью смены»

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 РЕВЬЮ СМЕНЫ · 19 августа 2024                               │
│  12 записей от 2 машин · 25 450₽ выручки · Ожидает подтверждения│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🚚 Машина 866 · Вова + Серёга                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ # │ Клиент    │ Сумма │ ЗП Вод │  %  │ ЗП Гр │ Оплата    ││
│  │ 1 │ Интерьер  │ 2 700 │ 1 000  │ 37% │ 1 000 │ 💵 Нал    ││
│  │ 2 │ Переезд   │ 6 000 │ 2 000  │ 33% │ 2 000 │ 💵 Нал    ││
│  │ 3 │ Див       │ 2 000 │   650  │ 33% │   650 │ 💵 Нал    ││
│  │ 4 │ Див       │ 4 000 │ 1 300  │ 33% │ 1 300 │ 💵 Нал    ││
│  │ 5 │ Левша     │   650 │   200  │ 31% │     0 │ 💵 Нал    ││
│  │ 6 │ б/н    ⚠️ │   700 │   200  │ 29% │     0 │ ⏳ Долг   ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Итого:        │16 050 │ 5 350  │ 33% │ 4 950 │            ││
│  │ ГСМ: 1 000  Прибыль: 4 750  Пробег: 60 км                 ││
│  └─────────────────────────────────────────────────────────────┘│
│  [✅ Подтвердить 866] [✏️ Редактировать]                        │
│                                                                 │
│  🚚 Машина 099 · Денис + Вова(груз)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ # │ Клиент    │ Сумма │ ЗП Вод │  %  │ ЗП Гр │ Оплата    ││
│  │ 1 │ Грут      │ 1 300 │   500  │⚠38% │   350 │ 💵 Нал    ││
│  │ 2 │ Мистер    │   700 │   200  │ 29% │     0 │ 💵 Нал    ││
│  │ 3 │ б/н       │ 1 000 │   300  │ 30% │     0 │ 💵 Нал    ││
│  │ 4 │ б/н       │ 1 000 │   300  │ 30% │     0 │ 💵 Нал    ││
│  │ 5 │ Левша     │ 1 150 │   450  │⚠39% │   250 │ 💵 Нал    ││
│  │ 6 │ 650×5     │ 3 250 │ 1 000  │ 31% │     0 │ 💵 Нал    ││
│  │ 7 │ Переезд⏳ │ 1 000 │   300  │ 30% │     0 │ ⏳ Долг   ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Итого:        │ 9 400 │ 3 050  │ 32% │   600 │            ││
│  │ ГСМ: 1 000  Прибыль: 4 750  Пробег: 45 км                 ││
│  └─────────────────────────────────────────────────────────────┘│
│  [✅ Подтвердить 099] [✏️ Редактировать]                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  💰 ИТОГО ЗА ДЕНЬ                                              │
│  Выручка: 25 450 │ ФОТ: 13 950 (54.8%) │ ГСМ: 2 000           │
│  Прибыль: 9 500  │ Долги: 1 700        │ Машин: 2/11          │
│                                                                 │
│  [✅ ПОДТВЕРДИТЬ ВСЁ ЗА 19.08]                                  │
└─────────────────────────────────────────────────────────────────┘
```

⚠️ — подсвечивается, если % водителя выходит за рамки 25–40%.

---

**Этот документ — живой. Обновляется при каждом изменении.**
