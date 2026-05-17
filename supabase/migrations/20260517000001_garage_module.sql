-- ============================================================
-- SaldaCargo — Миграция: модуль Гараж
-- Откат: см. комментарии в конце файла
-- ============================================================

-- ============================================================
-- 1. НАСТРОЙКИ СТО (одна строка — singleton)
-- ============================================================

CREATE TABLE sto_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- Вставляем начальную строку
INSERT INTO sto_settings (hourly_rate) VALUES (2000.00);

-- ============================================================
-- 2. РАСШИРЯЕМ users: % ЗП механика
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mechanic_salary_pct DECIMAL(5,2) DEFAULT 50.00;

-- ============================================================
-- 3. РАСШИРЯЕМ work_catalog: нормачасы для Валдая
-- ============================================================

ALTER TABLE work_catalog
  ADD COLUMN IF NOT EXISTS norm_minutes_valdai INTEGER;

-- NULL = использовать norm_minutes (единый для всех типов)

-- ============================================================
-- 4. РАСШИРЯЕМ service_orders: второй механик
-- ============================================================

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS second_mechanic_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_service_orders_second_mechanic
  ON service_orders(second_mechanic_id);

-- ============================================================
-- 5. РАСШИРЯЕМ service_order_works: согласование доп. работ
-- ============================================================

-- Статус согласования дополнительной работы администратором
ALTER TABLE service_order_works
  ADD COLUMN IF NOT EXISTS extra_work_status TEXT
    CHECK (extra_work_status IN ('pending_approval', 'approved', 'rejected'))
    DEFAULT NULL;
-- NULL = обычная работа (не дополнительная)
-- 'pending_approval' = механик запросил, ждёт согласования
-- 'approved' = админ одобрил
-- 'rejected' = админ отклонил

ALTER TABLE service_order_works
  ADD COLUMN IF NOT EXISTS extra_work_approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS extra_work_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_work_mechanic_note TEXT; -- что обнаружил механик

-- ============================================================
-- 6. ЗАЯВКИ НА РЕМОНТ ОТ ВОДИТЕЛЕЙ
-- ============================================================

CREATE TABLE repair_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  driver_id UUID NOT NULL REFERENCES users(id),

  -- Описание проблемы: из каталога или свободный текст
  fault_catalog_id UUID REFERENCES fault_catalog(id), -- может быть NULL если текст
  custom_description TEXT, -- свободный текст если нет в каталоге

  -- Статус заявки
  status TEXT NOT NULL
    CHECK (status IN ('new', 'approved', 'rejected', 'cancelled'))
    DEFAULT 'new',

  -- Действие администратора
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,

  -- Связь с нарядом (если заявка одобрена)
  service_order_id UUID REFERENCES service_orders(id),

  idempotency_key UUID UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_repair_requests_driver ON repair_requests(driver_id);
CREATE INDEX idx_repair_requests_asset ON repair_requests(asset_id);
CREATE INDEX idx_repair_requests_status ON repair_requests(status);

CREATE TRIGGER trg_repair_requests_updated_at
  BEFORE UPDATE ON repair_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. КАТАЛОГ НЕИСПРАВНОСТЕЙ (симптомы для водителей)
-- ============================================================

CREATE TABLE fault_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,          -- симптом на языке водителя
  category TEXT NOT NULL       -- 'engine' | 'suspension' | 'brakes' | 'transmission' | 'electrical' | 'body' | 'other'
    CHECK (category IN ('engine','suspension','brakes','transmission','electrical','body','other')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Добавляем FK после создания fault_catalog
ALTER TABLE repair_requests
  ADD CONSTRAINT fk_repair_requests_fault_catalog
  FOREIGN KEY (fault_catalog_id) REFERENCES fault_catalog(id);

-- ============================================================
-- 8. РЕГЛАМЕНТЫ ТО С ОТСЛЕЖИВАНИЕМ ПО АВТОМОБИЛЮ
-- ============================================================

-- Расширяем maintenance_regulations (если таблица уже есть)
-- или создаём если нет
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'maintenance_regulations'
  ) THEN
    CREATE TABLE maintenance_regulations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      asset_type_id UUID REFERENCES asset_types(id),
      work_catalog_id UUID REFERENCES work_catalog(id),
      work_name TEXT NOT NULL,
      interval_km INTEGER,
      interval_months INTEGER,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Трекинг регламентов по конкретному автомобилю
