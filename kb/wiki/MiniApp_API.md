# MiniApp — Справочник API

**Теги:** #api #miniapp #разработка
**Обновлено:** 2026-05-17

Полный перечень API-эндпоинтов `apps/miniapp`. Все роуты используют `createAdminClient()`.

---

## Авторизация (`/api/auth/`)

| Метод | Путь                      | Описание                                          |
| ----- | ------------------------- | ------------------------------------------------- |
| POST  | `/api/auth/max`           | Авторизация через MAX Mini App по `max_user_id`   |
| POST  | `/api/auth/logout`        | Очистка cookie сессии                             |
| GET   | `/api/users/public?role=` | Список активных пользователей по роли (публичный) |
| GET   | `/api/vehicles/public`    | Список активных машин (публичный)                 |

---

## Водитель (`/api/driver/`)

Все эндпоинты читают `salda_user_id` из cookie для идентификации водителя.

| Метод | Путь                             | Описание                                               |
| ----- | -------------------------------- | ------------------------------------------------------ |
| GET   | `/api/driver/trips`              | Рейсы водителя (последние 20)                          |
| GET   | `/api/driver/summary`            | Сводка для главной страницы (активный рейс, ЗП месяца) |
| GET   | `/api/driver/finance`            | Финансы: подотчёт (нал на руках) + ЗП за месяц         |
| GET   | `/api/driver/profile`            | Профиль: имя, телефон, роли, текущая машина            |
| PATCH | `/api/driver/profile`            | Обновить закреплённую машину `{ asset_id }`            |
| GET   | `/api/driver/assets`             | Список машин для выбора при старте рейса               |
| GET   | `/api/driver/loaders`            | Список грузчиков для выбора при старте рейса           |
| GET   | `/api/driver/counterparties`     | Список контрагентов для выбора в заказе                |
| POST  | `/api/driver/counterparties/new` | Создать нового контрагента                             |
| GET   | `/api/driver/categories`         | Категории расходов для формы расхода в рейсе           |
| GET   | `/api/driver/me`                 | Данные текущего пользователя по cookie                 |
| GET   | `/api/driver/fault-catalog`      | Каталог неисправностей (сгруппирован по category)      |
| GET   | `/api/driver/repair-requests`    | Заявки водителя на ремонт (последние 20)               |
| POST  | `/api/driver/repair-requests`    | Создать заявку на ремонт                               |

### `GET /api/driver/finance` — детали ответа

```json
{
  "accountable": {
    "balance": "12500.00",
    "transactions": [
      {
        "id": "uuid",
        "amount": "5000.00",
        "description": "Рейс №42 · 866",
        "payment_method": "cash",
        "created_at": "2026-05-07T..."
      }
    ]
  },
  "salary": {
    "trips": [
      {
        "id": "uuid",
        "trip_number": 42,
        "started_at": "...",
        "lifecycle_status": "approved",
        "asset": { "short_name": "866" },
        "trip_orders": [{ "driver_pay": "1500.00", "lifecycle_status": "approved" }]
      }
    ]
  }
}
```

> Подотчёт считается из `trip_orders` с `payment_method = 'cash'` и `lifecycle_status != 'cancelled'`.
> `card_driver` — корпоративная карта, НЕ входит в подотчёт (деньги не проходят через руки водителя).
> Не ждёт одобрения от админа — данные сразу видны.

---

## Рейсы (`/api/trips/`)

| Метод  | Путь                                   | Описание                                        |
| ------ | -------------------------------------- | ----------------------------------------------- |
| POST   | `/api/trips`                           | Создать рейс                                    |
| GET    | `/api/trips/{id}`                      | Детали рейса со всеми связями                   |
| PATCH  | `/api/trips/{id}`                      | Обновить любые поля рейса                       |
| POST   | `/api/trips/{id}/finish`               | Завершить рейс (odometer_end, driver_note)      |
| POST   | `/api/trips/{id}/orders`               | Добавить заказ в рейс                           |
| PATCH  | `/api/trips/{id}/orders/{orderId}`     | Отменить заказ (`lifecycle_status='cancelled'`) |
| POST   | `/api/trips/{id}/expenses`             | Добавить расход в рейс                          |
| DELETE | `/api/trips/{id}/expenses/{expenseId}` | Удалить расход (физически)                      |

