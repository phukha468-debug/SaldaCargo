-- ============================================================
-- Удаление триггера trg_trip_approved_payroll и его функции
-- Причина: триггер был создан в предыдущей сессии через SQL Editor.
-- Логика ЗП теперь встроена напрямую в API /api/admin/trips/[id].
-- Запустить в Supabase SQL Editor → выполнить → проверить NOTICE.
-- ============================================================

DROP TRIGGER IF EXISTS trg_trip_approved_payroll ON trips;
DROP FUNCTION IF EXISTS fn_trip_approved_payroll() CASCADE;
DROP FUNCTION IF EXISTS trip_approved_payroll() CASCADE;

-- Проверка: триггеров на таблице trips не должно остаться (кроме updated_at и sync_odometer)
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid = 'trips'::regclass
  AND NOT tgisinternal;
