# Flow: Ремонт от механика

**Файл:** `docs/flows/mechanic-repair.md`
**Роль:** Механик (mechanic)
**Где работает:** MiniApp в МАХ

---

## Контекст сценария

Механик чинит машину — свою или клиентскую. От качества фиксации времени и запчастей зависит:

- Расчёт реальной нормы выработки (для каталога работ).
- Расчёт ЗП механика по факту.
- Учёт склада запчастей.
- Себестоимость ремонта своих машин.
- Цена для клиентов на сторонних машинах.

**Принципы:**

- Один таймер в один момент времени.
- Каждый «старт-стоп» — отдельный сегмент в БД.
- Норма и цена фиксируются снимком при добавлении работы (не пересчитываются при изменении каталога).
- Финансы механик не видит — только своё рабочее время.

---

## Шаги сценария

### Шаг 0. Главная — выбор работы

**Где:** MiniApp, главный экран механика.

**Что видит:**

- Активный таймер (если есть): «Идёт работа: Замена сцепления, Газель 099 · 1ч 23м». Кнопки `[⏸ Пауза]` `[⏹ Стоп]`.
- Секция «В работе» — мои наряды со статусом `in_progress`.
- Секция «Очередь» — наряды без исполнителя, кнопка `[Взять в работу]`.
- Кнопка `[+ Новый наряд]` (когда машина пришла без согласования).

---

### Шаг 1. Создание или взятие наряда

**Вариант A: берёт из очереди.**

```
POST /api/service-orders/:orderId/assign
  Body: { idempotency_key }

Use-case:
  1. identity.getCurrentUser → role mechanic
  2. service.assignMechanic({ order_id, mechanic_id: user.id })
     → UPDATE service_orders (assigned_mechanic_id, status: in_progress, started_at: now())
```

**Вариант B: создаёт новый наряд (клиентская машина пришла прямо к нему).**

```
POST /api/service-orders
  Body: {
    is_external_client: true,
    external_client_name, external_client_phone,
    external_vehicle_make, external_vehicle_plate,
    odometer_at_start,
    description, priority, idempotency_key
  }

Use-case:
  1. service.createServiceOrder({...})
     → внутри:
       a. Если is_external_client = true и нет counterparty — создаём через identity.upsertCounterparty
       b. INSERT service_orders (lifecycle: draft, status: in_progress, assigned_mechanic_id: user.id)
       c. Возврат ServiceOrder
```

**БД-эффекты:**

- INSERT в `service_orders` (или UPDATE для варианта A).
- Возможно INSERT в `counterparties` (новый клиент).

---

### Шаг 2. Добавление работы

**UI:** в наряде нажимает `[+ Добавить работу]`.

**Поля:**

- Работа из каталога (autocomplete по `work_catalog`, отфильтровано по `applicable_asset_type_ids`).
- Или свободная работа (название + описание).

**Что происходит технически:**

```
POST /api/service-orders/:orderId/works
  Body: {
    work_catalog_id?: UUID,
    custom_work_name?: string,
    notes?: string,
    idempotency_key
  }

Use-case:
  1. identity.requireOwnership(user, order)  // механик должен быть assigned
  2. service.addWork({...})
     → внутри:
       a. Если work_catalog_id указан:
            const wc = await fetchWorkCatalog(work_catalog_id)
            norm_minutes = wc.norm_minutes  // СНИМОК
            price_client = wc.default_price_client  // СНИМОК
            requires_admin_review = false
       b. Если custom_work_name:
            norm_minutes = 60  // дефолт, админ скорректирует при ревью
            price_client = 0  // админ установит при ревью
            requires_admin_review = true
       c. INSERT service_order_works (status: pending)
       d. Возврат ServiceOrderWork
```

**Важно:** при изменении каталога работ (например, цена на «Замену сцепления» изменилась с 8000 на 9500) — старые наряды НЕ пересчитываются. Цена и норма зафиксированы снимком.

---

### Шаг 3. Запуск таймера

**UI:** на карточке работы кнопка `[▶ Старт]`.

**Что происходит технически:**

