-- Добавляем поле ежемесячных постоянных расходов на машину
-- (страховка + транспортный налог + лизинг/кредит)
-- Откат: ALTER TABLE assets DROP COLUMN monthly_fixed_cost;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost DECIMAL(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN assets.monthly_fixed_cost IS
  'Ежемесячные постоянные расходы: страховка + транспортный налог + платёж по лизингу/кредиту';
