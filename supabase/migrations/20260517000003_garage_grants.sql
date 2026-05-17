-- Fix: добавить GRANT для таблиц модуля Гараж
-- Откат: REVOKE ALL ON TABLE ... FROM service_role, authenticated, anon;

GRANT ALL ON TABLE fault_catalog      TO service_role, authenticated, anon;
GRANT ALL ON TABLE repair_requests    TO service_role, authenticated, anon;
GRANT ALL ON TABLE maintenance_items  TO service_role, authenticated, anon;
GRANT ALL ON TABLE sto_settings       TO service_role, authenticated, anon;