```
POST /api/service-order-works/:workId/timer/start
  Body: { idempotency_key }

Use-case:
  1. service.startTimer({ work_id, mechanic_id: user.id })
     → внутри:
       a. Проверка: у механика нет других running таймеров
          (если есть — error «Сначала остановите текущий»)
       b. UPDATE service_order_works (status: in_progress)
       c. INSERT work_time_logs (started_at: now(), status: running)
       d. Возврат WorkTimeLog
```

**БД-эффекты:**

- 1 новая запись в `work_time_logs`.
- UPDATE статуса `service_order_works`.

**UI:** в шапке приложения появляется плашка «Идёт работа: Замена сцепления · MM:SS» с live-секундомером.

---

### Шаг 4. Пауза и продолжение

**Пауза:**

```
POST /api/service-order-works/:workId/timer/pause
  Body: { reason: 'lunch'|'break'|'waiting_part'|'other_work'|'shift_end'|'other',
          reason_text?, idempotency_key }

Use-case:
  1. service.pauseTimer({ work_id, reason, reason_text })
     → внутри:
       a. UPDATE work_time_logs (последняя running запись):
          stopped_at = now(), status = paused, pause_reason, pause_reason_text
          (триггер БД считает duration_minutes)
       b. UPDATE service_order_works (status: paused)
       c. Триггер пересчитывает actual_minutes в SOW
```

**Продолжение:**

```
POST /api/service-order-works/:workId/timer/resume
  Body: { idempotency_key }

Use-case:
  1. service.resumeTimer({ work_id })
     → внутри:
       a. INSERT новая work_time_logs запись (started_at: now(), status: running)
       b. UPDATE service_order_works (status: in_progress)
```

**Важно:** на одну работу может быть **много записей** в `work_time_logs` (по числу сегментов). Это даёт точную картину, как реально шла работа: 30 минут, обед, 45 минут, пауза «жду запчасть» 2 часа, ещё 60 минут.

---

### Шаг 5. Завершение работы

**UI:** кнопка `[⏹ Завершить]` на работе.

```
POST /api/service-order-works/:workId/timer/stop
  Body: { idempotency_key }

Use-case:
  1. service.stopTimer({ work_id })
     → внутри:
       a. UPDATE work_time_logs (последняя running):
          stopped_at = now(), status = completed
          (триггер: duration_minutes)
       b. UPDATE service_order_works:
          status = completed
          (триггер на work_time_logs пересчитал actual_minutes уже)
       c. Если actual_minutes > norm_minutes × 1.5 → метка для ревью
```

**Альтернативный поток (механик забыл нажать «Старт»):**

```
POST /api/service-order-works/:workId/manual-time
  Body: { actual_minutes, idempotency_key }

Use-case:
  1. service.setManualTime({ work_id, actual_minutes, mechanic_id })
     → внутри:
       a. INSERT work_time_logs (
            started_at: now() - actual_minutes,
            stopped_at: now(),
            status: completed,
            manual_entry: true
          )
       b. UPDATE service_order_works (
            status: completed,
            manual_entry: true
          )
       c. Триггер пересчитал actual_minutes
```

Админ при ревью наряда видит пометку `manual_entry`.

---

### Шаг 6. Списание запчастей

**UI:** кнопка `[+ Запчасть со склада]` в наряде.

**Поля:**

- К какой работе списать (если работ больше одной).
- Запчасть (autocomplete по `parts`).
- Количество.

**Что происходит:**

```
POST /api/service-orders/:orderId/parts
  Body: {
    work_id?: UUID,
    part_id: UUID,
    quantity: number,
    idempotency_key
  }

Use-case:
  1. service.consumePart({ order_id, work_id, part_id, quantity })
     → внутри:
       a. Проверка: parts.stock >= quantity
          - Если нет → создаём purchase_request (заявка админу)
          - Возврат специальной ошибки: NOT_IN_STOCK с purchase_request_id
       b. INSERT service_order_parts (price = parts.last_purchase_price * quantity)
       c. INSERT part_movements (direction: -, quantity, reason: 'consumed_in_order')
       d. UPDATE parts.stock -= quantity
       e. Возврат ServiceOrderPart
```

