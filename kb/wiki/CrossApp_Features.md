# CrossApp Features — Реестр синхронизации MiniApp ↔ WebApp

> **Правило:** При изменении логики в любом из приложений — найди строку в этой таблице и обнови обе стороны.  
> Этот файл обновляется при каждом изменении API.  
> Последнее обновление: 10.05.2026

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
| Погасить долг    | `api/admin/receivables/settle` POST | `api/receivables/[orderId]` PATCH | ✅     | Оба: mark completed + создать income транзакцию                            |

> ⚠️ **Важно:** При погашении ОБЯЗАТЕЛЬНО создавать транзакцию direction=income, category=TRIP_REVENUE `74008cf7-0527-4e9f-afd2-d232b8f8125a`, иначе деньги не попадут в P&L.

---

## 4. КРЕДИТОРКА — ДОЛГИ ПОСТАВЩИКАМ (PAYABLES)

| Фича                  | MiniApp файл                      | WebApp файл                 | Статус | Примечание                                    |
| --------------------- | --------------------------------- | --------------------------- | ------ | --------------------------------------------- |
| Список долгов         | `api/admin/payables` GET          | `api/payables` GET          | ✅     | Web добавляет history последних транзакций    |
| Оплатить долг         | `api/admin/supplier-payment` POST | `api/payables/payment` POST | ✅     | Оба создают expense транзакцию                |
| Зарегистрировать долг | —                                 | `api/payables/debt` POST    | ⚠️     | Только в WebApp, miniapp через payable_amount |

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

| Фича               | MiniApp файл                    | WebApp файл              | Статус | Примечание                       |
| ------------------ | ------------------------------- | ------------------------ | ------ | -------------------------------- |
| Список сотрудников | `api/users/public` GET          | `api/users` GET          | ⚠️     | Web богаче (фильтры, неактивные) |
| Контрагенты        | `api/driver/counterparties` GET | `api/counterparties` GET | ⚠️     | Web считает outstanding_debt     |
| Машины             | `api/driver/assets` GET         | `api/fleet` GET          | ⚠️     | Web полная аналитика по юнитам   |

---

## Критические инварианты (нельзя нарушать)

1. **При апруве рейса** → `trips.lifecycle=approved` + `trip_orders.lifecycle=approved` (оба)
2. **При возврате рейса** → `trips.lifecycle=returned` + `trip_orders.lifecycle=draft` (оба) + `odometer_end=null` + `ended_at=null`
3. **При погашении дебиторки** → `trip_orders.settlement=completed` + INSERT транзакция direction=income (оба)
4. **При выплате ЗП** → INSERT транзакция direction=expense, категория PAYROLL\_\* (оба)
5. **lifecycle_status фильтры** — всегда одинаковые в обоих приложениях для одних и тех же данных
6. **Cancelled рейсы** — всегда фильтровать через `neq lifecycle_status=cancelled` в списках водителя

---

## Как пользоваться реестром

**При изменении логики в одном приложении:**

1. Найди строку в таблице выше
2. Открой файл в ДРУГОМ приложении
3. Внеси такое же изменение
4. Обнови статус в этой таблице
5. Оба файла — в одном коммите
