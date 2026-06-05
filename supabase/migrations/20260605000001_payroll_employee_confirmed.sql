-- rollback: ALTER TABLE transactions DROP COLUMN employee_confirmed;

ALTER TABLE transactions
  ADD COLUMN employee_confirmed BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN transactions.employee_confirmed IS
  'NULL = старые данные (считаются подтверждёнными). FALSE = ожидает подтверждения сотрудника. TRUE = подтверждено сотрудником. Заполняется только для PAYROLL-категорий.';

CREATE INDEX idx_transactions_employee_confirmed
  ON transactions(employee_confirmed)
  WHERE employee_confirmed IS NOT NULL;