CREATE TABLE maintenance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  maintenance_regulation_id UUID REFERENCES maintenance_regulations(id),
  work_name TEXT NOT NULL,          -- снимок названия
  interval_km INTEGER,
  interval_months INTEGER,
  last_done_km INTEGER,             -- одометр последнего выполнения
  last_done_at DATE,                -- дата последнего выполнения
  next_due_km INTEGER,              -- следующий одометр
  next_due_at DATE,                 -- следующая дата
  alert_status TEXT NOT NULL
    CHECK (alert_status IN ('ok', 'soon', 'overdue', 'active_order'))
    DEFAULT 'ok',
  last_service_order_id UUID REFERENCES service_orders(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_items_asset ON maintenance_items(asset_id);
CREATE INDEX idx_maintenance_items_alert ON maintenance_items(alert_status);

CREATE TRIGGER trg_maintenance_items_updated_at
  BEFORE UPDATE ON maintenance_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. НАЧАЛЬНЫЕ ДАННЫЕ: каталог неисправностей
-- ============================================================

INSERT INTO fault_catalog (name, category) VALUES
  ('Течь масла под машиной',          'engine'),
  ('Скрип при торможении',             'brakes'),
  ('Слабое торможение',               'brakes'),
  ('Вибрация на скорости',             'suspension'),
  ('Посторонний стук в подвеске',      'suspension'),
  ('Не заводится / плохо заводится',   'engine'),
  ('Перегрев двигателя',              'engine'),
  ('Нет тяги / дымит',               'engine'),
  ('Плохо переключаются передачи',     'transmission'),
  ('Горит контрольная лампа',         'electrical'),
  ('Не работает печка / кондиционер', 'electrical'),
  ('Посторонний запах в салоне',       'body');

-- ============================================================
-- 10. НАЧАЛЬНЫЕ ДАННЫЕ: справочник работ (Газель и Валдай)
-- ============================================================

INSERT INTO work_catalog (code, name, norm_minutes, norm_minutes_valdai, default_price_client, internal_cost_rate, is_active) VALUES
  ('OIL_CHANGE',       'Замена масла двигателя',              90,  120, 3000, 1500, true),
  ('AIR_FILTER',       'Замена воздушного фильтра',           30,   30,  750,  375, true),
  ('FUEL_FILTER',      'Замена топливного фильтра',           30,   30,  750,  375, true),
  ('TO_1',             'ТО-1 (масло, фильтры)',              180,  210, 4500, 2250, true),
  ('TO_2',             'ТО-2 (полное)',                      300,  360, 7500, 3750, true),
  ('BRAKE_PADS_FRONT', 'Замена тормозных колодок (пер.)',    120,  150, 3000, 1500, true),
  ('BRAKE_PADS_REAR',  'Замена тормозных колодок (зад.)',     90,  120, 2250, 1125, true),
  ('TIMING_BELT',      'Замена ремня ГРМ',                   240,  300, 6000, 3000, true),
  ('CLUTCH',           'Замена сцепления',                   300,  360, 7500, 3750, true),
  ('SHOCK_FRONT',      'Замена амортизаторов передних',      150,  180, 3750, 1875, true),
  ('ALIGNMENT',        'Регулировка развал-схождения',        90,  120, 2250, 1125, true),
  ('SUSPENSION_DIAG',  'Диагностика ходовой',                 60,   90, 1500,  750, true),
  ('ENGINE_DIAG',      'Диагностика двигателя',               60,   60, 1500,  750, true),
  ('ALTERNATOR',       'Замена генератора',                  120,  150, 3000, 1500, true),
  ('STARTER',          'Замена стартера',                    120,  150, 3000, 1500, true),
  ('ELECTRIC_DIAG',    'Диагностика электрики',               90,   90, 2250, 1125, true)
ON CONFLICT (code) DO UPDATE SET
  norm_minutes = EXCLUDED.norm_minutes,
  norm_minutes_valdai = EXCLUDED.norm_minutes_valdai,
  default_price_client = EXCLUDED.default_price_client,
  internal_cost_rate = EXCLUDED.internal_cost_rate;

-- ============================================================
-- 11. RLS для новых таблиц
-- ============================================================

ALTER TABLE fault_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sto_settings ENABLE ROW LEVEL SECURITY;

-- fault_catalog читают все
CREATE POLICY "fault_catalog_read" ON fault_catalog
  FOR SELECT USING (true);
CREATE POLICY "fault_catalog_write_admin" ON fault_catalog
  FOR ALL USING (is_admin_or_owner());

-- repair_requests: водитель видит свои, admin — все
CREATE POLICY "repair_requests_driver_read" ON repair_requests
  FOR SELECT USING (
    driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
    OR is_admin_or_owner()
  );
CREATE POLICY "repair_requests_driver_insert" ON repair_requests
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM users WHERE max_user_id = auth.uid()::text)
  );
CREATE POLICY "repair_requests_admin_update" ON repair_requests
  FOR UPDATE USING (is_admin_or_owner());

-- maintenance_items: читают все аутентифицированные, пишет admin
CREATE POLICY "maintenance_items_read" ON maintenance_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "maintenance_items_admin_write" ON maintenance_items
  FOR ALL USING (is_admin_or_owner());

-- sto_settings: читают все, пишет admin
CREATE POLICY "sto_settings_read" ON sto_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sto_settings_admin_write" ON sto_settings
  FOR ALL USING (is_admin_or_owner());

-- ============================================================
-- ОТКАТ (при необходимости):
--
-- DROP TABLE IF EXISTS maintenance_items;
-- DROP TABLE IF EXISTS repair_requests;
-- DROP TABLE IF EXISTS fault_catalog;
-- DROP TABLE IF EXISTS sto_settings;
-- ALTER TABLE service_order_works DROP COLUMN IF EXISTS extra_work_status;
-- ALTER TABLE service_order_works DROP COLUMN IF EXISTS extra_work_approved_by;
-- ALTER TABLE service_order_works DROP COLUMN IF EXISTS extra_work_approved_at;
-- ALTER TABLE service_order_works DROP COLUMN IF EXISTS extra_work_mechanic_note;
-- ALTER TABLE service_orders DROP COLUMN IF EXISTS second_mechanic_id;
-- ALTER TABLE work_catalog DROP COLUMN IF EXISTS norm_minutes_valdai;
-- ALTER TABLE users DROP COLUMN IF EXISTS mechanic_salary_pct;
-- ============================================================
