# CrossApp Features — Реестр синхронизации MiniApp ↔ WebApp

> **Правило:** При изменении логики в любом из приложений — найди строку в этой таблице и обнови обе стороны.  
> Этот файл обновляется при каждом изменении API.  
> Последнее обновление: 13.05.2026

---

## Легенда

| Символ | Значение                                    |
| ------ | ------------------------------------------- |
| ✅     | Реализовано и синхронизировано              |
| ⚠️     | Реализовано, но есть различия (допустимые)  |
| ❌     | Критическое расхождение — нужно исправить   |
| —      | Не нужно в этом приложении (по архитектуре) |

---

## 1. РЕЙСЫ (TRIPS)

| Фича                      | MiniApp файл                          | WebApp файл                                    | Статус | Примечание                                                                 |
| ------------------------- | ------------------------------------- | ---------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Список рейсов на ревью    | `api/admin/trips?filter=review`       | `api/trips?lifecycle=draft`                    | ✅     | Разные param-имена, логика одинакова: `status=completed + lifecycle=draft` |
| Список активных рейсов    | `api/admin/trips?filter=active`       | `api/trips?lifecycle=draft&status=in_progress` | ✅     |                                                                            |
| История рейсов            | `api/admin/trips?filter=history`      | `api/trips?lifecycle=approved`                 | ✅     |                                                                            |
| Детали рейса (админ)      | `api/admin/trips/[id]`                | —                                              | —      | Web видит через список                                                     |
| Одобрить рейс             | `api/admin/trips/[id]` action=approve | `api/trips/[id]/approve`                       | ✅     | Оба: trip→approved + orders→approved                                       |
| Вернуть рейс              | `api/admin/trips/[id]` action=return  | `api/trips/[id]/return`                        | ✅     | Оба: trip→returned + orders→draft + очистка одометра                       |
| Отменить рейс             | —                                     | `api/trips/[id]` DELETE                        | ⚠️     | В webapp отмена через DELETE, miniapp не нужен                             |
| Создать рейс (водитель)   | `api/trips` POST                      | `api/trips` POST (ретро)                       | ⚠️     | Miniapp: активный рейс. WebApp: ретро-ввод завершённого                    |
| Завершить рейс (водитель) | `api/trips/[id]/finish`               | —                                              | —      | Только водитель в MiniApp                                                  |
| История водителя          | `api/driver/trips`                    | —                                              | —      | Фильтр: `neq lifecycle_status=cancelled`                                   |

---

## 2. НАРЯДЫ (SERVICE ORDERS)

| Фича                     | MiniApp файл                                   | WebApp файл                                       | Статус | Примечание                                                               |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Список на ревью          | `api/admin/service-orders?filter=review`       | `api/garage/orders?filter=review`                 | ✅     | Фильтр: `lifecycle=draft`                                                |
| Список активных          | `api/admin/service-orders?filter=active`       | `api/garage/orders?filter=active`                 | ✅     | Фильтр: `lifecycle=approved + status in (created,in_progress)`           |
| История нарядов          | `api/admin/service-orders?filter=history`      | `api/garage/orders?filter=history`                | ✅     | Фильтр: `or(cancelled/returned, approved+completed)`                     |
| Одобрить наряд           | `api/admin/service-orders/[id]` action=approve | `api/garage/orders/[id]` PATCH lifecycle=approved | ✅     |                                                                          |
| Вернуть наряд            | `api/admin/service-orders/[id]` action=return  | `api/garage/orders/[id]` PATCH lifecycle=returned | ✅     |                                                                          |
| Отменить наряд           | `api/admin/service-orders/[id]` action=cancel  | `api/garage/orders/[id]` DELETE                   | ⚠️     | MiniApp: soft-delete. WebApp: hard DELETE (intentional — per kontext.md) |
| Создать наряд (водитель) | `api/driver/service-orders` POST               | —                                                 | —      | lifecycle=draft, ждёт апрува                                             |
| Создать наряд (админ)    | —                                              | `api/garage/orders` POST                          | ⚠️     | lifecycle=approved (админ создаёт сразу апрувнутым)                      |

