-- ============================================================
-- МИГРАЦИЯ: Новая система расчёта ЗП водителей и грузчиков (v2)
-- ============================================================

-- Поля направления, роли водителя и динамических грузчиков в заказах
ALTER TABLE trip_orders
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS is_driver_loader BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_car_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_loader_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loaders_data JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Дополнительные параметры контрагентов для спец. магазинов с зонами доставки (от 800 ₽)
ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS is_delivery_zone_client BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_delivery_base DECIMAL(12,2) DEFAULT NULL;

-- Индекс для фильтрации/аналитики по направлению заказа
CREATE INDEX IF NOT EXISTS idx_trip_orders_direction ON trip_orders(direction);
