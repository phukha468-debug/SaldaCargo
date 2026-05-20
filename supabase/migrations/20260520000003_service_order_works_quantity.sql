-- Rollback: ALTER TABLE service_order_works DROP COLUMN IF EXISTS quantity;

ALTER TABLE service_order_works
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
