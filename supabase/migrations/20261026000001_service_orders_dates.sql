-- Migration: 20261026000001_service_orders_dates.sql
-- Добавление полей даты и времени начала и окончания заказ-наряда
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Индексы для ускорения выборок и фильтрации по датам
CREATE INDEX IF NOT EXISTS idx_service_orders_started_at ON service_orders(started_at);
CREATE INDEX IF NOT EXISTS idx_service_orders_completed_at ON service_orders(completed_at);
