-- ============================================================================
-- Миграция 2.1.3: Строгий Row Level Security (RLS) для Multi-tenancy
-- ============================================================================
-- ROLLBACK PLAN:
--   1. Для каждой таблицы удалить политики tenant_isolation_*
--      (DROP POLICY IF EXISTS tenant_isolation_all ON public.<table>;)
--   2. DROP FUNCTION IF EXISTS public.set_tenant_context(UUID, UUID);
--   3. DROP FUNCTION IF EXISTS public.current_user_id();
--   4. DROP FUNCTION IF EXISTS public.current_organization_id();
-- ============================================================================

-- 1. Хелперы контекста тенанта (сессионные настройки PostgreSQL или JWT claim)
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_organization_id', true), '')::uuid,
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_context(
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_organization_id', COALESCE(p_organization_id::text, ''), true);
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
END;
$$;

-- 2. Включаем RLS и сбрасываем все старые ослабленные политики (USING (true))
--    на всех 45 таблицах (3 таблицы ядра + 42 доменные таблицы)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
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
    'audit_log',
    'organization_members',
    'organization_integrations'
  ];
BEGIN
  -- 2a. Таблица organizations (фильтр по id = current_organization_id())
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
  END LOOP;

  CREATE POLICY tenant_isolation_all ON public.organizations
    FOR ALL
    USING (id = public.current_organization_id())
    WITH CHECK (id = public.current_organization_id());

  -- 2b. Все 44 таблицы с колонкой organization_id
  FOREACH tbl IN ARRAY domain_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY tenant_isolation_all ON public.%I
           FOR ALL
           USING (organization_id = public.current_organization_id())
           WITH CHECK (organization_id = public.current_organization_id())',
        tbl
      );
    END IF;
  END LOOP;
END $$;
