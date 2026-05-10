-- Добавляет поле "наш долг поставщику" в counterparties.
-- Используется для ручного ввода кредиторской задолженности.
--
-- Откат: ALTER TABLE counterparties DROP COLUMN IF EXISTS payable_amount;

ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN counterparties.payable_amount IS 'Сумма которую компания должна этому контрагенту (кредиторская задолженность). Вводится вручную администратором.';
