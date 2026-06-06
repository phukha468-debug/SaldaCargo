-- =============================================================================
-- Очистка дублей ЗП-транзакций
-- =============================================================================
-- Причина дублей: до добавления trip_id в transactions (миграция 20260602000000)
-- при возврате рейса ЗП-транзакции не удалялись. При повторном апруве создавались
-- новые транзакции (с trip_id), а старые (с trip_id = NULL) оставались pending.
--
-- Критерий дубля: существует другая approved ЗП-транзакция с тем же описанием
-- и related_user_id, но с заполненным trip_id (новая, правильная).
--
-- Удаляем только: legacy (trip_id IS NULL) + pending — никогда не трогаем completed.
-- =============================================================================


-- ШАГ 1: ДИАГНОСТИКА — запусти первым, смотри результат перед удалением
-- =============================================================================
SELECT
    u.name                      AS employee,
    t1.description              AS description,
    t1.amount                   AS dup_amount,
    t1.created_at               AS dup_created_at,
    t1.id                       AS dup_id,
    t2.id                       AS real_id,
    t2.trip_id                  AS real_trip_id,
    t2.settlement_status        AS real_status
FROM transactions t1
JOIN transactions t2
    ON  t1.related_user_id = t2.related_user_id
    AND t1.description       = t2.description
    AND t2.trip_id IS NOT NULL
    AND t2.lifecycle_status  = 'approved'
JOIN users u ON u.id = t1.related_user_id
WHERE t1.trip_id         IS NULL
  AND t1.lifecycle_status = 'approved'
  AND t1.settlement_status = 'pending'
  AND t1.category_id IN (
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00',  -- PAYROLL_DRIVER
      '18792fa8-fda8-472d-8e04-e19d2c6c053c'   -- PAYROLL_LOADER
  )
ORDER BY u.name, t1.description;


-- ШАГ 2: ПОДСЧЁТ — сколько строк будет удалено
-- =============================================================================
SELECT COUNT(*) AS rows_to_delete
FROM transactions t1
JOIN transactions t2
    ON  t1.related_user_id = t2.related_user_id
    AND t1.description       = t2.description
    AND t2.trip_id IS NOT NULL
    AND t2.lifecycle_status  = 'approved'
WHERE t1.trip_id          IS NULL
  AND t1.lifecycle_status  = 'approved'
  AND t1.settlement_status = 'pending'
  AND t1.category_id IN (
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
      '18792fa8-fda8-472d-8e04-e19d2c6c053c'
  );


-- ШАГ 3: УДАЛЕНИЕ — запускай только после проверки ШАГ 1
-- =============================================================================
DELETE FROM transactions
WHERE id IN (
    SELECT DISTINCT t1.id
    FROM transactions t1
    JOIN transactions t2
        ON  t1.related_user_id = t2.related_user_id
        AND t1.description       = t2.description
        AND t2.trip_id IS NOT NULL
        AND t2.lifecycle_status  = 'approved'
    WHERE t1.trip_id          IS NULL
      AND t1.lifecycle_status  = 'approved'
      AND t1.settlement_status = 'pending'
      AND t1.category_id IN (
          'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
          '18792fa8-fda8-472d-8e04-e19d2c6c053c'
      )
);
-- Возвращает: DELETE N  (сколько строк удалено)
