-- Миграция: Отключение подтверждения зарплат сотрудниками.
-- Если рейс или заказ-наряд прошёл ревью — ЗП считается начисленной и готовой к выплате без дополнительных подтверждений.

ALTER TABLE transactions ALTER COLUMN employee_confirmed SET DEFAULT true;

UPDATE transactions
SET employee_confirmed = true
WHERE employee_confirmed = false;

COMMENT ON COLUMN transactions.employee_confirmed IS 'Флаг подтверждения ЗП сотрудником (историческое поле, по умолчанию true; подтверждения более не требуются).';