### `POST /api/trips` — создать рейс

```json
Body: {
  "asset_id": "uuid",
  "loader_id": "uuid | null",
  "trip_type": "local | intercity | moving | hourly",
  "odometer_start": 12345,
  "idempotency_key": "uuid"
}
```

Защита: проверяет нет ли уже активного рейса у водителя. Если есть — 409.

### `POST /api/trips/{id}/finish` — завершить рейс

```json
Body: {
  "odometer_end": 12567,
  "driver_note": "Текст (необязательно)"
}
```

Устанавливает `status='completed'`, `lifecycle_status='draft'` (ждёт ревью).

### `POST /api/trips/{id}/orders` — добавить заказ

```json
Body: {
  "counterparty_id": "uuid | null",
  "description": "Текст | null",
  "amount": "5000.00",
  "driver_pay": "1500.00",
  "loader_pay": "0.00",
  "payment_method": "cash | qr | bank_invoice | debt_cash | card_driver",
  "idempotency_key": "uuid"
}
```

`settlement_status` автоматически: `bank_invoice`/`debt_cash` → `pending`; остальные → `completed`.
Идемпотентность: дубль ключа (23505) → возвращает существующую запись с 200.

### `POST /api/trips/{id}/expenses` — добавить расход

```json
Body: {
  "category_id": "uuid",
  "amount": "500.00",
  "payment_method": "cash | card_driver | fuel_card",
  "description": "Необязательно",
  "idempotency_key": "uuid"
}
```

### `PATCH /api/trips/{id}/orders/{orderId}` — отменить заказ

```json
Body: { "action": "cancel" }
```

Устанавливает `lifecycle_status='cancelled'`. Физическое удаление ЗАПРЕЩЕНО.

### `DELETE /api/trips/{id}/expenses/{expenseId}` — удалить расход

Физическое удаление (для расходов нет lifecycle_status). Нет тела запроса.

---

## Механик (`/api/mechanic/`)

| Метод | Путь                                            | Описание                                          |
| ----- | ----------------------------------------------- | ------------------------------------------------- | ------------ |
| GET   | `/api/mechanic/summary`                         | Сводка механика (активный наряд, счётчики)        |
| GET   | `/api/mechanic/orders`                          | Свои наряды (`?mechanic_id=`)                     |
| GET   | `/api/mechanic/orders?unassigned=true`          | Свободные наряды (без назначения, `created`)      |
| GET   | `/api/mechanic/orders/{id}`                     | Детали наряда                                     |
| POST  | `/api/mechanic/orders/{id}/claim`               | Взять свободный наряд на себя                     |
| GET   | `/api/mechanic/orders/{id}/works`               | Работы наряда                                     |
| PATCH | `/api/mechanic/orders/{id}/works/{workId}`      | Обновить работу (actual_minutes, status)          |
| POST  | `/api/mechanic/orders/{id}/work/{workId}/start` | Запустить таймер работы                           |
| POST  | `/api/mechanic/orders/{id}/work/{workId}/stop`  | Остановить таймер (`{action: 'pause               | complete'}`) |
| POST  | `/api/mechanic/orders/{id}/extra-work`          | Запросить доп. работу (extra_work_status=pending) |
| GET   | `/api/mechanic/orders/{id}/parts`               | Запчасти наряда                                   |
| GET   | `/api/mechanic/parts`                           | Список запчастей на складе                        |
| GET   | `/api/mechanic/catalog`                         | Каталог работ                                     |
| GET   | `/api/mechanic/salary?year=&month=`             | ЗП механика за месяц (начисления + сводка)        |

### `POST /api/mechanic/orders/{id}/claim` — взять наряд

