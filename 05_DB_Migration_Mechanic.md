# Миграция БД: Расширенная логика механика

**Файл миграции:** `supabase/migrations/20260428100000_mechanic_extended_logic.sql`
**Сопутствующий документ:** этот файл (для понимания изменений), плюс обновление `docs/database/schema.md`.
**Дата:** 28 апреля 2026.

---

## 1. Что делает эта миграция

Добавляет в БД поддержку расширенной работы механиков в MiniApp:

1. **`work_catalog`** — справочник работ с нормами времени и ценами для клиентов.
2. **`service_order_works`** — конкретные работы внутри заказ-наряда, с фактическим временем.
3. **`work_time_logs`** — детальный лог таймера: сегменты «старт-стоп» с причинами пауз.
4. **`defect_log`** — бэклог найденных дефектов по машинам.
5. Расширения существующих таблиц (`service_orders`).

Также добавляются индексы, RLS-политики, триггеры.

---

## 2. SQL миграции

```sql
-- ============================================================================
-- Миграция: расширенная логика механика
-- Создаёт: work_catalog, service_order_works, work_time_logs, defect_log
-- Меняет:  service_orders (новые поля), parts (минимальный порог)
--
-- Откат:
--   DROP TABLE work_time_logs CASCADE;
--   DROP TABLE service_order_works CASCADE;
--   DROP TABLE work_catalog CASCADE;
--   DROP TABLE defect_log CASCADE;
--   ALTER TABLE service_orders DROP COLUMN ...;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Справочник работ
-- ----------------------------------------------------------------------------

CREATE TABLE work_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- К каким типам машин применима работа (массив asset_types.id)
  applicable_asset_type_ids UUID[] DEFAULT '{}',

  -- Норма времени в минутах (рекомендуемая)
  norm_minutes INT NOT NULL CHECK (norm_minutes > 0),

  -- Цена работы для клиента (когда машина клиентская)
  default_price_client DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Внутренняя себестоимость работы (для своих машин)
  -- может быть 0 — себестоимость считается как ЗП механика по факту
  internal_cost_rate DECIMAL(12,2) DEFAULT 0,

  -- Категория работы (для группировки в UI)
  category TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_catalog_code ON work_catalog(code) WHERE is_active = true;
CREATE INDEX idx_work_catalog_category ON work_catalog(category) WHERE is_active = true;

COMMENT ON TABLE work_catalog IS 'Справочник работ СТО с нормами времени и ценами';
COMMENT ON COLUMN work_catalog.norm_minutes IS 'Норма времени в минутах. Сравнивается с фактом из work_time_logs';
COMMENT ON COLUMN work_catalog.default_price_client IS 'Цена работы для клиентских машин. Снимок берётся в service_order_works.price_client при добавлении работы в наряд';

-- ----------------------------------------------------------------------------
-- 2. Расширение существующей таблицы service_orders
-- ----------------------------------------------------------------------------

-- Добавляем поля, нужные для нового флоу
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS assigned_mechanic_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low','normal','urgent')) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS is_external_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_client_name TEXT,
  ADD COLUMN IF NOT EXISTS external_client_phone TEXT,
  ADD COLUMN IF NOT EXISTS external_vehicle_make TEXT,
  ADD COLUMN IF NOT EXISTS external_vehicle_plate TEXT,
  ADD COLUMN IF NOT EXISTS odometer_at_start INT,
  ADD COLUMN IF NOT EXISTS notes_for_admin TEXT;

CREATE INDEX IF NOT EXISTS idx_service_orders_mechanic ON service_orders(assigned_mechanic_id) WHERE status IN ('created','in_progress');
CREATE INDEX IF NOT EXISTS idx_service_orders_asset ON service_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_lifecycle ON service_orders(lifecycle_status, status);

-- ----------------------------------------------------------------------------
-- 3. Конкретные работы внутри наряда
-- ----------------------------------------------------------------------------

CREATE TABLE service_order_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,

  -- Если работа из каталога — ссылка. Если свободная — null.
  work_catalog_id UUID REFERENCES work_catalog(id),

  -- Для свободной работы — название
  custom_work_name TEXT,

  -- Снимок данных из каталога на момент добавления (или для свободной — введённые)
  norm_minutes INT NOT NULL,
  price_client DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Фактическое время в минутах (вычисляется из work_time_logs при закрытии)
  actual_minutes INT,

  -- Статус работы
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'cancelled')),

  -- True, если время введено вручную (не через таймер)
  manual_entry BOOLEAN NOT NULL DEFAULT false,

  -- Помечается, если свободная работа должна быть добавлена в каталог админом
  requires_admin_review BOOLEAN NOT NULL DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Хотя бы одно из полей должно быть заполнено
  CHECK (work_catalog_id IS NOT NULL OR custom_work_name IS NOT NULL)
);

CREATE INDEX idx_sow_service_order ON service_order_works(service_order_id);
CREATE INDEX idx_sow_status ON service_order_works(status);
CREATE INDEX idx_sow_review ON service_order_works(requires_admin_review) WHERE requires_admin_review = true;

COMMENT ON TABLE service_order_works IS 'Работы внутри заказ-наряда. Норма и цена — снимок на момент добавления, не пересчитываются';
COMMENT ON COLUMN service_order_works.actual_minutes IS 'Сумма всех сегментов work_time_logs. Вычисляется при закрытии работы';

-- ----------------------------------------------------------------------------
-- 4. Лог таймера работ
-- ----------------------------------------------------------------------------
-- Каждый старт-стоп — отдельная запись. На одну работу может быть много записей,
-- если механик ставил на паузу и продолжал.
-- Так проще, чем хранить массив пауз внутри одной записи.

CREATE TABLE work_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_work_id UUID NOT NULL REFERENCES service_order_works(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,

  -- Сколько минут работал в этом сегменте (вычисляется при stopped_at)
  duration_minutes INT,

  -- Статус: running — таймер идёт; paused — поставлен на паузу;
  -- completed — работа завершена; expired — таймер автоматически закрыт после X часов простоя
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'completed', 'expired')),

  -- Причина паузы (когда status = paused)
  pause_reason TEXT
    CHECK (pause_reason IN ('lunch', 'break', 'waiting_part', 'other_work', 'shift_end', 'other') OR pause_reason IS NULL),
  pause_reason_text TEXT,  -- свободный текст для 'other'

  -- True, если запись создана вручную (механик забыл нажать «Старт»)
  manual_entry BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wtl_work ON work_time_logs(service_order_work_id);
CREATE INDEX idx_wtl_running ON work_time_logs(status) WHERE status = 'running';

COMMENT ON TABLE work_time_logs IS 'Лог сегментов работы механика. Один сегмент = один цикл старт-стоп';
COMMENT ON COLUMN work_time_logs.duration_minutes IS 'Длина сегмента в минутах. Сумма по всем сегментам работы = service_order_works.actual_minutes';

-- Триггер: при stopped_at автоматически считает duration_minutes
CREATE OR REPLACE FUNCTION calc_work_time_log_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stopped_at IS NOT NULL AND NEW.duration_minutes IS NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.stopped_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_work_time_log_duration
  BEFORE INSERT OR UPDATE ON work_time_logs
  FOR EACH ROW EXECUTE FUNCTION calc_work_time_log_duration();

-- Триггер: при изменении work_time_logs пересчитывает actual_minutes в service_order_works
CREATE OR REPLACE FUNCTION recalc_service_order_work_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_work_id UUID;
  v_total INT;
BEGIN
  v_work_id := COALESCE(NEW.service_order_work_id, OLD.service_order_work_id);
  SELECT COALESCE(SUM(duration_minutes), 0)
    INTO v_total
    FROM work_time_logs
    WHERE service_order_work_id = v_work_id
      AND status IN ('completed', 'paused');
  UPDATE service_order_works
    SET actual_minutes = v_total, updated_at = now()
    WHERE id = v_work_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_sow_actual
  AFTER INSERT OR UPDATE OR DELETE ON work_time_logs
  FOR EACH ROW EXECUTE FUNCTION recalc_service_order_work_actual();

-- ----------------------------------------------------------------------------
-- 5. Бэклог дефектов
-- ----------------------------------------------------------------------------

CREATE TABLE defect_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),

  -- В каком наряде был найден дефект (если найден в процессе ремонта)
  found_in_service_order_id UUID REFERENCES service_orders(id),

  -- Кто зафиксировал
  reported_by UUID NOT NULL REFERENCES users(id),

  -- Узел машины
  unit TEXT NOT NULL
    CHECK (unit IN ('engine','transmission','suspension','electrical','body','brakes','steering','exhaust','cooling','fuel_system','interior','tires','other')),

  description TEXT NOT NULL,

  urgency TEXT NOT NULL
    CHECK (urgency IN ('urgent','soon','later')),

  photo_urls TEXT[] DEFAULT '{}',

  -- Жизненный цикл дефекта
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','planned','in_repair','fixed','dismissed')),

  -- Когда запланирован ремонт
  planned_for_date DATE,
  planned_in_service_order_id UUID REFERENCES service_orders(id),

  -- Когда исправлено
  fixed_in_service_order_id UUID REFERENCES service_orders(id),
  fixed_at TIMESTAMPTZ,

  -- Если отклонён — причина
  dismissed_reason TEXT,
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_defect_asset ON defect_log(asset_id);
CREATE INDEX idx_defect_status ON defect_log(status) WHERE status IN ('open','planned');
CREATE INDEX idx_defect_urgency ON defect_log(urgency, status) WHERE status = 'open';

COMMENT ON TABLE defect_log IS 'Бэклог дефектов автомобилей. Источник для планирования будущих ТО';

-- ----------------------------------------------------------------------------
-- 6. Расширение parts (минимальный порог для алертов)
-- ----------------------------------------------------------------------------

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS min_threshold DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommended_price_client DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS compatible_asset_type_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN parts.min_threshold IS 'Минимальный остаток. Ниже — генерируется алерт';
COMMENT ON COLUMN parts.compatible_asset_type_ids IS 'Совместимость с типами машин. Используется для фильтрации в UI механика';

-- ----------------------------------------------------------------------------
-- 7. RLS политики
-- ----------------------------------------------------------------------------

-- work_catalog: читают все авторизованные, пишут только admin/owner/mechanic_lead
ALTER TABLE work_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_catalog_select_authenticated"
  ON work_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "work_catalog_modify_admins"
  ON work_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND u.role IN ('owner','admin','mechanic_lead')
  ));

-- service_order_works: механик видит свои наряды, админ видит всё
ALTER TABLE service_order_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sow_select_own_or_admin"
  ON service_order_works FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM service_orders so
      JOIN users u ON u.id = auth.uid()
      WHERE so.id = service_order_works.service_order_id
        AND (u.role IN ('owner','admin','mechanic_lead','accountant') OR so.assigned_mechanic_id = auth.uid())
    )
  );

CREATE POLICY "sow_modify_own_or_admin"
  ON service_order_works FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_orders so
      JOIN users u ON u.id = auth.uid()
      WHERE so.id = service_order_works.service_order_id
        AND (u.role IN ('owner','admin','mechanic_lead') OR so.assigned_mechanic_id = auth.uid())
    )
  );

-- work_time_logs: аналогично
ALTER TABLE work_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wtl_access_own_or_admin"
  ON work_time_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_order_works sow
      JOIN service_orders so ON so.id = sow.service_order_id
      JOIN users u ON u.id = auth.uid()
      WHERE sow.id = work_time_logs.service_order_work_id
        AND (u.role IN ('owner','admin','mechanic_lead') OR so.assigned_mechanic_id = auth.uid())
    )
  );

-- defect_log: видят все авторизованные, пишут — кто угодно (создаёт reported_by),
-- меняют статус — только админы
ALTER TABLE defect_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defect_select_authenticated"
  ON defect_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "defect_insert_authenticated"
  ON defect_log FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND reported_by = auth.uid()
  );

CREATE POLICY "defect_update_admin"
  ON defect_log FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND u.role IN ('owner','admin','mechanic_lead')
  ));

-- ----------------------------------------------------------------------------
-- 8. Сид: базовый набор работ
-- ----------------------------------------------------------------------------
-- Минимальный набор для старта. Дополняется через WebApp.

INSERT INTO work_catalog (code, name, norm_minutes, default_price_client, category) VALUES
  ('OIL_CHANGE_GAZELLE', 'Замена масла Газель', 30, 1000, 'maintenance'),
  ('OIL_CHANGE_VALDAI', 'Замена масла Валдай', 45, 1500, 'maintenance'),
  ('FILTERS_CHANGE', 'Замена фильтров (масло, воздух, топливо)', 30, 800, 'maintenance'),
  ('BRAKE_PADS_FRONT', 'Замена передних тормозных колодок', 60, 2000, 'brakes'),
  ('BRAKE_PADS_REAR', 'Замена задних тормозных колодок', 60, 2000, 'brakes'),
  ('CLUTCH_REPLACE_GAZELLE', 'Замена сцепления Газель', 240, 8000, 'transmission'),
  ('CLUTCH_REPLACE_VALDAI', 'Замена сцепления Валдай', 360, 12000, 'transmission'),
  ('TIMING_BELT', 'Замена ремня ГРМ', 180, 5000, 'engine'),
  ('SUSPENSION_DIAGNOSTIC', 'Диагностика подвески', 30, 500, 'suspension'),
  ('TIRES_SWAP', 'Перебортовка шины', 20, 400, 'tires'),
  ('GENERAL_DIAGNOSTIC', 'Общая диагностика', 60, 1500, 'diagnostic'),
  ('WELDING_SMALL', 'Сварочные работы (мелкий ремонт)', 60, 2000, 'body')
ON CONFLICT (code) DO NOTHING;
```

