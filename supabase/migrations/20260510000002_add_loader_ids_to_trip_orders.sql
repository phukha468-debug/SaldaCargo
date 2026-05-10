-- Добавляем loader_id и loader2_id в trip_orders
-- Откат: ALTER TABLE trip_orders DROP COLUMN loader_id; DROP COLUMN loader2_id;

ALTER TABLE trip_orders
  ADD COLUMN loader_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN loader2_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Индексы для быстрого поиска по грузчику в расчёте ЗП
CREATE INDEX idx_trip_orders_loader_id  ON trip_orders(loader_id)  WHERE loader_id  IS NOT NULL;
CREATE INDEX idx_trip_orders_loader2_id ON trip_orders(loader2_id) WHERE loader2_id IS NOT NULL;
