# Flow: Смена водителя

**Файл:** `docs/flows/driver-shift.md`
**Роль:** Водитель (driver)
**Где работает:** MiniApp в МАХ

---

## Контекст сценария

Это самый частый сценарий в системе — повторяется по 5–10 раз в день для каждого водителя. От качества этого flow зависит, будет ли водитель пользоваться приложением или забьёт.

**Принципы:**

- Минимум полей, максимум подсказок.
- Большие пальцы, плохая сеть — всё должно работать офлайн.
- Никаких блокирующих ошибок — спорные места уходят на ревью админу.

---

## Шаги сценария

### Шаг 0. Старт смены — вход в приложение

**Где:** MiniApp, главный экран водителя.

**Что видит водитель:**

- Приветствие.
- Карточка «Подотчёт»: 10 100 ₽ (его текущий долг компании по нал. наличке).
- Карточка «ЗП за месяц»: 45 200 ₽ накоплено.
- Большая кнопка `[🚚 Начать рейс]`.

**Что делает водитель:** жмёт `[🚚 Начать рейс]`.

---

### Шаг 1. Создание рейса

**UI:** экран «Начало рейса».

**Поля:**

- Машина — dropdown (по умолчанию закреплённая).
- Тип рейса — local / intercity / moving / hourly.
- Грузчик — dropdown с опцией «без грузчика».
- Стартовый одометр — число.
- Фото одометра — обязательно для Газелей.

**Действие:** нажатие `[▶ Поехали]`.

**Что происходит технически:**

```
POST /api/trips/start
  Body: {
    asset_id, trip_type, loader_id?, odometer_start, odometer_photo_url, idempotency_key
  }
  Headers: Authorization: Bearer <jwt>

Use-case в API route:
  1. identity.getCurrentUser(req) → User
  2. identity.requireRole(user, ['driver'])
  3. logistics.startTrip({
       driver_id: user.id, asset_id, trip_type, loader_id,
       odometer_start, odometer_photo_url, idempotency_key
     })
     → внутри:
       a. Проверка: нет других in_progress рейсов у этого водителя
       b. Проверка: odometer_start ≥ assets.odometer_current (с warning если меньше)
       c. INSERT trips (lifecycle: draft, status: in_progress)
       d. Возврат Trip объекта
  4. Response: { trip }
```

**БД-эффекты:**

- 1 новая запись в `trips`.
- Одометр в `assets.odometer_current` НЕ обновляется (только при завершении рейса).

**Realtime:** админ в WebApp видит у себя «Активные рейсы» обновление (но это не требует ревью).

---

### Шаг 2. Фиксация заказов в течение дня

**UI:** экран активного рейса с двумя большими кнопками — `[➕ Заказ]` и `[💸 Расход]`.

**Цикл (повторяется 5–10 раз):** водитель приехал на точку, сделал заказ, нажимает `[➕ Заказ]`.

**Поля заказа:**

- Клиент (autocomplete + опция «б/н» + опция «Новый клиент»).
- Сумма заказа.
- ЗП водителя (с подсказкой «~30%»).
- ЗП грузчика (если есть грузчик).
- Способ оплаты: 💵 нал / 📱 QR / 🏦 безнал / ⏳ долг / 💳 карта.

**Что происходит технически:**

```
POST /api/trips/:tripId/orders
  Body: {
    counterparty_id?, client_name?, description, amount,
    driver_pay, loader_pay?, payment_method, idempotency_key
  }

Use-case:
  1. identity.getCurrentUser → проверка, что user.id = trips.driver_id
  2. logistics.addOrder({
       trip_id, counterparty_id, client_name, description,
       amount, driver_pay, loader_pay, payment_method
     })
     → внутри:
       a. Валидация: amount > 0, driver_pay >= 0, payment_method из enum
       b. INSERT trip_orders (driver_pay_percent = driver_pay / amount * 100)
       c. Определение settlement_status:
          - cash, qr, card_driver → completed
          - bank_invoice, debt_cash → pending
       d. Определение целевого кошелька:
          - cash, card_driver → driver_wallet (подотчёт)
          - qr → ip_rs (расчётный счёт)
          - bank_invoice → ip_rs (но settlement: pending)
          - debt_cash → cash_office (но settlement: pending)
       e. finance.createTransaction({
            direction: 'income',
            amount, from_wallet: ext_clients, to_wallet: <определённый>,
            settlement_status: <определённый>, lifecycle_status: 'draft',
            trip_id, transaction_type: 'regular'
          })
       f. UPDATE trip_orders.linked_income_tx_id
       g. Возврат TripOrder
```