---

## 3. Что обновляется в `docs/database/schema.md`

После применения миграции в `docs/database/schema.md` нужно добавить раздел:

```markdown
## Раздел: СТО и работы механиков (расширенная логика)

### work_catalog

Справочник работ. Норма времени, цена для клиента, совместимость с типами машин.
Используется как источник снимков при добавлении работы в наряд.

### service_orders (расширение)

Добавлены поля: assigned*mechanic_id, started_at, completed_at, priority,
is_external_client, external_client*\*, odometer_at_start, notes_for_admin.

### service_order_works

Работы внутри наряда. Каждая хранит снимок normy времени и цены клиенту
на момент добавления. actual_minutes пересчитывается из work_time_logs триггером.

### work_time_logs

Сегменты работы. Каждый старт-стоп — отдельная запись.
duration_minutes считается триггером.
При изменении пересчитывается actual_minutes в service_order_works.

### defect_log

Бэклог дефектов. Источник планирования будущих ремонтов.
Жизненный цикл: open → planned → in_repair → fixed (или dismissed).
```

---

## 4. Чек-лист после применения миграции

- [ ] Миграция применилась без ошибок (`supabase db push` или `pnpm migrate`).
- [ ] Триггеры работают (создал `work_time_logs`, проверил, что `service_order_works.actual_minutes` пересчиталось).
- [ ] Сид-данные `work_catalog` загрузились (12 базовых работ).
- [ ] RLS политики применились (`SELECT * FROM work_catalog` от имени водителя — должен видеть; от имени неавторизованного — не должен).
- [ ] Сгенерированы новые типы: `pnpm gen:types`.
- [ ] Типы закоммичены в `packages/shared-types/database.types.ts`.
- [ ] Обновлён `docs/database/schema.md`.
- [ ] Обновлён `docs/modules/service/README.md` (новые сущности модуля).
- [ ] Один коммит: `feat(db): расширенная логика механика — work_catalog, service_order_works, work_time_logs, defect_log`.

