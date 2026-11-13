-- Миграция: Защита от дублей контрагентов по ИНН
-- Частичный уникальный индекс: ИНН должен быть уникальным среди всех активных контрагентов.

CREATE UNIQUE INDEX IF NOT EXISTS uq_counterparties_inn_active
ON counterparties (inn)
WHERE inn IS NOT NULL AND btrim(inn) != '' AND is_active = true;

-- Комментарий к индексу
COMMENT ON INDEX uq_counterparties_inn_active IS 'Гарантирует уникальность ИНН среди активных контрагентов и блокирует случайное создание дублей';