**БД-эффекты:**

- INSERT в `service_order_parts`.
- INSERT в `part_movements`.
- UPDATE `parts.stock`.

**Если запчасти нет на складе:**
UI меняет кнопку на `[📝 Заявка на закупку]`. При клике:

```
POST /api/parts/purchase-requests
  Body: { part_id, quantity, urgency, comment, idempotency_key }

Use-case:
  1. service.createPurchaseRequest({...})
     → INSERT в part_purchase_requests (status: pending)
```

---

### Шаг 7. Фиксация дефекта

**UI:** в процессе ремонта механик заметил, что течёт сальник. Жмёт `[📸 Найден дефект]`.

**Поля:**

- Узел (engine / transmission / suspension / brakes / ...).
- Описание.
- Фото (≥1, обязательно).
- Срочность (urgent / soon / later).

```
POST /api/defects
  Body: {
    asset_id, found_in_service_order_id,
    unit, description, urgency, photo_urls,
    idempotency_key
  }

Use-case:
  1. service.logDefect({...})
     → INSERT defect_log (status: open, reported_by: user.id)
```

**Где это потом всплывает:** в WebApp в карточке машины → закладка «Техсостояние» → «Бэклог дефектов». Админ может запланировать ремонт или отклонить.

---

### Шаг 8. Закрытие наряда

**UI:** в наряде кнопка `[🏁 Завершить наряд]`.

**Сводка перед закрытием:**

- Работ: 3 (все completed)
- Время факт: 4ч 12м (норма 5ч 00м, эффективность 84%)
- Запчасти: 4 позиции
- Дефекты найдены: 1
- Конечный одометр (если своя машина).

**Поля:**

- Конечный одометр.
- Заметка для админа.
- Машина готова к выдаче — checkbox.

**Валидация:**

- Все работы в наряде должны быть `completed`. Если есть `pending`/`in_progress` — модалка «Завершите или удалите эти работы».
- Все таймеры остановлены.

```
POST /api/service-orders/:orderId/complete
  Body: {
    odometer_at_end?,
    notes_for_admin?,
    ready_for_handover: boolean,
    idempotency_key
  }

Use-case:
  1. service.closeServiceOrder({...})
     → внутри:
       a. Валидация всех работ (completed)
       b. UPDATE service_orders (
            status: completed,
            completed_at: now(),
            lifecycle: draft (всё ещё, ждём ревью),
            odometer_at_end, notes_for_admin
          )
       c. Если есть odometer_at_end и asset_id → fleet.updateOdometer
          (триггер ТО как у рейсов)
       d. Возврат ServiceOrder со сводкой
```

**Realtime:** в WebApp админа в «Ревью нарядов» появляется новая карточка.

---

### Шаг 9. Ревью админа в WebApp

Админ видит карточку наряда с подсветкой аномалий:

- 🔴 Эффективность < 70% или > 150%.
- ⚠️ Стоимость запчастей > 30% от стоимости работ.
- ⚠️ Свободные работы (`requires_admin_review = true`).
- ⚠️ Manual entry (`manual_entry = true`).

**Что админ делает:**

**Для своей машины:**

1. (Опц.) Корректирует ставку ЗП механика за этот наряд.
2. Жмёт `[✅ Утвердить]`.

**Для клиентской машины:**

1. Жмёт `[💰 Сформировать счёт]`.
2. Применяет наценку (% или фикс).
3. Указывает способ оплаты (нал / р/с / в долг).
4. Жмёт `[✅ Создать счёт]` — в БД создаётся `transaction income` за работы.
5. Жмёт `[✅ Утвердить]`.