---

## 5. Откат миграции

Если что-то пошло не так:

```sql
-- В обратном порядке от создания
DROP TRIGGER IF EXISTS trg_recalc_sow_actual ON work_time_logs;
DROP TRIGGER IF EXISTS trg_calc_work_time_log_duration ON work_time_logs;
DROP FUNCTION IF EXISTS recalc_service_order_work_actual();
DROP FUNCTION IF EXISTS calc_work_time_log_duration();
DROP TABLE IF EXISTS work_time_logs;
DROP TABLE IF EXISTS service_order_works;
DROP TABLE IF EXISTS defect_log;
DROP TABLE IF EXISTS work_catalog;
ALTER TABLE service_orders
  DROP COLUMN IF EXISTS assigned_mechanic_id,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS is_external_client,
  DROP COLUMN IF EXISTS external_client_name,
  DROP COLUMN IF EXISTS external_client_phone,
  DROP COLUMN IF EXISTS external_vehicle_make,
  DROP COLUMN IF EXISTS external_vehicle_plate,
  DROP COLUMN IF EXISTS odometer_at_start,
  DROP COLUMN IF EXISTS notes_for_admin;
ALTER TABLE parts
  DROP COLUMN IF EXISTS min_threshold,
  DROP COLUMN IF EXISTS recommended_price_client,
  DROP COLUMN IF EXISTS compatible_asset_type_ids;
```

Сохрани этот блок откатки рядом с миграцией.

---

**Документ живой. Обновляется при каждом изменении схемы СТО.**
