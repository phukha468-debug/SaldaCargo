-- Чистка дублирующихся транзакций ЗП по нарядам #60 и #61
-- Причина: webapp создавал payroll-транзакции БЕЗ service_order_id,
--          поэтому DELETE WHERE service_order_id=X их не затронул.
-- Rollback: невозможен — сохрани SELECT-результат перед запуском.

-- ШАГ 0: Посмотреть все транзакции (запусти первым, READ ONLY)
SELECT
  so.order_number,
  t.id,
  t.direction,
  t.amount,
  t.description,
  u.name  AS mechanic,
  t.settlement_status,
  t.service_order_id,
  t.created_at
FROM transactions t
JOIN service_orders so ON so.id = t.service_order_id
LEFT JOIN users u ON u.id = t.related_user_id
WHERE so.order_number IN (60, 61)
ORDER BY so.order_number, t.created_at;

-- ШАГ 0b: Посмотреть ORPHANED транзакции (без service_order_id) по Вадику и Ване
-- Замени UUID-ы на реальные ID механиков из таблицы users
SELECT t.id, t.amount, t.description, t.created_at, u.name
FROM transactions t
LEFT JOIN users u ON u.id = t.related_user_id
WHERE t.service_order_id IS NULL
  AND t.direction = 'expense'
  AND t.description LIKE '%наряд #60%' OR t.description LIKE '%наряд #61%'
ORDER BY t.created_at;

-- ШАГ 1: Удалить orphaned ЗП по нарядам #60 и #61 (без service_order_id)
DELETE FROM transactions
WHERE service_order_id IS NULL
  AND direction = 'expense'
  AND (description LIKE '%наряд #60%' OR description LIKE '%наряд #61%');

-- ШАГ 2: Также удалить транзакции С service_order_id (если остались после возврата)
DELETE FROM transactions
WHERE service_order_id IN (
  SELECT id FROM service_orders WHERE order_number IN (60, 61)
);

-- ШАГ 3: Сбросить salary_paid
UPDATE service_order_works
SET salary_paid = false
WHERE service_order_id IN (
  SELECT id FROM service_orders WHERE order_number IN (60, 61)
);

-- ШАГ 4: Убедиться что наряды в статусе returned (для повторного апрува)
UPDATE service_orders
SET lifecycle_status = 'returned', status = 'in_progress'
WHERE order_number IN (60, 61)
  AND lifecycle_status != 'approved';

-- После этого: апрувни наряды #60 и #61 в WebApp/MiniApp с правильными механиками
