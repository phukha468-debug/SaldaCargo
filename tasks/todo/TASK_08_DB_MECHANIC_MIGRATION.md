# TASK 08: Миграция БД для механика

**Адресат:** Claude Code.
**Длительность:** 30–40 минут.
**Зависимости:** TASK_07 выполнен (первая миграция применена).

---

## Цель

Добавить таблицы для модуля механика: наряды, работы, таймер, дефекты, склад запчастей, справочник работ. Применить миграцию, перегенерировать TypeScript типы.

**Без интеграций:** никакого Wialon, никакого Опти24 — только внутренняя логика.

---

## Алгоритм

### Шаг 1. Создать миграцию

```powershell
cd C:\salda
pnpm exec supabase migration new mechanic_schema
```

### Шаг 2. Вставить SQL

```sql
-- ============================================================
-- SaldaCargo — Миграция: модуль механика
-- ============================================================

-- ============================================================
-- СПРАВОЧНИК РАБОТ
-- ============================================================

CREATE TABLE work_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  applicable_asset_type_ids UUID[], -- NULL = применимо ко всем типам
  norm_minutes INTEGER NOT NULL DEFAULT 60,
  default_price_client DECIMAL(12,2) NOT NULL DEFAULT 0,
  internal_cost_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_catalog_name_trgm ON work_catalog USING gin(name gin_trgm_ops);

CREATE TRIGGER trg_work_catalog_updated_at
  BEFORE UPDATE ON work_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- НАРЯДЫ
-- ============================================================

CREATE TYPE service_order_machine_type AS ENUM ('own', 'client');

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number SERIAL,
  machine_type service_order_machine_type NOT NULL DEFAULT 'own',
  asset_id UUID REFERENCES assets(id),            -- для своих машин
  -- для клиентских машин:
  client_vehicle_brand TEXT,
  client_vehicle_model TEXT,
  client_vehicle_reg TEXT,
  client_name TEXT,
  client_phone TEXT,
  counterparty_id UUID REFERENCES counterparties(id),
  odometer_start INTEGER,
  odometer_end INTEGER,
  problem_description TEXT,
  problem_photo_urls TEXT[],
  assigned_mechanic_id UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('created','in_progress','completed','cancelled')) DEFAULT 'created',
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','urgent')) DEFAULT 'normal',
  mechanic_note TEXT,
  admin_note TEXT,
  is_ready_for_pickup BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_orders_mechanic ON service_orders(assigned_mechanic_id);
CREATE INDEX idx_service_orders_asset ON service_orders(asset_id);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_lifecycle ON service_orders(lifecycle_status);

CREATE TRIGGER trg_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK из transactions на service_orders (добавляем то что отложили в TASK_07)
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_service_order
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id);

-- ============================================================
-- РАБОТЫ ВНУТРИ НАРЯДА
-- ============================================================

CREATE TABLE service_order_works (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  work_catalog_id UUID REFERENCES work_catalog(id), -- NULL для свободных работ
  custom_work_name TEXT,    -- заполняется если work_catalog_id IS NULL
  custom_work_description TEXT,
  -- Снимок из каталога на момент добавления (не меняется при изменении каталога)
  norm_minutes INTEGER NOT NULL,
  price_client DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Факт
  actual_minutes INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending','in_progress','paused','completed','cancelled')) DEFAULT 'pending',
  manual_entry BOOLEAN DEFAULT false, -- TRUE если время введено вручную, без таймера
  requires_admin_review BOOLEAN DEFAULT false, -- TRUE для свободных работ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sow_service_order ON service_order_works(service_order_id);

CREATE TRIGGER trg_service_order_works_updated_at
  BEFORE UPDATE ON service_order_works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ТАЙМЕР (сегменты рабочего времени)
-- Несколько записей на одну работу — по числу сегментов (пауза = новый сегмент)
-- ============================================================

CREATE TABLE work_time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_work_id UUID NOT NULL REFERENCES service_order_works(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running','paused','completed')) DEFAULT 'running',
  pause_reason TEXT, -- 'lunch' | 'waiting_part' | 'other_work' | 'end_of_shift' | 'other'
  pause_reason_text TEXT, -- свободный текст если reason = 'other'
  manual_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wtl_work_id ON work_time_logs(service_order_work_id);

-- Только один таймер может быть running одновременно у одного механика
-- Проверяем через триггер
CREATE OR REPLACE FUNCTION check_single_running_timer()
RETURNS TRIGGER AS $$
DECLARE
  mechanic_id UUID;
  running_count INTEGER;
BEGIN
  -- Получаем механика через цепочку work → service_order
  SELECT so.assigned_mechanic_id INTO mechanic_id
  FROM service_order_works sow
  JOIN service_orders so ON so.id = sow.service_order_id
  WHERE sow.id = NEW.service_order_work_id;

  IF NEW.status = 'running' THEN
    SELECT COUNT(*) INTO running_count
    FROM work_time_logs wtl
    JOIN service_order_works sow ON sow.id = wtl.service_order_work_id
    JOIN service_orders so ON so.id = sow.service_order_id
    WHERE so.assigned_mechanic_id = mechanic_id
      AND wtl.status = 'running'
      AND wtl.id != NEW.id;

    IF running_count > 0 THEN
      RAISE EXCEPTION 'У механика уже запущен таймер. Поставьте текущую работу на паузу.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_running_timer
  BEFORE INSERT OR UPDATE ON work_time_logs
  FOR EACH ROW EXECUTE FUNCTION check_single_running_timer();

-- ============================================================
-- ЗАПЧАСТИ НА СКЛАДЕ
-- ============================================================

CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'oil' | 'filter' | 'clutch' | 'brake' | 'engine' | 'other'
  compatible_asset_type_ids UUID[],
  unit TEXT NOT NULL DEFAULT 'шт', -- 'шт' | 'л' | 'кг' | 'м'
  min_stock DECIMAL(10,3) DEFAULT 0,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  client_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parts_name_trgm ON parts USING gin(name gin_trgm_ops);

CREATE TRIGGER trg_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ДВИЖЕНИЯ ЗАПЧАСТЕЙ (остаток = SUM движений, как кошельки)
-- ============================================================

CREATE TABLE part_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID NOT NULL REFERENCES parts(id),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(12,2),
  service_order_id UUID REFERENCES service_orders(id), -- для списания в наряд
  counterparty_id UUID REFERENCES counterparties(id),  -- для прихода от поставщика
  transaction_id UUID REFERENCES transactions(id),     -- финансовая сторона
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_part_movements_part ON part_movements(part_id);
CREATE INDEX idx_part_movements_service_order ON part_movements(service_order_id);

-- ============================================================
-- ЗАПЧАСТИ В НАРЯДЕ
-- ============================================================

CREATE TABLE service_order_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  service_order_work_id UUID REFERENCES service_order_works(id),
  part_id UUID NOT NULL REFERENCES parts(id),
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,  -- снимок закупочной цены
  client_price DECIMAL(12,2) NOT NULL, -- снимок цены для клиента
  status TEXT NOT NULL CHECK (status IN ('reserved','consumed','returned')) DEFAULT 'reserved',
  part_movement_id UUID REFERENCES part_movements(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sop_service_order ON service_order_parts(service_order_id);

CREATE TRIGGER trg_sop_updated_at
  BEFORE UPDATE ON service_order_parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ЗАЯВКИ НА ЗАКУПКУ (от механика)
-- ============================================================

CREATE TABLE purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES parts(id),
  custom_part_name TEXT,   -- если запчасти нет в справочнике
  quantity DECIMAL(10,3) NOT NULL,
  service_order_id UUID REFERENCES service_orders(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','purchased','cancelled')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_purchase_requests_updated_at
  BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- БЭКЛОГ ДЕФЕКТОВ
-- ============================================================

CREATE TABLE defect_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  found_in_service_order_id UUID REFERENCES service_orders(id),
  unit TEXT NOT NULL, -- 'engine' | 'gearbox' | 'suspension' | 'electrical' | 'body' | 'brakes' | 'other'
  description TEXT NOT NULL,
  urgency defect_urgency NOT NULL DEFAULT 'low',
  photo_urls TEXT[],
  status defect_status NOT NULL DEFAULT 'open',
  fixed_in_service_order_id UUID REFERENCES service_orders(id),
  dismissed_reason TEXT,
  found_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  fixed_at TIMESTAMPTZ
);

CREATE INDEX idx_defect_log_asset ON defect_log(asset_id);
CREATE INDEX idx_defect_log_status ON defect_log(status);

-- ============================================================
-- RLS для новых таблиц
-- ============================================================

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Механик видит свои наряды + admin/owner видят все
CREATE POLICY "mechanic_own_orders" ON service_orders
  FOR SELECT USING (
    assigned_mechanic_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    OR created_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    OR is_admin_or_owner()
  );

CREATE POLICY "mechanic_insert_orders" ON service_orders
  FOR INSERT WITH CHECK (
    created_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );

CREATE POLICY "mechanic_update_own_draft" ON service_orders
  FOR UPDATE USING (
    assigned_mechanic_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    AND lifecycle_status = 'draft'
    OR is_admin_or_owner()
  );

-- Работы в наряде — через наряд
CREATE POLICY "sow_via_order" ON service_order_works
  FOR ALL USING (
    service_order_id IN (
      SELECT id FROM service_orders
      WHERE assigned_mechanic_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    )
    OR is_admin_or_owner()
  );

-- Таймер — через работу
CREATE POLICY "wtl_via_work" ON work_time_logs
  FOR ALL USING (
    service_order_work_id IN (
      SELECT sow.id FROM service_order_works sow
      JOIN service_orders so ON so.id = sow.service_order_id
      WHERE so.assigned_mechanic_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    )
    OR is_admin_or_owner()
  );

-- Запчасти — читают все аутентифицированные
CREATE POLICY "parts_read_all" ON parts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "parts_write_admin" ON parts
  FOR ALL USING (is_admin_or_owner());

-- Движения запчастей — механик вставляет, admin видит всё
CREATE POLICY "part_movements_mechanic" ON part_movements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "part_movements_insert" ON part_movements
  FOR INSERT WITH CHECK (
    created_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );

-- Дефекты — механик создаёт, все читают
CREATE POLICY "defect_log_read" ON defect_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "defect_log_insert" ON defect_log
  FOR INSERT WITH CHECK (
    found_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );

CREATE POLICY "defect_log_update_admin" ON defect_log
  FOR UPDATE USING (is_admin_or_owner());

-- Заявки на закупку
CREATE POLICY "purchase_requests_mechanic" ON purchase_requests
  FOR SELECT USING (
    requested_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    OR is_admin_or_owner()
  );

CREATE POLICY "purchase_requests_insert" ON purchase_requests
  FOR INSERT WITH CHECK (
    requested_by IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );
```

