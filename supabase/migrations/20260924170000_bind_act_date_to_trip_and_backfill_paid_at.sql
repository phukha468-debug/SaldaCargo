-- ============================================================
-- МИГРАЦИЯ: Привязка даты Акта к дате рейса и заполнение invoice_paid_at
-- ============================================================

-- 1. Для всех существующих и будущих заказов привязываем дату Акта (invoice_date) к дате рейса (started_at)
UPDATE trip_orders
SET invoice_date = (t.started_at AT TIME ZONE 'UTC')::date
FROM trips t
WHERE trip_orders.trip_id = t.id
  AND trip_orders.invoice_date IS NULL;

-- 2. Для всех завершённых заказов (погашенных администратором) заполняем дату погашения (invoice_paid_at) из updated_at
UPDATE trip_orders
SET invoice_paid_at = updated_at
WHERE settlement_status = 'completed'
  AND invoice_paid_at IS NULL;