Устанавливает `assigned_mechanic_id = userId` если поле ещё null (оптимистичная блокировка).

### `POST /api/mechanic/orders/{id}/extra-work` — запросить доп. работу

```json
Body: {
  "work_catalog_id": "uuid | null",
  "custom_work_name": "Строка (если не в каталоге)",
  "norm_minutes": 60,
  "mechanic_note": "Что нашли при разборке..."  // обязательно
}
```

Создаёт запись `service_order_works` с `extra_work_status='pending_approval'`.
Наряд нельзя завершить пока есть работы в статусе `pending_approval`.

### `GET /api/mechanic/salary` — ЗП за месяц

```json
{
  "accruals": [
    {
      "id": "uuid",
      "amount": "4500.00",
      "description": "ЗП механика: наряд #abc123",
      "settlement_status": "pending",
      "created_at": "..."
    }
  ],
  "summary": {
    "total_accrued": "9000.00",
    "total_paid": "4500.00",
    "to_pay": "4500.00"
  }
}
```

---

## Админ (`/api/admin/`)

| Метод | Путь                                          | Описание                                                   |
| ----- | --------------------------------------------- | ---------------------------------------------------------- | -------- |
| GET   | `/api/admin/summary`                          | Дашборд: активные рейсы, ревью, выручка сегодня            |
| GET   | `/api/admin/trips?filter=review\|active\|all` | Список рейсов с фильтрацией                                |
| GET   | `/api/admin/trips/{id}`                       | Полные детали рейса для ревью                              |
| PATCH | `/api/admin/trips/{id}`                       | Одобрить или вернуть рейс                                  |
| GET   | `/api/admin/transactions`                     | История последних 30 транзакций                            |
| POST  | `/api/admin/transactions`                     | Добавить доход/расход вручную                              |
| GET   | `/api/admin/payables`                         | Долги поставщикам (Дерябин ГСМ, Новиков, Ромашин)          |
| POST  | `/api/admin/payable-debt`                     | Зарегистрировать новый долг поставщику (запчасти в кредит) |
| POST  | `/api/admin/supplier-payment`                 | Оплатить долг поставщику                                   |
| GET   | `/api/admin/loans`                            | Список активных кредитов и займов                          |
| POST  | `/api/admin/loan-payment`                     | Оплатить кредит                                            |
| GET   | `/api/admin/cash-collections`                 | Подотчёт водителей (только cash)                           |
| POST  | `/api/admin/cash-collections`                 | Провести инкассацию                                        |
| GET   | `/api/admin/payroll?year=&month=`             | ЗП сотрудников за месяц                                    |
| POST  | `/api/admin/staff-settle`                     | Выплатить ЗП сотруднику                                    |
| GET   | `/api/admin/receivables`                      | Список должников (дебиторка)                               |
| POST  | `/api/admin/receivables/settle`               | Погасить долг клиента                                      |
| GET   | `/api/admin/garage`                           | Дашборд гаража: заявки, доп. работы, на утверждении, ТО    |
| GET   | `/api/admin/mechanics`                        | Список механиков (для назначения в наряд)                  |
| GET   | `/api/admin/repair-requests`                  | Заявки на ремонт от водителей                              |
| PATCH | `/api/admin/repair-requests/{id}`             | Одобрить/отклонить заявку (`action: approve                | reject`) |
| GET   | `/api/admin/service-orders`                   | Все наряды с фильтрацией                                   |
| PATCH | `/api/admin/service-orders/{id}`              | Управление нарядом (см. ниже)                              |

### `GET /api/admin/summary`

```json
{
  "activeTrips": 3,
  "pendingReview": 2,
  "todayRevenue": "45000.00"
}
```

### `GET /api/admin/trips?filter=review`

Фильтры:

- `review` — `status='completed' AND lifecycle_status='draft'`
- `active` — `status='in_progress'`
- `all` — все (последние 50)

### `PATCH /api/admin/trips/{id}` — одобрить / вернуть