**БД-эффекты:**

- 1 новая запись в `trip_orders`.
- 1 новая запись в `transactions` (income, draft, settlement по логике).

**Что НЕ меняется:** балансы кошельков (потому что транзакция в draft, считается только approved).

**Офлайн-сценарий:**

1. Запись сохраняется в IndexedDB сразу с локальным `idempotency_key`.
2. UI показывает заказ как `✓ Сохранено локально`.
3. Когда сеть появляется — из очереди отправляется POST.
4. Сервер по `idempotency_key` дедуплицирует.
5. UI обновляется на `✓ Синхронизировано`.

---

### Шаг 3. Фиксация расходов

Аналогично заказам, но через `[💸 Расход]`.

```
POST /api/trips/:tripId/expenses
  Body: {
    category_id, amount, payment_method, description, receipt_url?, idempotency_key
  }

Use-case:
  1. logistics.addExpense({...})
     → внутри:
       a. INSERT trip_expenses
       b. finance.createTransaction({
            direction: 'expense',
            amount, from_wallet: driver_wallet (если cash/card_driver),
            to_wallet: ext_suppliers, lifecycle: draft, ...
          })
       c. UPDATE trip_expenses.linked_expense_tx_id
```

**Особенность:** если категория = FUEL и способ оплаты = fuel_card (Опти24) — расход НЕ создаётся в этом потоке. UI показывает «Заправки по картам Опти24 загружаются автоматически». Реальная транзакция придёт через `integrations.opti24.sync` (auto-approved).

---

### Шаг 4. Завершение рейса

**Когда:** конец рабочего дня, водитель приехал на базу.

**UI:** экран «Завершение рейса».

**Поля:**

- Конечный одометр.
- Фото одометра (обязательно для Газелей).
- Заметка для админа (опционально).

**Что показывается перед отправкой:**

- Заказов, выручка, ЗП, расходы, прибыль рейса.
- Список долгов с пометкой «требует напоминания».

**Действие:** `[📤 Отправить на ревью]`.

**Что происходит технически:**

```
POST /api/trips/:tripId/complete
  Body: {
    odometer_end, odometer_end_photo_url, notes?, idempotency_key
  }

Use-case:
  1. identity.getCurrentUser → проверка владельца рейса
  2. logistics.completeTrip({
       trip_id, odometer_end, odometer_end_photo_url, notes
     })
     → внутри:
       a. Валидация: odometer_end > odometer_start
       b. UPDATE trips (status: completed, ended_at: now())
       c. fleet.updateOdometer(asset_id, odometer_end)
          → внутри:
            - UPDATE assets.odometer_current = odometer_end
            - Триггер БД проверяет maintenance_regulations
            - Если пробег пересёк порог регламента → INSERT maintenance_alerts
       d. Если у машины GPS (Wialon) → integrations.queueWialonCheck(trip_id)
          (фоновое задание, не блокирует ответ)
       e. Возврат Trip с computed summary
```

**БД-эффекты:**

- UPDATE `trips`: status, ended_at, odometer_end, odometer_end_photo.
- UPDATE `assets`: odometer_current.
- Возможный INSERT в `maintenance_alerts` (если ТО близко).
- Возможная фоновая задача для Wialon (если Валдай).

**Что водитель видит после:** баннер «Рейс ушёл на ревью. Ожидайте подтверждения».

**Realtime:** в WebApp у админа в «Ревью смены» появляется новая карточка рейса (через Supabase Realtime).

---

### Шаг 5. Ожидание ревью

Между завершением и апрувом — рейс висит в `lifecycle: draft`. Водитель в MiniApp видит его в статусе «На ревью».

**Что НЕ происходит:** P&L не меняется, балансы кошельков не меняются, ЗП не начисляется.

