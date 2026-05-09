-- Migration: 20260509000002_loan_repayment_category.sql
-- Добавляет категорию «Погашение кредита/займа» в transaction_categories
--
-- Откат:
--   DELETE FROM transaction_categories WHERE code = 'LOAN_REPAYMENT';

INSERT INTO transaction_categories (id, code, name, direction) VALUES
  ('00000000-0000-0000-0000-000000000020', 'LOAN_REPAYMENT', 'Погашение кредита/займа', 'expense')
ON CONFLICT (code) DO NOTHING;
