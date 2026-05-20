-- Track per-work salary accrual independently of order approval
-- Rollback: ALTER TABLE service_order_works DROP COLUMN salary_paid;

ALTER TABLE service_order_works
  ADD COLUMN IF NOT EXISTS salary_paid BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN service_order_works.salary_paid IS 'ЗП за эту работу уже начислена администратором';