**Что МОЖЕТ произойти:** админ возвращает рейс на доработку с комментарием.

---

### Шаг 6a. Утверждение (счастливый путь)

**Где:** WebApp админа, раздел «Ревью смены».

**Что делает админ:** просматривает таблицу заказов, видит подсветку аномалий (если есть), нажимает `[✅ Утвердить]`.

**Что происходит технически:**

```
POST /api/trips/:tripId/approve
  Body: { idempotency_key }

Use-case (в API route):
  1. identity.getCurrentUser → проверка role IN ('admin', 'owner')
  2. logistics.approveTrip({ trip_id, approver_id: user.id })
     → внутри:
       a. UPDATE trips (lifecycle: approved, approved_by, approved_at)
       b. Все trip_orders по этому рейсу → lifecycle: approved
       c. finance.approveTransactionsBatch(trip_id)
          → UPDATE transactions WHERE trip_id = X → lifecycle: approved
       d. Транзакции с settlement: pending остаются pending — это будущая дебиторка.
       e. Возврат summary.
```

**БД-эффекты:**

- UPDATE `trips.lifecycle_status`.
- UPDATE всех `trip_orders` этого рейса.
- UPDATE всех `transactions` этого рейса (lifecycle, не settlement).
- INSERT в `audit_log` записи для всех изменений.

**Что считается дальше (computed views):**

- Балансы кошельков пересчитываются автоматически (вьюхи поверх transactions).
- P&L текущего месяца обновляется.
- Подотчёт водителя обновляется.
- Сумма к ЗП водителя за месяц обновляется.

**Realtime:** в MiniApp водителя обновляется статус рейса на «Утверждён», push-уведомление в МАХ.

---

### Шаг 6b. Возврат на доработку

**Что делает админ:** замечает ошибку, нажимает `[↩️ Вернуть]`, пишет комментарий.

**Технически:**

```
POST /api/trips/:tripId/return
  Body: { comment, idempotency_key }

Use-case:
  1. logistics.returnTripToDraft({ trip_id, returner_id, comment })
     → UPDATE trips (lifecycle: returned, return_comment)
```

**Что видит водитель:** push в МАХ + красный баннер в MiniApp на главной с комментарием.

**Что делает водитель:** открывает рейс, исправляет, снова `[📤 Отправить на ревью]` → возврат к шагу 5.

---

## Точки отказа и обработка

| Что может пойти не так                   | Что система делает                                 |
| ---------------------------------------- | -------------------------------------------------- |
| Сеть пропала во время добавления заказа  | Заказ в IndexedDB, синк позже                      |
| Двойной клик на «Поехали»                | idempotency_key — второй ответ из кэша             |
| Водитель ввёл одометр меньше предыдущего | Warning, но не блок (бывают сбросы)                |
| ЗП > 50% или < 20%                       | Нет блока, подсветка для админа                    |
| Долг от б/н клиента                      | Создаётся pending транзакция, попадает в дебиторку |
| Водитель забыл фото одометра (Газель)    | Блокирующая ошибка на старте/завершении            |
| Параллельная правка водителем и админом  | 409 Conflict, выигрывает админ                     |

---

## Что важно знать для реализации

1. **Все мутации идут в `domain/logistics`**. API routes — тонкие обёртки.
2. **Транзакции БД нужны** при `addOrder` (создаём `trip_orders` + `transactions` атомарно).
3. **Триггер на одометре** — реализован в БД, не в коде. См. миграцию `20260112_maintenance_alerts.sql`.
4. **Idempotency key** — обязателен на всех мутациях, иначе двойной клик создаёт дубль.
5. **Realtime подписки** — в WebApp в `apps/web/app/dashboard/review/page.tsx` подписка на `trips WHERE lifecycle = draft AND status = completed`.

---

## Связанные документы

- `docs/modules/logistics/README.md` — публичный API модуля.
- `docs/modules/finance/README.md` — как создаются транзакции.
- `docs/database/schema.md` — таблицы trips, trip_orders, trip_expenses.
- `docs/flows/admin-cash-collect.md` — что происходит после, когда админ забирает кассу.

---

**Документ живой. Обновляется при изменении flow.**
