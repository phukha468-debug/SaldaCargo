-- Add description field for mechanic's notes per work item
-- Rollback: ALTER TABLE service_order_works DROP COLUMN IF EXISTS work_description;

ALTER TABLE service_order_works
  ADD COLUMN IF NOT EXISTS work_description TEXT;

COMMENT ON COLUMN service_order_works.work_description IS 'Описание выполненных работ (заполняет механик или администратор)';
