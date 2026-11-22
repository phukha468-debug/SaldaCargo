-- ============================================================================
-- Migration: 20261122000006_drop_org_id_default.sql
-- Purpose:   Снимает переходный DEFAULT '00000000-0000-4000-8000-000000000001'
--            с колонки organization_id на всех 42 тенантных таблицах.
--
-- IMPORTANT (PRE-APPLY CHECK):
--   Применять ТОЛЬКО после того, как все оставшиеся legacy API-роуты
--   (из Этапа 3) будут переведены на явную передачу `organization_id` в .insert().
--   Для текущей стадии Private Beta переходный DEFAULT страхует Тенанта №1 (ТК501).
--
-- ROLLBACK:
--   DO $$
--   DECLARE
--     tbl TEXT;
--     tables TEXT[] := ARRAY[
--       'users', 'legal_entities', 'wallets', 'transaction_categories',
--       'counterparties', 'vehicles', 'trailers', 'driver_assignments',
--       'orders', 'trips', 'trip_orders', 'trip_expenses', 'trip_documents',
--       'transactions', 'cash_collections', 'manual_receivables',
--       'driver_debts', 'driver_cash_holds', 'staff_shifts', 'payroll_records',
--       'loans', 'loan_payments', 'payment_calendar_obligations',
--       'vehicle_documents', 'vehicle_maintenance', 'vehicle_inspections',
--       'service_orders', 'service_order_works', 'service_order_parts',
--       'sto_clients', 'sto_client_vehicles', 'sto_work_catalog', 'sto_settings',
--       'warehouse_items', 'warehouse_movements', 'purchase_requests',
--       'fuel_cards', 'fuel_transactions', 'loading_points', 'order_presets',
--       'waybill_templates', 'audit_log'
--     ];
--   BEGIN
--     FOREACH tbl IN ARRAY tables LOOP
--       IF EXISTS (
--         SELECT 1 FROM information_schema.columns
--         WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
--       ) THEN
--         EXECUTE format(
--           'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT %L::uuid',
--           tbl, '00000000-0000-4000-8000-000000000001'
--         );
--       END IF;
--     END LOOP;
--   END $$;
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'legal_entities', 'wallets', 'transaction_categories',
    'counterparties', 'vehicles', 'trailers', 'driver_assignments',
    'orders', 'trips', 'trip_orders', 'trip_expenses', 'trip_documents',
    'transactions', 'cash_collections', 'manual_receivables',
    'driver_debts', 'driver_cash_holds', 'staff_shifts', 'payroll_records',
    'loans', 'loan_payments', 'payment_calendar_obligations',
    'vehicle_documents', 'vehicle_maintenance', 'vehicle_inspections',
    'service_orders', 'service_order_works', 'service_order_parts',
    'sto_clients', 'sto_client_vehicles', 'sto_work_catalog', 'sto_settings',
    'warehouse_items', 'warehouse_movements', 'purchase_requests',
    'fuel_cards', 'fuel_transactions', 'loading_points', 'order_presets',
    'waybill_templates', 'audit_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id DROP DEFAULT', tbl);
    END IF;
  END LOOP;
END $$;
