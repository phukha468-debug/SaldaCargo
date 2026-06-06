-- Исправление ЗП по наряду #28: Вадик и Ваня по 10 000 ₽
-- Причина: Ваня добавлен как second_mechanic ПОСЛЕ утверждения наряда,
-- поэтому система начислила Вадику полные 20 000 (как единственному механику).

-- ШАГ 1: Смотрим текущее состояние (запустите сначала, не меняя)
SELECT
  t.id,
  u.name,
  t.amount,
  t.settlement_status,
  t.description
FROM transactions t
JOIN service_orders so ON so.id = t.service_order_id
LEFT JOIN users u ON u.id = t.related_user_id
WHERE so.order_number = 28
  AND t.category_id = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
  AND t.lifecycle_status = 'approved';

-- ШАГ 2: Уменьшить ЗП Вадика с 20 000 до 10 000
-- (только если settlement_status = 'pending' — деньги ещё не выплачены)
UPDATE transactions
SET
  amount = '10000.00',
  description = 'ЗП механика Вадик — наряд #28 (10.0 нч × 2000 ₽ × 50%)'
FROM service_orders so
WHERE transactions.service_order_id = so.id
  AND so.order_number = 28
  AND transactions.category_id = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
  AND transactions.lifecycle_status = 'approved'
  AND transactions.settlement_status = 'pending'
  AND transactions.related_user_id IN (
    SELECT id FROM users WHERE name ILIKE '%вад%'
  );

-- ШАГ 3: Начислить ЗП Ване
INSERT INTO transactions (
  direction, lifecycle_status, settlement_status,
  amount, category_id, service_order_id, related_user_id,
  created_by, description, idempotency_key
)
SELECT
  'expense',
  'approved',
  'pending',
  '10000.00',
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  so.id,
  '10405381-50b7-539b-9440-b2b778a8dece',
  (SELECT id FROM users WHERE roles @> '{"admin"}' LIMIT 1),
  'ЗП механика Ваня — наряд #28 (10.0 нч × 2000 ₽ × 50%)',
  gen_random_uuid()
FROM service_orders so
WHERE so.order_number = 28;

-- ШАГ 4: Обновить поля в наряде
UPDATE service_orders
SET mechanic_pay = '10000.00',
    second_mechanic_pay = '10000.00',
    updated_at = now()
WHERE order_number = 28;

-- ШАГ 5: Проверка — должны увидеть двух механиков по 10 000
SELECT
  u.name,
  t.amount,
  t.settlement_status,
  t.description
FROM transactions t
JOIN service_orders so ON so.id = t.service_order_id
LEFT JOIN users u ON u.id = t.related_user_id
WHERE so.order_number = 28
  AND t.category_id = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'
  AND t.lifecycle_status = 'approved';