---

## 3. ДЕБИТОРКА (RECEIVABLES)

| Фича             | MiniApp файл                        | WebApp файл                       | Статус | Примечание                                                                 |
| ---------------- | ----------------------------------- | --------------------------------- | ------ | -------------------------------------------------------------------------- |
| Список должников | `api/admin/receivables` GET         | `api/receivables` GET             | ✅     | Оба: `settlement=pending + lifecycle=approved`. Web добавляет overdueCount |
| Погасить долг    | `api/admin/receivables/settle` POST | `api/receivables/[orderId]` PATCH | ✅     | Оба: mark completed + создать income транзакцию с to_wallet_id             |

**Группировка должников:**

- Заказы **без `description`** → группируются по `counterparty_id` (стандартно)
- Заказы **с заполненным `description`** → выносятся отдельной строкой: имя = `description`, серый бейдж = имя контрагента (напр. "физ лицо"). Ключ группы = `__individual__${order.id}`. Применяется для разовых физ лиц под одним контрагентом-заглушкой.
- После подтверждения оплаты заказ уходит из `pending` — "сливания" не нужно, он просто исчезает.

**Какие заказы попадают в дебиторку** — `settlement_status = 'pending'` при создании:

- `qr` — QR/Расчётный счёт (физлицо — быстро; юрлицо — после документов, 2–30 дн.)
- `card_driver` — На карту владельца
- `debt_cash` — Долг наличными

**`cash` НЕ попадает в дебиторку** — создаётся `completed`, идёт через инкассацию в Сейф.

> ⚠️ **Критично:** При погашении ОБЯЗАТЕЛЬНО:
>
> 1. Создать транзакцию `direction=income`, `category=TRIP_REVENUE` (`74008cf7-0527-4e9f-afd2-d232b8f8125a`)
> 2. Указать `to_wallet_id` по способу оплаты заказа:
>    - `qr` → Расчётный счёт (`10000000-0000-0000-0000-000000000001`)
>    - `card_driver` → Карта (`10000000-0000-0000-0000-000000000003`)
>    - `debt_cash` → Сейф (`10000000-0000-0000-0000-000000000002`)

---

## 4. КРЕДИТОРКА — ДОЛГИ ПОСТАВЩИКАМ (PAYABLES)

| Фича                  | MiniApp файл                      | WebApp файл                 | Статус | Примечание                                  |
| --------------------- | --------------------------------- | --------------------------- | ------ | ------------------------------------------- |
| Список долгов         | `api/admin/payables` GET          | `api/payables` GET          | ✅     | Web добавляет history последних транзакций  |
| Оплатить долг         | `api/admin/supplier-payment` POST | `api/payables/payment` POST | ✅     | Оба создают expense транзакцию              |
| Зарегистрировать долг | `api/admin/payable-debt` POST     | `api/payables/debt` POST    | ✅     | MiniApp: Финансы → Расход → Долг поставщику |

---

## 5. КРЕДИТЫ (LOANS)

| Фича                | MiniApp файл                  | WebApp файл            | Статус | Примечание                                               |
| ------------------- | ----------------------------- | ---------------------- | ------ | -------------------------------------------------------- |
| Список кредитов     | `api/admin/loans` GET         | `api/loans` GET        | ⚠️     | MiniApp: только активные (`is_active=true`). WebApp: все |
| Оплата кредита      | `api/admin/loan-payment` POST | —                      | ⚠️     | Только в MiniApp. WebApp не реализован                   |
| Создать кредит      | —                             | `api/loans` POST       | —      | Только в WebApp (аналитика)                              |
| Кредиты с дедлайном | —                             | `api/loans/alerts` GET | —      | Только в WebApp                                          |

---

## 6. ПЕРСОНАЛ И ЗП (PAYROLL / STAFF)

