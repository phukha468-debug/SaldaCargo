-- Migration: 20260509000001_loans_next_payment_date.sql
-- Добавляет поле next_payment_date в таблицу loans
--
-- Откат:
--   ALTER TABLE loans DROP COLUMN IF EXISTS next_payment_date;

ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_payment_date DATE;

COMMENT ON COLUMN loans.next_payment_date IS 'Дата следующего планового платежа. Вводится вручную.';
