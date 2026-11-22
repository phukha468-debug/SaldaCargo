-- ============================================================================
-- Миграция 2.1.2: Добавление organization_id во все 42 доменные таблицы,
-- бэкфилл существующих данных в Тенанта №1 и перевод UNIQUE в per-tenant.
-- ============================================================================
-- ROLLBACK PLAN:
--   1. Удалить составные UNIQUE-индексы uq_*_org_* и восстановить старые UNIQUE.
--   2. Для каждой из 42 таблиц: ALTER TABLE public.<table> DROP COLUMN IF EXISTS organization_id;
--   3. ALTER TABLE public.users DROP COLUMN IF EXISTS default_organization_id;
--   4. DELETE FROM public.organization_members WHERE organization_id = '00000000-0000-4000-8000-000000000001';
--   5. DELETE FROM public.organizations WHERE id = '00000000-0000-4000-8000-000000000001';
-- ============================================================================

-- 1. Создаём Тенанта №1 (детерминированный UUID для zero-downtime миграции существующего кластера)
INSERT INTO public.organizations (id, slug, name, timezone, currency, enabled_modules, plan, is_active)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'default',
  'Default Tenant',
  'Asia/Yekaterinburg',
  'RUB',
  ARRAY['transport', 'garage', 'expeditor', 'warehouse', 'payroll', 'finance'],
  'enterprise',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Добавляем default_organization_id в users и переносим всех пользователей в organization_members
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.users
SET default_organization_id = '00000000-0000-4000-8000-000000000001'
WHERE default_organization_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN default_organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001';

INSERT INTO public.organization_members (organization_id, user_id, roles, is_active)
SELECT
  '00000000-0000-4000-8000-000000000001',
  u.id,
  COALESCE(u.roles, ARRAY['driver']::user_role[]),
  COALESCE(u.is_active, true)
FROM public.users u
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 3. Добавляем organization_id, бэкфиллим Тенанта №1, ставим NOT NULL + переходный DEFAULT и индекс
--    (переходный DEFAULT снимается отдельной миграцией после завершения Задачи 2.2)
DO $$
DECLARE
  default_org CONSTANT UUID := '00000000-0000-4000-8000-000000000001';
  tbl TEXT;
  domain_tables TEXT[] := ARRAY[
    'users',
    'legal_entities',
    'counterparties',
    'driver_documents',
    'asset_types',
    'assets',
    'trips',
    'trip_orders',
    'trip_expenses',
    'orders',
    'order_presets',
    'loading_points_directory',
    'wallets',
    'transaction_categories',
    'transactions',
    'cash_collections',
    'payroll_periods',
    'payroll_rules',
    'daily_finance_audits',
    'loans',
    'manual_receivables',
    'receivable_follow_ups',
    'payment_calendar_obligations',
    'payment_calendar_overrides',
    'sto_settings',
    'client_vehicles',
    'client_vehicle_maintenance_rules',
    'client_vehicle_recommendations',
    'service_orders',
    'service_order_works',
    'service_order_parts',
    'work_catalog',
    'work_time_logs',
    'fault_catalog',
    'defect_log',
    'maintenance_items',
    'maintenance_regulations',
    'repair_requests',
    'parts',
    'part_movements',
    'purchase_requests',
    'audit_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY domain_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT',
        tbl
      );
      EXECUTE format(
        'UPDATE public.%I SET organization_id = %L WHERE organization_id IS NULL',
        tbl, default_org
      );
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT %L',
        tbl, default_org
      );
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
        tbl
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
        'idx_' || tbl || '_organization_id', tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4. Составные индексы для горячих таблиц
CREATE INDEX IF NOT EXISTS idx_transactions_org_status_date
  ON public.transactions (organization_id, lifecycle_status, settlement_status, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_trips_org_status_started
  ON public.trips (organization_id, lifecycle_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_orders_org_trip
  ON public.trip_orders (organization_id, trip_id);

CREATE INDEX IF NOT EXISTS idx_orders_org_created
  ON public.orders (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_orders_org_status
  ON public.service_orders (organization_id, status);

-- 5. Перевод глобальных UNIQUE ограничений в per-tenant (organization_id, ...)
DO $$
BEGIN
  -- assets.reg_number -> (organization_id, reg_number)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_reg_number_key') THEN
    ALTER TABLE public.assets DROP CONSTRAINT assets_reg_number_key;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_org_reg_number
    ON public.assets (organization_id, reg_number);

  -- asset_types.code -> (organization_id, code)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_types_code_key') THEN
    ALTER TABLE public.asset_types DROP CONSTRAINT asset_types_code_key;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_types_org_code
    ON public.asset_types (organization_id, code);

  -- transaction_categories.code -> (organization_id, code)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_categories_code_key') THEN
    ALTER TABLE public.transaction_categories DROP CONSTRAINT transaction_categories_code_key;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_categories_org_code
    ON public.transaction_categories (organization_id, code);

  -- fault_catalog.code -> (organization_id, code)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fault_catalog_code_key') THEN
    ALTER TABLE public.fault_catalog DROP CONSTRAINT fault_catalog_code_key;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_fault_catalog_org_code
    ON public.fault_catalog (organization_id, code);

  -- daily_finance_audits.date -> (organization_id, date)
  IF to_regclass('public.daily_finance_audits') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_finance_audits_date_key') THEN
      ALTER TABLE public.daily_finance_audits DROP CONSTRAINT daily_finance_audits_date_key;
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_finance_audits_org_date
      ON public.daily_finance_audits (organization_id, date);
  END IF;

  -- counterparties active INN -> (organization_id, inn)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_counterparties_inn_active') THEN
    DROP INDEX public.uq_counterparties_inn_active;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_counterparties_org_inn_active
    ON public.counterparties (organization_id, inn)
    WHERE inn IS NOT NULL AND trim(inn) <> '' AND is_active = true;
END $$;
