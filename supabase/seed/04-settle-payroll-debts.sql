-- Расчёт по всем долгам ЗП
-- Запустить ОДИН РАЗ в Supabase SQL Editor
-- Создаёт транзакции выплаты ЗП для каждого сотрудника на сумму текущего долга
-- Откат: DELETE FROM transactions WHERE description LIKE 'ЗП:% (расчёт)' AND lifecycle_status='approved';

-- Кошелёк: 10000000-0000-0000-0000-000000000002 = Сейф (Наличные)
-- Если деньги выданы с расчётного счёта — поменяй на 10000000-0000-0000-0000-000000000001

WITH earned AS (
  -- ЗП водителей из рейсов
  SELECT
    t.driver_id AS user_id,
    SUM(COALESCE(o.driver_pay::numeric, 0)) AS total_earned
  FROM trips t
  JOIN trip_orders o ON o.trip_id = t.id AND o.lifecycle_status = 'approved'
  WHERE t.lifecycle_status = 'approved' AND t.driver_id IS NOT NULL
  GROUP BY t.driver_id

  UNION ALL

  -- ЗП первого грузчика
  SELECT
    t.loader_id AS user_id,
    SUM(COALESCE(o.loader_pay::numeric, 0)) AS total_earned
  FROM trips t
  JOIN trip_orders o ON o.trip_id = t.id AND o.lifecycle_status = 'approved'
  WHERE t.lifecycle_status = 'approved' AND t.loader_id IS NOT NULL
  GROUP BY t.loader_id

  UNION ALL

  -- ЗП второго грузчика
  SELECT
    t.loader2_id AS user_id,
    SUM(COALESCE(o.loader2_pay::numeric, 0)) AS total_earned
  FROM trips t
  JOIN trip_orders o ON o.trip_id = t.id AND o.lifecycle_status = 'approved'
  WHERE t.lifecycle_status = 'approved' AND t.loader2_id IS NOT NULL
  GROUP BY t.loader2_id

  UNION ALL

  -- ЗП механиков из нарядов
  SELECT
    so.assigned_mechanic_id AS user_id,
    SUM(COALESCE(so.mechanic_pay::numeric, 0)) AS total_earned
  FROM service_orders so
  WHERE so.status = 'completed'
    AND so.assigned_mechanic_id IS NOT NULL
    AND so.mechanic_pay IS NOT NULL
  GROUP BY so.assigned_mechanic_id
),

earned_totals AS (
  SELECT user_id, SUM(total_earned) AS earned
  FROM earned
  WHERE user_id IS NOT NULL
  GROUP BY user_id
  HAVING SUM(total_earned) > 0
),

paid_totals AS (
  SELECT related_user_id AS user_id, SUM(amount::numeric) AS paid
  FROM transactions
  WHERE direction = 'expense'
    AND lifecycle_status = 'approved'
    AND category_id IN (
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
      '18792fa8-fda8-472d-8e04-e19d2c6c053c',
      '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
    )
    AND related_user_id IS NOT NULL
  GROUP BY related_user_id
),

debts AS (
  SELECT
    e.user_id,
    GREATEST(e.earned - COALESCE(p.paid, 0), 0) AS debt
  FROM earned_totals e
  LEFT JOIN paid_totals p ON p.user_id = e.user_id
  WHERE GREATEST(e.earned - COALESCE(p.paid, 0), 0) > 0
    -- Исключаем auto_settle сотрудников (разовые грузчики)
    AND e.user_id IN (SELECT id FROM users WHERE auto_settle = false AND is_active = true)
)

INSERT INTO transactions (
  direction,
  category_id,
  amount,
  description,
  lifecycle_status,
  settlement_status,
  related_user_id,
  from_wallet_id,
  created_by,
  idempotency_key
)
SELECT
  'expense',
  CASE
    WHEN 'driver' = ANY(u.roles) THEN 'd79213ee-3bc6-4433-b58a-ca7ea1040d00'
    WHEN 'loader' = ANY(u.roles) THEN '18792fa8-fda8-472d-8e04-e19d2c6c053c'
    ELSE '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
  END,
  d.debt::numeric(12,2)::text,
  'ЗП: ' || u.name || ' (расчёт)',
  'approved',
  'completed',
  d.user_id,
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM users WHERE 'admin' = ANY(roles) ORDER BY created_at LIMIT 1),
  gen_random_uuid()
FROM debts d
JOIN users u ON u.id = d.user_id;

-- Проверка: посмотреть что вставилось
SELECT u.name, t.amount, t.description, t.created_at
FROM transactions t
JOIN users u ON u.id = t.related_user_id
WHERE t.description LIKE 'ЗП:% (расчёт)'
ORDER BY t.amount::numeric DESC;
