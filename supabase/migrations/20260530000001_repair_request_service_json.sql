-- Rollback: ALTER TABLE repair_requests DROP COLUMN service_json;

ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS service_json JSONB;
