-- ============================================================
-- МИГРАЦИЯ: Учёт счетов и актов B2B юрлиц в SaldaCargo
-- ============================================================

-- Откат:
-- ALTER TABLE trip_orders DROP COLUMN IF EXISTS invoice_number;
-- ALTER TABLE trip_orders DROP COLUMN IF EXISTS invoice_date;
-- ALTER TABLE trip_orders DROP COLUMN IF EXISTS invoice_status;
-- ALTER TABLE trip_orders DROP COLUMN IF EXISTS invoice_paid_at;

-- 1. Добавляем поля учёта счетов в таблицу trip_orders
ALTER TABLE trip_orders
  ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT NOT NULL DEFAULT 'unbilled',
  ADD COLUMN IF NOT EXISTS invoice_paid_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN trip_orders.invoice_number IS 'Номер счёта или акта выполненных работ (например 33, 34)';
COMMENT ON COLUMN trip_orders.invoice_date IS 'Дата выставления счёта/акта';
COMMENT ON COLUMN trip_orders.invoice_status IS 'Статус выставления счёта: unbilled (к выставлению), issued (выставлен, ожидает оплаты), paid (оплачен)';
COMMENT ON COLUMN trip_orders.invoice_paid_at IS 'Дата фактической оплаты счёта';

CREATE INDEX IF NOT EXISTS idx_trip_orders_invoice_status ON trip_orders(invoice_status);
CREATE INDEX IF NOT EXISTS idx_trip_orders_invoice_number ON trip_orders(invoice_number);

-- 2. Обновляем флаг is_legal_entity для всех 7 пилотных компаний
UPDATE counterparties
SET is_legal_entity = true
WHERE name ILIKE '%Геострой%'
   OR name ILIKE '%ВСМПО%'
   OR name ILIKE '%УВС%'
   OR name ILIKE '%Мизёв%'
   OR name ILIKE '%Территория%'
   OR name ILIKE '%ЭКО Дело%'
   OR name ILIKE '%Эвинян%';

-- 3. Начальная привязка данных для ООО "Геостройиндустрия" (83db41b2-c050-4013-a878-bda2ab5c226e)
-- Исторические закрытые заказы помечаем как paid
UPDATE trip_orders
SET invoice_status = 'paid',
    invoice_paid_at = updated_at
WHERE counterparty_id = '83db41b2-c050-4013-a878-bda2ab5c226e'
  AND settlement_status = 'completed';

-- Привязываем 5 выставленных актов
-- Акт № 33 (14.09.2026, 30 000 руб, рейс 667)
UPDATE trip_orders
SET invoice_number = '33',
    invoice_date = '2026-09-14',
    invoice_status = 'issued'
WHERE id = '47198ca4-3fbd-44b3-a6da-cf433726367d';

-- Акт № 34 (14.09.2026, 40 000 руб, рейс 670)
UPDATE trip_orders
SET invoice_number = '34',
    invoice_date = '2026-09-14',
    invoice_status = 'issued'
WHERE id = '4987196b-ee70-4b3a-93cf-90aad4e758b8';

-- Акт № 35 (15.09.2026, 50 000 руб, рейс 679)
UPDATE trip_orders
SET invoice_number = '35',
    invoice_date = '2026-09-15',
    invoice_status = 'issued'
WHERE id = 'f2571e54-90cc-4c47-a98b-47089e6f7681';

-- Акт № 36 (17.09.2026, 30 000 руб, рейс 683)
UPDATE trip_orders
SET invoice_number = '36',
    invoice_date = '2026-09-17',
    invoice_status = 'issued'
WHERE id = '2d3b32c2-2e30-46eb-812e-18f0b39448a4';

-- Акт № 37 (18.09.2026, 40 000 руб, рейс 688)
UPDATE trip_orders
SET invoice_number = '37',
    invoice_date = '2026-09-18',
    invoice_status = 'issued'
WHERE id = '1a9b76ad-065d-4766-bbb6-509ba05a6e18';

-- Рейс 693 (50 000 руб) — не выставлен
UPDATE trip_orders
SET invoice_status = 'unbilled',
    invoice_number = NULL,
    invoice_date = NULL
WHERE id = 'e8716290-bae6-48ca-a2e8-0d8b355c77c6';
