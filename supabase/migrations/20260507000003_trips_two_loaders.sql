-- Два грузчика на рейс: loader2_id в trips, loader2_pay в trip_orders
-- Rollback: ALTER TABLE trips DROP COLUMN IF EXISTS loader2_id;
--           ALTER TABLE trip_orders DROP COLUMN IF EXISTS loader2_pay;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS loader2_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE trip_orders
  ADD COLUMN IF NOT EXISTS loader2_pay DECIMAL(12,2) NOT NULL DEFAULT 0;
