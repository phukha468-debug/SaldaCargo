-- Исторические данные: май 2026 (01.05–06.05)
-- Источник: Excel-файлы docs/123/{дата}/{дата}.26.xlsx + docs/123/расходы/расходы.xlsx
-- Rollback:
--   DELETE FROM trip_expenses WHERE created_at >= '2026-05-01' AND created_at < '2026-05-07';
--   DELETE FROM trip_orders   WHERE created_at >= '2026-05-01' AND created_at < '2026-05-07';
--   DELETE FROM trips         WHERE started_at >= '2026-05-01' AND started_at < '2026-05-07';
--   DELETE FROM transactions  WHERE transaction_date >= '2026-05-01' AND transaction_date < '2026-05-07'
--                             AND description LIKE '%[hist]%';

DO $$
DECLARE
  -- Assets
  v_096  UUID;
  v_188  UUID;
  v_446  UUID;
  v_883  UUID;
  v_009  UUID;
  v_051  UUID;
  v_099  UUID;
  v_866  UUID;
  v_877  UUID;

  -- Drivers
  d_semen    UUID;
  d_vova_446 UUID;
  d_evgeny   UUID;
  d_alex     UUID;
  d_alexei   UUID;
  d_denis    UUID;
  d_vova_866 UUID;
  d_faruh    UUID;
  d_owner    UUID;

  v_admin UUID;
  v_trip  UUID;

  CAT_FUEL   CONSTANT UUID := '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
  CAT_OFFICE CONSTANT UUID := '73f565eb-f509-4538-9658-9cdff69bee37';

