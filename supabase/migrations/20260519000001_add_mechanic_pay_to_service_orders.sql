-- Add mechanic_pay fields to service_orders
-- Rollback: ALTER TABLE service_orders DROP COLUMN mechanic_pay, DROP COLUMN second_mechanic_pay;

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS mechanic_pay DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS second_mechanic_pay DECIMAL(12,2);

COMMENT ON COLUMN service_orders.mechanic_pay IS 'ЗП основного механика за наряд — сохраняется при утверждении';
COMMENT ON COLUMN service_orders.second_mechanic_pay IS 'ЗП второго механика за наряд — сохраняется при утверждении';
