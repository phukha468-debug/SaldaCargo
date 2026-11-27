-- ============================================================================
-- Migration: 20261127000001_orders_unique_trip_order_id.sql
-- Purpose:   Гарантировать на уровне БД, что для каждого trip_order_id
--            может существовать не более одной активной (не cancelled) заявки
--            в таблице orders. Предотвращает появление дублей при гонках
--            параллельных запросов в backfillStrictDocOrders / syncStrictOrdersForTrip.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_orders_unique_active_trip_order_id;
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_trip_order_id
  ON public.orders ((raw_parser_payload->>'trip_order_id'))
  WHERE status <> 'cancelled'
    AND raw_parser_payload->>'trip_order_id' IS NOT NULL
    AND raw_parser_payload->>'trip_order_id' <> '';