BEGIN
  -- Ensure loaders_count column exists (если ещё не добавлена)
  ALTER TABLE trips ADD COLUMN IF NOT EXISTS loaders_count SMALLINT NOT NULL DEFAULT 0;

  -- Lookup assets
  SELECT id INTO v_096 FROM assets WHERE reg_number = 'А096МВ196';
  SELECT id INTO v_188 FROM assets WHERE reg_number = 'О188ТА196';
  SELECT id INTO v_446 FROM assets WHERE reg_number = 'У446ВН96';
  SELECT id INTO v_883 FROM assets WHERE reg_number = 'У883АР96';
  SELECT id INTO v_009 FROM assets WHERE short_name = '009';
  SELECT id INTO v_051 FROM assets WHERE short_name = '051';
  SELECT id INTO v_099 FROM assets WHERE short_name = '099';
  SELECT id INTO v_866 FROM assets WHERE short_name = '866';
  SELECT id INTO v_877 FROM assets WHERE short_name = '877';

  -- Lookup drivers
  SELECT id INTO d_semen    FROM users WHERE name = 'Семён'    LIMIT 1;
  SELECT id INTO d_vova_446 FROM users WHERE name = 'Вова' AND current_asset_id = v_446 LIMIT 1;
  SELECT id INTO d_evgeny   FROM users WHERE name = 'Евгений'  LIMIT 1;
  SELECT id INTO d_alex     FROM users WHERE name = 'Александр' LIMIT 1;
  SELECT id INTO d_alexei   FROM users WHERE name = 'Алексей'  LIMIT 1;
  SELECT id INTO d_denis    FROM users WHERE name = 'Денис'    LIMIT 1;
  SELECT id INTO d_vova_866 FROM users WHERE name = 'Вова' AND current_asset_id = v_866 LIMIT 1;
  SELECT id INTO d_faruh    FROM users WHERE name = 'Фарух'    LIMIT 1;
  SELECT id INTO d_owner    FROM users WHERE name = 'Нигамедьянов А.С.' LIMIT 1;

  -- Admin for approved_by / created_by
  SELECT id INTO v_admin FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  IF v_admin IS NULL THEN SELECT id INTO v_admin FROM users WHERE 'owner' = ANY(roles) LIMIT 1; END IF;

  -- ============================================================
  -- 01.05.2026
  -- ============================================================

  -- Газель 877 / Фарух / 1 грузчик
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_877, d_faruh, 1, 'local', 'completed', 'approved',
          0, '2026-05-01 03:00:00Z', '2026-05-01 14:00:00Z', v_admin, '2026-05-02 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 7450.00, 2450.00, 1800.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Газель 051 / Денис
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_051, d_denis, 0, 'local', 'completed', 'approved',
          0, '2026-05-01 03:00:00Z', '2026-05-01 14:00:00Z', v_admin, '2026-05-02 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 4200.00, 1300.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Валдай 446 / Вова / ГСМ 2000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_446, d_vova_446, 0, 'local', 'completed', 'approved',
          0, '2026-05-01 03:00:00Z', '2026-05-01 14:00:00Z', v_admin, '2026-05-02 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 12000.00, 4000.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 2000.00, 'cash', gen_random_uuid());

  -- ============================================================
  -- 02.05.2026
  -- ============================================================

  -- Газель 877 / Фарух / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_877, d_faruh, 0, 'local', 'completed', 'approved',
          0, '2026-05-02 03:00:00Z', '2026-05-02 14:00:00Z', v_admin, '2026-05-03 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 5350.00, 1600.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- Газель 051 / Денис
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_051, d_denis, 0, 'local', 'completed', 'approved',
          0, '2026-05-02 03:00:00Z', '2026-05-02 14:00:00Z', v_admin, '2026-05-03 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 7200.00, 2300.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- ============================================================
  -- 03.05.2026
  -- ============================================================

  -- Газель 877 / Фарух / 1 грузчик / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_877, d_faruh, 1, 'local', 'completed', 'approved',
          0, '2026-05-03 03:00:00Z', '2026-05-03 14:00:00Z', v_admin, '2026-05-04 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 10750.00, 3900.00, 2800.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- Газель 099 / Алексей / 1 грузчик / ГСМ 1600
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_099, d_alexei, 1, 'local', 'completed', 'approved',
          0, '2026-05-03 03:00:00Z', '2026-05-03 14:00:00Z', v_admin, '2026-05-04 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 12500.00, 4200.00, 2000.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1600.00, 'cash', gen_random_uuid());

  -- Газель 051 / Денис / 1 грузчик
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_051, d_denis, 1, 'local', 'completed', 'approved',
          0, '2026-05-03 03:00:00Z', '2026-05-03 14:00:00Z', v_admin, '2026-05-04 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 6250.00, 1900.00, 650.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Валдай 446 / Вова / 1 грузчик
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_446, d_vova_446, 1, 'local', 'completed', 'approved',
          0, '2026-05-03 03:00:00Z', '2026-05-03 14:00:00Z', v_admin, '2026-05-04 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 29500.00, 10000.00, 8750.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- ============================================================
  -- 04.05.2026
  -- ============================================================

  -- Газель 051 / Денис / 1 грузчик / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_051, d_denis, 1, 'local', 'completed', 'approved',
          0, '2026-05-04 03:00:00Z', '2026-05-04 14:00:00Z', v_admin, '2026-05-05 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 13350.00, 4000.00, 2050.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- Газель 009 / Нигамедьянов А.С. (владелец за рулём)
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_009, d_owner, 0, 'local', 'completed', 'approved',
          0, '2026-05-04 03:00:00Z', '2026-05-04 14:00:00Z', v_admin, '2026-05-05 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 700.00, 200.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Валдай 883 / Евгений / 1 грузчик / ГСМ 1500
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_883, d_evgeny, 1, 'local', 'completed', 'approved',
          0, '2026-05-04 03:00:00Z', '2026-05-04 14:00:00Z', v_admin, '2026-05-05 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 20000.00, 4000.00, 3000.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1500.00, 'cash', gen_random_uuid());

  -- Валдай 446 / Вова / 1 грузчик / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_446, d_vova_446, 1, 'local', 'completed', 'approved',
          0, '2026-05-04 03:00:00Z', '2026-05-04 14:00:00Z', v_admin, '2026-05-05 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 30000.00, 10000.00, 10000.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- ============================================================
  -- 05.05.2026
  -- ============================================================

  -- Газель 051 / Денис / межгород Каменск / ГСМ 7000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_051, d_denis, 0, 'intercity', 'completed', 'approved',
          0, '2026-05-05 03:00:00Z', '2026-05-05 18:00:00Z', v_admin, '2026-05-06 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 19000.00, 5000.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 7000.00, 'cash', gen_random_uuid());

  -- Валдай 096 / Семён / ГСМ 6000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_096, d_semen, 0, 'local', 'completed', 'approved',
          0, '2026-05-05 03:00:00Z', '2026-05-05 14:00:00Z', v_admin, '2026-05-06 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 20000.00, 6000.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 6000.00, 'cash', gen_random_uuid());

  -- Газель 866 / Вова / 1 грузчик
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_866, d_vova_866, 1, 'local', 'completed', 'approved',
          0, '2026-05-05 03:00:00Z', '2026-05-05 14:00:00Z', v_admin, '2026-05-06 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 2000.00, 650.00, 650.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Валдай 446 / Вова / 1-я смена
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_446, d_vova_446, 0, 'local', 'completed', 'approved',
          0, '2026-05-05 03:00:00Z', '2026-05-05 10:00:00Z', v_admin, '2026-05-06 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 2500.00, 800.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());

  -- Валдай 446 / Вова / 2-я смена (в Excel числится "Роман" — водитель не в системе, используем Вову)
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_446, d_vova_446, 0, 'local', 'completed', 'approved',
          0, '2026-05-05 11:00:00Z', '2026-05-05 17:00:00Z', v_admin, '2026-05-06 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key, description)
  VALUES (v_trip, 2500.00, 1100.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid(),
          'В журнале водитель указан как Роман');

  -- ============================================================
  -- 06.05.2026
  -- ============================================================

  -- Газель 877 / Фарух / 1 грузчик / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_877, d_faruh, 1, 'local', 'completed', 'approved',
          0, '2026-05-06 03:00:00Z', '2026-05-06 14:00:00Z', v_admin, '2026-05-07 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 11000.00, 3300.00, 2600.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- Газель 009 / Нигамедьянов А.С. / ГСМ 1000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_009, d_owner, 0, 'local', 'completed', 'approved',
          0, '2026-05-06 03:00:00Z', '2026-05-06 14:00:00Z', v_admin, '2026-05-07 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 4000.00, 0.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 1000.00, 'cash', gen_random_uuid());

  -- Валдай 096 / Семён / ГСМ 6000
  INSERT INTO trips (id, asset_id, driver_id, loaders_count, trip_type, status, lifecycle_status,
                     odometer_start, started_at, ended_at, approved_by, approved_at)
  VALUES (gen_random_uuid(), v_096, d_semen, 0, 'local', 'completed', 'approved',
          0, '2026-05-06 03:00:00Z', '2026-05-06 14:00:00Z', v_admin, '2026-05-07 06:00:00Z')
  RETURNING id INTO v_trip;
  INSERT INTO trip_orders (trip_id, amount, driver_pay, loader_pay, loader2_pay, payment_method,
                           lifecycle_status, settlement_status, idempotency_key)
  VALUES (v_trip, 24000.00, 7000.00, 0.00, 0.00, 'cash', 'approved', 'completed', gen_random_uuid());
  INSERT INTO trip_expenses (trip_id, category_id, amount, payment_method, idempotency_key)
  VALUES (v_trip, CAT_FUEL, 6000.00, 'cash', gen_random_uuid());

  -- ============================================================
  -- Прямые расходы (расходы.xlsx, только май)
  -- ============================================================

  -- 05.05: Расчётный счёт — обслуживание 2080
  INSERT INTO transactions (direction, amount, category_id, lifecycle_status, settlement_status,
                             transaction_date, description, idempotency_key, created_by)
  VALUES ('expense', 2080.00, CAT_OFFICE, 'approved', 'completed',
          '2026-05-05 03:00:00Z', 'Расчётный счёт: обслуживание [hist]', gen_random_uuid(), v_admin);

  -- 05.05: Топливо ДТ 15000
  INSERT INTO transactions (direction, amount, category_id, lifecycle_status, settlement_status,
                             transaction_date, description, idempotency_key, created_by)
  VALUES ('expense', 15000.00, CAT_FUEL, 'approved', 'completed',
          '2026-05-05 03:00:00Z', 'Топливо ДТ [hist]', gen_random_uuid(), v_admin);

  -- 05.05: Топливо ДТ 4284
  INSERT INTO transactions (direction, amount, category_id, lifecycle_status, settlement_status,
                             transaction_date, description, idempotency_key, created_by)
  VALUES ('expense', 4284.00, CAT_FUEL, 'approved', 'completed',
          '2026-05-05 04:00:00Z', 'Топливо ДТ [hist]', gen_random_uuid(), v_admin);

  -- 06.05: Топливо ДТ 9000
  INSERT INTO transactions (direction, amount, category_id, lifecycle_status, settlement_status,
                             transaction_date, description, idempotency_key, created_by)
  VALUES ('expense', 9000.00, CAT_FUEL, 'approved', 'completed',
          '2026-05-06 03:00:00Z', 'Топливо ДТ [hist]', gen_random_uuid(), v_admin);

END $$;