```json
// Одобрить:
{ "action": "approve" }
// Возвращает lifecycle_status='approved' для рейса и всех его не-отменённых заказов

// Вернуть:
{ "action": "return", "note": "Причина возврата" }
// Возвращает lifecycle_status='returned', driver_note = note
```

### `POST /api/admin/transactions`

```json
Body: {
  "direction": "income | expense",
  "category_id": "uuid",      // обязательно — пустая строка вызовет NOT NULL ошибку
  "amount": "1000.00",
  "payment_method": "cash | bank_transfer | card",
  "description": "Необязательно"
}
```

Создаётся с `lifecycle_status='approved'`, `settlement_status='completed'` — сразу учитывается в балансах.

### `POST /api/admin/payable-debt`

```json
Body: {
  "supplier_id": "20000000-0000-0000-0000-000000000002 | ...003",
  "amount": "1240.00",
  "description": "Необязательно (по умолчанию: 'Запчасти в кредит: [имя]')"
}
```

Создаёт `direction=expense, lifecycle=approved, settlement=pending` — долг появляется в кредиторке.
Только для Новиков А.В. и Ромашин (не для Дерябин ГСМ — у него autoAccrue).

### `GET /api/admin/garage` — дашборд гаража

```json
{
  "repairRequests": [...],   // новые заявки водителей (status='new')
  "activeOrders": [...],     // наряды in_progress / created
  "pendingApproval": [...],  // завершены механиком, ждут утверждения (status=completed, lifecycle=draft)
  "extraWorkPending": [...], // доп. работы на согласовании
  "maintenanceAlerts": [...],// ТО алерты (overdue / soon)
  "counts": { ... }
}
```

### `PATCH /api/admin/repair-requests/{id}` — одобрить / отклонить заявку

```json
// Одобрить — создаёт наряд:
{ "action": "approve", "mechanic_id": "uuid?", "odometer": 12345 }

// Отклонить:
{ "action": "reject", "admin_note": "Причина" }
```

### `PATCH /api/admin/service-orders/{id}` — управление нарядом

```json
// Утвердить + начислить ЗП механику:
{ "action": "approve", "adjusted_norm_minutes": 90, "admin_note": "..." }

// Вернуть на доработку:
{ "action": "return", "admin_note": "Причина" }

// Отменить:
{ "action": "cancel" }

// Редактировать заметку:
{ "action": "edit_note", "admin_note": "Текст" }

// Одобрить доп. работу:
{ "action": "approve_extra_work", "work_id": "uuid" }

// Отклонить доп. работу:
{ "action": "reject_extra_work", "work_id": "uuid" }
```

При `action=approve`: начисляется ЗП через `PAYROLL_MECHANIC` транзакции.
Формула: `normMinutes/60 * hourlyRate(sto_settings) * mechanic_salary_pct/100`.
При двух механиках — нормочасы делятся пополам.

---

## Общие паттерны

### Idempotency Key

Формы создания (заказ, расход, рейс) генерируют ключ при монтировании:

```typescript
const [key] = useState(() => crypto.randomUUID()); // или uuid()
```

При дубле (PostgreSQL error 23505) API возвращает существующую запись с 200.

### `as any` cast

Из-за устаревших TypeScript-типов Supabase все запросы используют `as any` на `.from()`:

```typescript
const { data, error } = await (supabase.from('trips') as any)
  .update({ status: 'completed' })
  .eq('id', id)
  .select()
  .single();
```

> Никогда не ставить `as any` в конце цепочки — TypeScript всё равно проверит аргументы методов.

### Денежные суммы

- В БД: `DECIMAL(12,2)` — строка типа `"5000.00"`
- В коде: всегда `string`, никогда `number`
- Компонент `<Money amount="5000.00" />` из `@saldacargo/ui` — форматирует в `5 000 ₽`

---

## Связанные страницы

[[Аутентификация]], [[Справочник_таблиц_БД]], [[Роль_Водитель]], [[Роль_Админ]]
