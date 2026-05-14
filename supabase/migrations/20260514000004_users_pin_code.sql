-- Rollback: ALTER TABLE users DROP COLUMN IF EXISTS pin_code;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_code TEXT;

UPDATE users SET pin_code = '3030' WHERE name = 'Нигамедьянов А.С.';
UPDATE users SET pin_code = '9111' WHERE name = 'Шахмаев А.О';