| Фича              | MiniApp файл                          | WebApp файл             | Статус | Примечание                                                                  |
| ----------------- | ------------------------------------- | ----------------------- | ------ | --------------------------------------------------------------------------- |
| Расчёт ЗП         | `api/admin/payroll` GET               | `api/staff/payroll` GET | ✅     | Базовая логика идентична. Web богаче (work_count, asset, разбивка по ролям) |
| Выплатить ЗП      | `api/admin/staff-settle` POST         | `api/staff/settle` POST | ✅     | Идентичная логика: expense транзакция PAYROLL\_\* категории                 |
| Подотчёт наличных | `api/admin/cash-collections` GET+POST | —                       | ⚠️     | Только в MiniApp                                                            |

---

## 7. КОШЕЛЬКИ (WALLETS)

| Фича                     | MiniApp файл                     | WebApp файл       | Статус | Примечание       |
| ------------------------ | -------------------------------- | ----------------- | ------ | ---------------- |
| Балансы кошельков        | `api/wallets` GET                | `api/wallets` GET | ✅     | Логика идентична |
| Перевод между кошельками | `api/admin/wallet-transfer` POST | —                 | ⚠️     | Только в MiniApp |

---

## 8. СПРАВОЧНИКИ

| Фича               | MiniApp файл                    | WebApp файл              | Статус | Примечание                                                                        |
| ------------------ | ------------------------------- | ------------------------ | ------ | --------------------------------------------------------------------------------- |
| Список сотрудников | `api/users/public` GET          | `api/users` GET          | ⚠️     | Web богаче (фильтры, неактивные)                                                  |
| Постоянные клиенты | `api/driver/counterparties` GET | `api/counterparties` GET | ⚠️     | MiniApp: только выбор клиента в заказе. WebApp: аналитические карточки (см. ниже) |
| Машины             | `api/driver/assets` GET         | `api/fleet` GET          | ⚠️     | Web полная аналитика по юнитам                                                    |

**WebApp `/counterparties` — аналитика постоянных клиентов (только `type IN ('client','both')`):**

UI: компактный accordion-список (одна строка = имя + долг + выручка 30д + когда последний рейс). При раскрытии — полная аналитика + кнопки действий. Разовые клиенты без заказов (`orders_count === 0`) можно удалить физически (`DELETE /api/counterparties/[id]`); с заказами — только архив (`is_active = false`).

Каждая карточка содержит:

- `total_revenue` — выручка за всё время (approved+completed заказы)
- `revenue_30d` — выручка за последние 30 дней
- `trips_count` — количество уникальных рейсов
- `avg_order` — средний чек (total_revenue / revenue_orders_count)
- `last_trip_at` — дата последнего рейса (из trips.started_at)
- `outstanding_debt` — текущий долг клиента (pending+approved заказы)
- `payment_breakdown` — доля каждого способа оплаты в % от выручки

Сортировка: сначала по `revenue_30d` (активные), потом по `total_revenue`.  
Разовые клиенты (ATI, физлица с улицы) в справочник **не добавляются** — их заказы создаются без counterparty_id или с описанием.

---

## Критические инварианты (нельзя нарушать)

1. **При апруве рейса** → `trips.lifecycle=approved` + `trip_orders.lifecycle=approved` (оба)
2. **При возврате рейса** → `trips.lifecycle=returned` + `trip_orders.lifecycle=draft` (оба) + `odometer_end=null` + `ended_at=null`
3. **При погашении дебиторки** → `trip_orders.settlement=completed` + INSERT транзакция direction=income + `to_wallet_id` по payment_method заказа (оба)
4. **При выплате ЗП** → INSERT транзакция direction=expense, категория PAYROLL\_\* (оба)
5. **lifecycle_status фильтры** — всегда одинаковые в обоих приложениях для одних и тех же данных
6. **Cancelled рейсы** — всегда фильтровать через `neq lifecycle_status=cancelled` в списках водителя
7. **Способы оплаты заказа** — `qr`, `card_driver`, `debt_cash` → `settlement_status=pending`; `cash` → `completed`. `bank_invoice` УДАЛЁН из форм (исторически может встречаться в БД).

---

## Как пользоваться реестром

**При изменении логики в одном приложении:**

1. Найди строку в таблице выше
2. Открой файл в ДРУГОМ приложении
3. Внеси такое же изменение
4. Обнови статус в этой таблице
5. Оба файла — в одном коммите
