-- ============================================================
-- Восстановление ЗП для рейсов 107 и 108 (начислены не были)
-- Причина: MiniApp апрув не создавал PAYROLL транзакции
-- Запустить в Supabase SQL Editor
-- Откат: DELETE FROM transactions WHERE description LIKE '%рейс №107%' OR description LIKE '%рейс №108%'
--        AND settlement_status = 'pending' AND category_id IN (
--          'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
--          '18792fa8-fda8-472d-8e04-e19d2c6c053c'
--        )
-- ============================================================

DO $$
DECLARE
  r RECORD;
  o RECORD;
  v_driver_pay NUMERIC;
  v_loader_pay_map JSONB := '{}'::JSONB;
  v_loader_id UUID;
  v_loader_name TEXT;
  v_pay NUMERIC;
  v_admin_id UUID;
BEGIN
  -- Берём первого администратора/владельца как автора транзакций
  SELECT id INTO v_admin_id
  FROM users
  WHERE roles && ARRAY['admin','owner']::user_role[]
  LIMIT 1;
  FOR r IN
    SELECT t.id, t.trip_number, t.driver_id,
           (SELECT u.name FROM users u WHERE u.id = t.driver_id) AS driver_name
    FROM trips t
    WHERE t.trip_number IN (107, 108)
  LOOP
    -- Суммируем ЗП водителя по всем активным заказам рейса
    -- Используем алиас ord, т.к. o занята как RECORD-переменная цикла грузчиков
    SELECT COALESCE(SUM(ord.driver_pay::NUMERIC), 0)
    INTO v_driver_pay
    FROM trip_orders ord
    WHERE ord.trip_id = r.id
      AND ord.lifecycle_status != 'cancelled';

    -- Вставляем ЗП водителю если > 0
    IF v_driver_pay > 0 THEN
      -- Проверяем, не существует ли уже транзакция (идемпотентность)
      IF NOT EXISTS (
        SELECT 1 FROM transactions
        WHERE related_user_id = r.driver_id
          AND category_id = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00'
          AND description LIKE '%рейс №' || r.trip_number || '%'
          AND settlement_status = 'pending'
      ) THEN
        INSERT INTO transactions (
          direction, category_id, amount, description,
          lifecycle_status, settlement_status,
          related_user_id, created_by, idempotency_key
        ) VALUES (
          'expense',
          'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
          v_driver_pay,
          'ЗП: ' || r.driver_name || ' — рейс №' || r.trip_number,
          'approved', 'pending',
          r.driver_id, v_admin_id,
          gen_random_uuid()
        );
        RAISE NOTICE 'Вставлена ЗП водителя % (%) = % руб. (рейс %)',
          r.driver_name, r.driver_id, v_driver_pay, r.trip_number;
      ELSE
        RAISE NOTICE 'ЗП водителя рейс % уже существует, пропускаем', r.trip_number;
      END IF;
    END IF;

    -- Перебираем заказы для грузчиков
    FOR o IN
      SELECT loader_id, loader_pay,
             loader2_id, loader2_pay,
             (SELECT u.name FROM users u WHERE u.id = loader_id) AS loader_name,
             (SELECT u.name FROM users u WHERE u.id = loader2_id) AS loader2_name
      FROM trip_orders
      WHERE trip_id = r.id
        AND lifecycle_status != 'cancelled'
        AND (
          (loader_id IS NOT NULL AND loader_pay::NUMERIC > 0)
          OR (loader2_id IS NOT NULL AND loader2_pay::NUMERIC > 0)
        )
    LOOP
      -- Грузчик 1
      IF o.loader_id IS NOT NULL AND o.loader_pay::NUMERIC > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM transactions
          WHERE related_user_id = o.loader_id
            AND category_id = '18792fa8-fda8-472d-8e04-e19d2c6c053c'
            AND description LIKE '%рейс №' || r.trip_number || '%'
            AND settlement_status = 'pending'
        ) THEN
          INSERT INTO transactions (
            direction, category_id, amount, description,
            lifecycle_status, settlement_status,
            related_user_id, created_by, idempotency_key
          ) VALUES (
            'expense',
            '18792fa8-fda8-472d-8e04-e19d2c6c053c',
            o.loader_pay::NUMERIC,
            'ЗП: ' || COALESCE(o.loader_name, 'Грузчик') || ' — рейс №' || r.trip_number,
            'approved', 'pending',
            o.loader_id, v_admin_id,
            gen_random_uuid()
          );
          RAISE NOTICE 'Вставлена ЗП грузчика % = % руб. (рейс %)',
            o.loader_name, o.loader_pay, r.trip_number;
        ELSE
          RAISE NOTICE 'ЗП грузчика % рейс % уже существует', o.loader_name, r.trip_number;
        END IF;
      END IF;

      -- Грузчик 2
      IF o.loader2_id IS NOT NULL AND o.loader2_pay::NUMERIC > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM transactions
          WHERE related_user_id = o.loader2_id
            AND category_id = '18792fa8-fda8-472d-8e04-e19d2c6c053c'
            AND description LIKE '%рейс №' || r.trip_number || '%'
            AND settlement_status = 'pending'
        ) THEN
          INSERT INTO transactions (
            direction, category_id, amount, description,
            lifecycle_status, settlement_status,
            related_user_id, created_by, idempotency_key
          ) VALUES (
            'expense',
            '18792fa8-fda8-472d-8e04-e19d2c6c053c',
            o.loader2_pay::NUMERIC,
            'ЗП: ' || COALESCE(o.loader2_name, 'Грузчик 2') || ' — рейс №' || r.trip_number,
            'approved', 'pending',
            o.loader2_id, v_admin_id,
            gen_random_uuid()
          );
          RAISE NOTICE 'Вставлена ЗП грузчика2 % = % руб. (рейс %)',
            o.loader2_name, o.loader2_pay, r.trip_number;
        ELSE
          RAISE NOTICE 'ЗП грузчика2 % рейс % уже существует', o.loader2_name, r.trip_number;
        END IF;
      END IF;
    END LOOP;

  END LOOP;
END $$;

-- Проверка результата:
SELECT t.description, t.amount, t.settlement_status, t.direction,
       u.name as employee, tc.name as category
FROM transactions t
LEFT JOIN users u ON u.id = t.related_user_id
LEFT JOIN transaction_categories tc ON tc.id = t.category_id
WHERE (t.description LIKE '%рейс №107%' OR t.description LIKE '%рейс №108%')
  AND t.category_id IN (
    'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
    '18792fa8-fda8-472d-8e04-e19d2c6c053c'
  )
ORDER BY t.description;
