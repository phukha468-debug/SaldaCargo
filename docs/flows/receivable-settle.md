# Flow B: Погашение дебиторки от клиента

## Контекст

Клиент «Левша» 10 дней назад взял заказ в долг на 12 000 ₽. Сегодня позвонил, сказал «деньги перевёл на карту». Админ должен зафиксировать приход и закрыть долг.

В БД уже есть транзакция:

```
transactions:
  direction: income
  amount: 12000
  from: ext_clients (Левша)
  to: cash_office (был выбран debt_cash в момент создания)
  settlement_status: pending
  lifecycle_status: approved
  trip_id: <тот рейс>
```

При погашении нужно перевести её settlement в `completed` и записать факт прихода на конкретный кошелёк.

---

## Шаги

### Шаг 1. Список дебиторок

**Где:** MiniApp → `[+ Приход]` → `[Погашение долга]`. Или WebApp → Финансы → Дебиторка.

```
GET /api/receivables?status=open
  ?counterparty_id=<optional>
  ?sort=days_overdue_desc

Use-case:
  1. identity.requireRole(user, ['admin','owner'])
  2. receivables.listOpenReceivables({ filters })
     → внутри:
       SELECT
         t.id, t.amount, t.actual_date, t.description,
         t.trip_id, t.service_order_id,
         c.id AS counterparty_id, c.name AS counterparty_name, c.phone,
         CURRENT_DATE - t.actual_date AS days_open
       FROM transactions t
       JOIN counterparties c ON c.id = t.counterparty_id
       WHERE t.direction = 'income'
         AND t.lifecycle_status = 'approved'
         AND t.settlement_status = 'pending'
       ORDER BY days_open DESC
  3. Возврат массив
```

**UI:** список со статусами (🟢 свежее / 🟡 близко к просрочке / 🔴 просрочено).

---

### Шаг 2. Выбор должника и сумма

Тап на запись «Левша · 12 000 ₽ · 10 дней».

Поля:

- Сколько пришло (по умолчанию полная сумма; можно частично).
- Куда (на какой кошелёк).
- Дата прихода (по умолчанию сегодня).
- Заметка (опц.).

---

### Шаг 3. Закрытие долга

```
POST /api/receivables/:transactionId/settle
  Body: {
    received_amount: "12000.00",
    destination_wallet_id: <ip_rs_id>,
    received_date: "2026-04-28",
    note?: string,
    idempotency_key
  }

Use-case:
  1. identity.requireRole(user, ['admin','owner'])
  2. const tx = await finance.getTransaction(transactionId)
  3. Если tx.settlement_status !== 'pending' → error 'ALREADY_SETTLED'

  4. Если received_amount === tx.amount (полное погашение):
     a. UPDATE transactions SET settlement_status = 'completed',
        to_wallet_id = destination_wallet_id,
        actual_date = received_date,
        updated_at = now()
     // Деньги начислены на нужный кошелёк автоматически (баланс — computed view)

  5. Если received_amount < tx.amount (частичное погашение):
     a. INSERT новой транзакции (
          direction: income,
          amount: received_amount,
          from_wallet_id: ext_clients,
          to_wallet_id: destination_wallet_id,
          settlement_status: 'completed',
          lifecycle_status: 'approved',
          counterparty_id: tx.counterparty_id,
          parent_transaction_id: tx.id,  // ссылка на исходный долг
          description: 'Частичное погашение долга #' || tx.id
        )
     b. UPDATE исходной транзакции: amount -= received_amount
        (остаток продолжает висеть как pending)

  6. INSERT audit_log
```

**Альтернативная стратегия для частичных платежей** (если parent_transaction_id не нравится):

Создать новую таблицу `receivable_payments`:

```sql
CREATE TABLE receivable_payments (
  id UUID PK,
  transaction_id UUID REF transactions(id),
  amount DECIMAL(12,2),
  received_at TIMESTAMPTZ,
  ...
);
```

И смотреть остаток как `tx.amount - SUM(receivable_payments.amount)`. Это чище, но требует отдельной миграции.

**На MVP** — оставляем подход с правкой исходной транзакции и parent_transaction_id для раскола.

---

### Шаг 4. Проверка кредитного лимита (если задан)

При погашении долга — если у клиента был превышен `credit_limit` — может разблокироваться возможность давать ему в долг снова.

```
After settle:
  if counterparty.credit_limit > 0:
    const total_open_debt = receivables.getCounterpartyOpenDebt(counterparty_id)
    if total_open_debt < credit_limit:
      // в водительском MiniApp у него снова появится опция «Долг» для этого клиента
```

Это не отдельный шаг, а свойство `getOpenDebt`.

---

## Особые случаи

### Клиент перевёл больше, чем должен

Например, должен 12 000, перевёл 15 000 (округлил, или предоплата).

В UI флаг overpaid. Two-step:

1. Закрываем существующий долг (12 000).
2. Дополнительно создаётся `transaction income` с пометкой «Предоплата от Левши» — это будущая кредиторка перед клиентом (вернуть или зачесть).

В UI: `[Закрыть долг 12000 + Зафиксировать предоплату 3000]`.

### Клиент гасит несколько долгов сразу

Левша должен 12 000 (рейс от 18.04) и 4 500 (от 22.04). Перевёл 16 500.

Two ways:

- **A:** Каждый долг закрываем отдельно (по очереди).
- **B:** Bulk-операция: выбираем чекбоксами несколько долгов, distributeAmount разносит по FIFO. На MVP — A. Bulk — v2.

### Клиент перевёл, но потом отменил перевод

Бывает: SBP-перевод откатился, банк вернул деньги клиенту.

Действие: в WebApp → Транзакции → найти запись о погашении → `[Отменить]`. Создаётся reverse-транзакция, исходный долг возвращается в pending.

---

## Что важно знать для реализации

1. **Двухосный статус — здесь работает в полную силу.** Lifecycle остаётся `approved` (мы признали, что заказ был — это факт), settlement меняется с `pending` на `completed`.

2. **Идемпотентность критична.** Если админ дважды нажал «Принять оплату» — второй раз должно вернуться то же самое (через idempotency_key), а не списаться долг ещё раз.

3. **`parent_transaction_id`** — поле в `transactions`, ссылается на родительскую при частичных платежах. Нужно добавить в миграцию (если ещё нет).

4. **Кредитный лимит проверяется при создании долга, не при погашении.** При погашении — мы только обновляем сводный показатель `getCounterpartyOpenDebt`.

5. **Realtime:** в WebApp у других админов список дебиторок обновляется (Supabase Realtime подписка на `transactions WHERE settlement_status = 'pending'`).

---

## Связанные документы

- `docs/modules/finance/README.md` — модель транзакций.
- `docs/modules/receivables/README.md` — публичный API.
- `docs/flows/driver-shift.md` — где создаются долги (когда водитель выбирает «Долг» в способах оплаты).
- `docs/flows/admin-cash-collect.md` — выше в этом файле.
