# Flow: Ежемесячная амортизация

## Контекст

Каждый месяц 1-го числа в 03:00 (или вручную нажатием кнопки на MVP) — система начисляет амортизацию по всем активным машинам.

**Формула:**

```
monthly_depreciation = residual_value / remaining_life_months
new_book_value = current_book_value - monthly_depreciation
```

Каждое начисление — отдельная транзакция в БД (расход с категории `DEPRECIATION_VEHICLE`, привязанная к машине).

**Зачем:** для корректного P&L. Без амортизации прибыль завышается — машина изнашивается, но это не отражается в расходах.

---

## Шаги

### Шаг 1. Запуск (вручную или по расписанию)

**MVP — вручную:**
WebApp → Настройки → Интеграции → `[🔄 Начислить амортизацию за апрель]`.

**После MVP — pg_cron:**

```sql
SELECT cron.schedule(
  'monthly-depreciation',
  '0 3 1 * *',  -- 1-го числа в 03:00 UTC
  $$ SELECT run_monthly_depreciation(NULL); $$
);
```

### Шаг 2. Расчёт

```
POST /api/admin/depreciation/run
  Body: { period: "2026-04", idempotency_key }

Use-case:
  1. identity.requireRole(user, ['admin','owner'])
  2. fleet.runMonthlyDepreciation({ period, executor_id: user.id })
     → внутри:
       a. SELECT * FROM assets WHERE status IN ('active','reserve','repair')
       b. Для каждой машины:
          - Проверка: уже была транзакция depreciation за этот period? Если да — skip
          - depreciation_amount = current_book_value / remaining_life_months
            (или фиксированная monthly_depreciation, если задана)
          - Если current_book_value < depreciation_amount → берём остаток (не уходим в минус)
          - finance.createTransaction({
              direction: 'expense',
              amount: depreciation_amount,
              category_id: DEPRECIATION_VEHICLE,
              asset_id: asset.id,
              transaction_type: 'depreciation',
              from_wallet_id: ext_book_value_wallet,  // виртуальный
              to_wallet_id: ext_depreciation_wallet,  // виртуальный
              lifecycle_status: 'approved',
              settlement_status: 'completed',
              actual_date: period_start,
              description: 'Амортизация за ' || period
            })
          - UPDATE assets SET
              current_book_value -= depreciation_amount,
              remaining_life_months -= 1
            WHERE id = asset.id
       c. Возврат отчёта: { total_amount, machines_processed, errors }
  3. Response: { success: true, report }
```

**Идемпотентность:** функция проверяет, не была ли уже выполнена амортизация за этот период (через `period_marker` в `audit_log`). Повторный вызов — no-op.

---

### Шаг 3. UI отчёт

После выполнения:

```
✅ Амортизация за апрель 2026
─────────────────────────────
Обработано машин: 11
Общая сумма: 78 540 ₽
Записей в transactions: 11
Записей пропущено: 0

[👁 Посмотреть детали]
```

`[Посмотреть детали]` — список машин с суммой амортизации каждой.

---

## Точки отказа

| Что может пойти не так                                 | Что система делает                     |
| ------------------------------------------------------ | -------------------------------------- |
| Запуск дважды за месяц                                 | Идемпотентный no-op                    |
| `remaining_life_months = 0`                            | Skip, машина полностью самортизирована |
| `current_book_value` стал меньше расчётной амортизации | Списываем остаток                      |
| Машина проданная или списанная                         | Skip                                   |