```
POST /api/service-orders/:orderId/approve
  Body: {
    mechanic_pay?: Money,           // ставка для своей машины
    client_invoice?: {              // для клиентской
      total_amount: Money,
      markup_percent: number,
      discount_amount?: Money,
      payment_method: 'cash'|'qr'|'bank_invoice'|'debt_cash',
      destination_wallet_id: UUID
    },
    idempotency_key
  }

Use-case (СЛОЖНЫЙ — несколько модулей):
  1. identity.requireRole(user, ['admin', 'owner'])
  2. const order = await service.getServiceOrder(orderId)

  3. Если order.is_external_client (клиентская машина):
     a. const invoice = client_invoice (обязательно)
     b. finance.createTransaction({
          direction: 'income',
          amount: invoice.total_amount,
          from_wallet: ext_clients,
          to_wallet: invoice.destination_wallet_id,
          settlement: 'completed' if cash/qr else 'pending',
          lifecycle: 'approved',
          service_order_id: order.id,
          counterparty_id: order.external_client_counterparty_id,
          category_id: SERVICE_WORKS_INCOME
        })

  4. Если своя машина (asset_id):
     a. Не создаём income (это внутренняя работа)
     b. Создаём expense на запчасти (себестоимость):
        for part in order.parts:
          finance.createTransaction({
            direction: 'expense',
            amount: part.cost,
            category_id: REPAIR_PARTS,
            asset_id: order.asset_id, ...
          })

  5. ЗП механику:
     a. Если mechanic_pay указан → используем его
     b. Иначе → расчёт по умолчанию: actual_minutes / 60 * mechanic_rate
     c. Записываем в payroll_log (для будущего payroll period):
        payroll.recordEarning({
          user_id: order.assigned_mechanic_id,
          amount: mechanic_pay,
          source_type: 'service_order',
          source_id: order.id,
          earned_at: order.completed_at
        })

  6. Закрытие:
     UPDATE service_orders SET lifecycle: 'approved', approved_by, approved_at
     UPDATE service_order_works SET lifecycle: 'approved'
     UPDATE part_movements SET status: 'consumed' (было reserved)
```

**БД-эффекты:**

- UPDATE `service_orders.lifecycle_status`.
- UPDATE всех `service_order_works`.
- UPDATE `part_movements`.
- INSERT в `transactions` (income для клиентских, expense для запчастей своих).
- INSERT в `payroll_log` (запись о заработке механика).
- INSERT в `audit_log`.

---

## Точки отказа и обработка

| Что может пойти не так                         | Что система делает                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Механик пытается запустить второй таймер       | Error «Остановите текущую работу»                                  |
| Запчасти нет на складе                         | Кнопка превращается в «Заявка на закупку»                          |
| Параллельно админ изменил каталог цен          | Не влияет — снимок зафиксирован при добавлении работы              |
| Сеть пропала во время работы таймера           | Запись в IndexedDB, синк позже. Длительность не теряется.          |
| Таймер запущен, прошло 12 часов без активности | Cron auto-pause со статусом `expired` (защита от забытых таймеров) |
| Закрытие наряда с незавершёнными работами      | Блокировка с диалогом «Завершите или удалите»                      |

---

## Что важно знать для реализации

1. **Триггер `recalc_service_order_work_actual`** — пересчитывает `actual_minutes` в `service_order_works` при любом изменении `work_time_logs`. См. миграцию.
2. **Идемпотентность таймера** — критична. Если механик дважды нажал «Старт» — второй ответ из кэша, нет двух running записей.
3. **Один таймер на механика** — проверяется в `service.startTimer` через SELECT WHERE mechanic_id = X AND status = running.
4. **Снимок норм и цен** — копируется в `service_order_works.norm_minutes` и `price_client` при добавлении. Никаких джоинов с `work_catalog` для отображения старых нарядов.
5. **Use-case апрува наряда — самый сложный** во всей системе. Объединяет `service`, `finance`, `payroll`, `identity`. Требует юнит-тестов.

---

## Связанные документы

- `docs/modules/service/README.md` — публичный API.
- `docs/modules/finance/README.md` — создание транзакций.
- `docs/modules/payroll/README.md` — расчёт ЗП механика.
- `docs/database/schema.md` — service_orders, service_order_works, work_time_logs, defect_log.
- `05_DB_Migration_Mechanic.md` — миграция БД с триггерами.

---

**Документ живой.**
