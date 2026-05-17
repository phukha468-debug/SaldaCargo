-- ============================================================
-- SaldaCargo — два тарифа СТО: клиентские и собственные авто
-- Откат: ALTER TABLE sto_settings DROP COLUMN IF EXISTS hourly_rate_own;
-- ============================================================

-- Добавляем ставку для собственного автопарка
-- hourly_rate        — ставка для клиентских автомобилей (по умолчанию 2000 ₽/ч)
-- hourly_rate_own    — ставка для своих автомобилей      (по умолчанию 1600 ₽/ч)

ALTER TABLE sto_settings
  ADD COLUMN IF NOT EXISTS hourly_rate_own DECIMAL(12,2) NOT NULL DEFAULT 1600.00;

-- Обновляем существующую строку
UPDATE sto_settings SET hourly_rate_own = 1600.00;

-- Комментарии для ясности
COMMENT ON COLUMN sto_settings.hourly_rate     IS 'Ставка нормачаса для КЛИЕНТСКИХ автомобилей (руб/ч)';
COMMENT ON COLUMN sto_settings.hourly_rate_own IS 'Ставка нормачаса для СОБСТВЕННЫХ автомобилей (руб/ч)';