### Шаг 3. Применить миграцию

```powershell
pnpm exec supabase db push
```

### Шаг 4. Перегенерировать TypeScript типы

```powershell
pnpm gen:types
pnpm typecheck
```

### Шаг 5. Коммит

```powershell
git add .
git commit -m "feat: миграция — модуль механика

- work_catalog: справочник работ
- service_orders: наряды (своя/клиентская машина)
- service_order_works: работы внутри наряда (снимок цен)
- work_time_logs: сегменты таймера + защита от двух одновременных
- parts, part_movements: склад (остатки через движения)
- service_order_parts: запчасти в наряде
- purchase_requests: заявки на закупку
- defect_log: бэклог дефектов по машинам
- RLS политики для всех новых таблиц"
git push
```

---

## Критерии приёмки

- [ ] `supabase/migrations/<timestamp>_mechanic_schema.sql` создан
- [ ] Миграция применена без ошибок
- [ ] `pnpm gen:types` перегенерировал типы
- [ ] `pnpm typecheck` зелёный
- [ ] Коммит и push выполнены

---

## Отчёт

```
✅ TASK_08 выполнено

Новых таблиц: 8
- work_catalog, service_orders, service_order_works
- work_time_logs, parts, part_movements
- service_order_parts, purchase_requests, defect_log

Команды:
- supabase db push ✓
- pnpm gen:types ✓
- pnpm typecheck ✓

Git: push успешно
```
