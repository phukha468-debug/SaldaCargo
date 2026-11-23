-- =============================================================================
-- Миграция: синхронизация SEQUENCE для trips.trip_number и защита от дублей
--
-- Причина: ручная генерация max(trip_number)+1 в автопилоте Wialon не сдвигала
-- PostgreSQL SEQUENCE, из-за чего последующие ручные рейсы получали уже занятые
-- номера (#1016, #1037, #1056-#1060, #1064, #1067).
--
-- План отката (Rollback):
--   DROP INDEX IF EXISTS public.idx_trips_org_trip_number_unique_new;
-- =============================================================================

-- 1. Синхронизируем последовательность trips.trip_number с текущим MAX(trip_number)
DO $$
DECLARE
  v_seq text;
  v_max bigint;
BEGIN
  v_seq := pg_get_serial_sequence('public.trips', 'trip_number');
  IF v_seq IS NOT NULL THEN
    SELECT GREATEST(COALESCE(MAX(trip_number), 1000), 1000) INTO v_max FROM public.trips;
    PERFORM setval(v_seq, v_max, true);
  END IF;
END $$;

-- 2. Частичный UNIQUE-индекс для всех новых рейсов (trip_number > 1067):
-- исторические закрытые дубликаты (#1016-#1060) сохраняются для бухгалтерии,
-- а любые новые дубликаты номеров физически блокируются на уровне PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_org_trip_number_unique_new
  ON public.trips (organization_id, trip_number)
  WHERE trip_number > 1067;

COMMENT ON INDEX public.idx_trips_org_trip_number_unique_new IS
  'Блокирует дубликаты trip_number в рамках организации для всех рейсов с номером > 1067';
