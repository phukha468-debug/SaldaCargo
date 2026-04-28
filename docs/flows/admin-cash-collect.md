# Flow A: Инкассация наличных у водителя

## Контекст

Водитель приехал на базу. У него в подотчёте 15 400 ₽ — это сумма, которую он получил наличными от клиентов за рейсы (минус его наличные расходы в рейсах).

Админ забирает физические деньги, нажимает кнопку — и в системе деньги перетекают с подотчёта водителя в кассу офиса.

---

## Шаги

### Шаг 1. Открытие списка водителей

**Где:** MiniApp админа, главный экран → `[💵 Забрать выручку]`.

```
GET /api/wallets/drivers-with-cash
  Headers: Authorization: Bearer <jwt>

Use-case:
  1. identity.requireRole(user, ['admin','owner'])
  2. finance.getDriverWalletsWithCash()
     → внутри:
       SELECT u.id, u.full_name, w.id as wallet_id,
         finance.getWalletBalance(w.id) AS balance,
         (SELECT MAX(created_at) FROM transactions WHERE to_wallet_id = w.id OR from_wallet_id = w.id) AS last_activity
       FROM users u
       JOIN wallets w ON w.owner_user_id = u.id
       WHERE u.role IN ('driver','loader')
         AND w.type = 'employee_accountable'
         AND finance.getWalletBalance(w.id) > 0
       ORDER BY balance DESC
  3. Возврат списка
```

**UI:** список с балансами по убыванию.

---

### Шаг 2. Выбор водителя и подтверждение суммы

**UI:** тап на «Вова — 15 400 ₽».

Показывается экран с разбивкой:

- Получено наличными за рейсы: 16 400 ₽
- Расходы (ГСМ, мойка): 1 000 ₽
- Текущий остаток: 15 400 ₽

Админ может изменить сумму к забору (например, 15 000 ₽, оставив 400 на завтра).

Поле «Куда»:

- Касса офиса (по умолчанию)
- Сразу на р/с (если планирует ехать в банк)
- Личный карман Владельца (= дивиденды)

---

### Шаг 3. Создание трансфера

```
POST /api/wallets/transfer
  Body: {
    from_wallet_id: <driver_wallet_id>,
    to_wallet_id: <cash_office_id>,
    amount: "15000.00",
    transaction_type: "cash_collect",
    description: "Инкассация Вова, остаток 400₽",
    idempotency_key
  }

Use-case:
  1. identity.requireRole(user, ['admin','owner'])
  2. finance.createTransfer({
       from_wallet_id, to_wallet_id, amount,
       transaction_type: 'cash_collect',
       lifecycle_status: 'approved',  // админ создаёт сразу approved
       settlement_status: 'completed',
       created_by: user.id
     })
     → внутри:
       a. Валидация: from_wallet.balance >= amount
       b. INSERT transactions (direction: transfer)
       c. Возврат Transaction
  3. (Опц.) identity.notifyUser(driver_id, 'Админ забрал 15000 ₽. Остаток: 400 ₽')
     → POST в МАХ Bot API
```

**БД-эффекты:**

- 1 запись в `transactions` (direction: transfer, lifecycle: approved, settlement: completed).
- Балансы кошельков пересчитываются автоматически (computed view).

**Что видит водитель:** push в МАХ + при следующем открытии MiniApp в карточке «Подотчёт» — обновлённый баланс 400 ₽.

---

## Особые случаи

### Уволенный водитель остался должен

Например: водитель брал авансы под будущие рейсы. Уволился — а его подотчёт показывает **отрицательный** баланс (он должен компании).

В MiniApp водитель уже не зайдёт. В WebApp в разделе «Финансы → Кошельки» админ видит его кошелёк красным.

Действие: `[Перевести в дебиторку как личный долг]`:

- `transactions transfer` с `from_wallet = driver_wallet`, `to_wallet = ext_clients` (виртуальный)
- Создаётся запись о долге уволенного как обычная дебиторка.
- Кошелёк водителя становится 0.

### Овершут (хочется забрать больше, чем у водителя есть)

Например, у водителя 15 400, а админ ввёл 16 000.

Use-case `finance.createTransfer` валидирует баланс. Возвращает ошибку `INSUFFICIENT_FUNDS`. UI показывает «У водителя только 15 400 ₽».
