# Промт: ERP-улучшения для СТО — выход на 200 000 ₽ чистой прибыли

## Контекст системы

Ты работаешь в монорепозитории **SaldaCargo** — ERP для транспортного бизнеса ИП Нигамедьянов А.С., г. Верхняя Салда.

**Стек:** Next.js 15 App Router, Supabase (PostgreSQL), TanStack Query v5, Tailwind CSS 4.x, pnpm workspaces.

**Два приложения, одна БД:**

- `apps/miniapp` — мини-приложение в мессенджере МАХ (телефон): водители, механики, администратор в поле
- `apps/web` — веб-дашборд для владельца на ПК (аналитика, управление)

**Критические правила кодирования:**

- Supabase всегда через `createAdminClient()` (service_role, обходит RLS)
- Паттерн: `(supabase.from('table') as any).select(...)` — `as any` ОБЯЗАТЕЛЕН на `.from()`
- Авторизация: cookie `salda_user_id` = UUID из таблицы `users` (НЕ Supabase Auth)
- Деньги только строкой: `"5000.00"`, компонент `<Money amount="..." />` из `@saldacargo/ui`
- Soft-delete везде: `lifecycle_status = 'cancelled'`, не DELETE
- Balances = `lifecycle_status='approved' AND settlement_status='completed'`
- `users.roles` — массив: `.contains('roles', ['mechanic'])`

---

## Что уже реализовано (не трогать без необходимости)

### БД — таблицы СТО (уже существуют)

| Таблица               | Что хранит                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service_orders`      | Наряды. Поля: `order_number`, `machine_type` ('own'/'client'), `asset_id`, `client_vehicle_brand/model/reg`, `client_name`, `client_phone`, `counterparty_id`, `problem_description`, `assigned_mechanic_id`, `status` (created/in_progress/completed/cancelled), `lifecycle_status` (draft→approved), `priority` (low/normal/urgent), `mechanic_note`, `admin_note`, `is_ready_for_pickup` |
| `work_catalog`        | Справочник работ: `name`, `norm_minutes`, `default_price_client`, `internal_cost_rate`, `applicable_asset_type_ids`                                                                                                                                                                                                                                                                         |
| `service_order_works` | Работы в наряде: `work_catalog_id`, `custom_work_name`, `norm_minutes`, `price_client`, `actual_minutes`, `status`, `manual_entry`                                                                                                                                                                                                                                                          |
| `work_time_logs`      | Таймеры механика: `started_at`, `stopped_at`, `status` (running/paused/completed), `pause_reason` (lunch/waiting_part/other_work/end_of_shift)                                                                                                                                                                                                                                              |
| `parts`               | Склад: `name`, `article`, `category`, `unit`, `purchase_price`, `client_price`, `min_stock`                                                                                                                                                                                                                                                                                                 |
| `part_movements`      | Движения запчастей: `direction` (in/out), `quantity`, `unit_price`, `service_order_id`                                                                                                                                                                                                                                                                                                      |
| `service_order_parts` | Запчасти в наряде: `part_id`, `quantity`, `unit_price`                                                                                                                                                                                                                                                                                                                                      |
| `defect_log`          | Дефекты машин: `asset_id`, `unit`, `description`, `urgency` (critical/soon/low), `status` (open/planned/fixed)                                                                                                                                                                                                                                                                              |
| `purchase_requests`   | Заявки механиков на закупку: `part_id`, `quantity`, `service_order_id`, `status` (pending/approved/purchased)                                                                                                                                                                                                                                                                               |

### API (уже работает)

**MiniApp — механик:**

- `GET /api/mechanic/orders` — список нарядов механика
- `GET /api/mechanic/orders/[id]` — детали наряда
- `POST /api/mechanic/orders/[id]/works` — добавить работу
- `POST /api/mechanic/orders/[id]/work/[workId]/start` — старт таймера
- `POST /api/mechanic/orders/[id]/work/[workId]/stop` — стоп таймера (с причиной паузы)
- `GET|POST /api/mechanic/orders/[id]/parts` — запчасти наряда
- `GET /api/mechanic/summary` — сводка: сколько нарядов, минут за день
- `GET /api/mechanic/catalog` — справочник работ
- `GET /api/mechanic/parts` — справочник запчастей

**MiniApp — администратор:**

- `GET /api/admin/service-orders?filter=review|active|history` — список нарядов
- `PATCH /api/admin/service-orders/[id]` — action: approve / return / cancel

**WebApp:**

- `GET|POST /api/garage/orders` — список и создание нарядов
- `GET|PATCH /api/garage/orders/[id]` — детали и обновление
- `apps/web/app/(dashboard)/garage/page.tsx` — UI: вкладки review/active/history + форма создания

---

## Что ОТСУТСТВУЕТ и нужно реализовать

### Проблема №1 — Наряды не попадают в финансы (критично)

**Сейчас:** Завершённый наряд существует сам по себе. Ни рубля не попадает в `transactions`. P&L системы не знает о существовании СТО.

**Нужно:** При закрытии наряда автоматически создавать транзакцию:

- `machine_type = 'client'` → `direction = 'income'`, категория SERVICE_REVENUE, `to_wallet_id` по способу оплаты
- `machine_type = 'own'` → `direction = 'expense'`, категория FLEET_MAINTENANCE, `from_wallet_id` = Сейф

**Категории транзакций (UUID уточнить в `tasks/todo/tt.md`):**

- SERVICE_REVENUE — доход СТО (клиентские машины)
- FLEET_MAINTENANCE — затраты на обслуживание своего автопарка

**Способ оплаты для клиентских нарядов:** нужно добавить поле `payment_method` в `service_orders` (cash/card/qr) и выбор при закрытии наряда.

---

### Проблема №2 — Нет аналитики СТО в WebApp

**Нужно реализовать страницу `/garage/analytics` (или раздел на существующей странице):**

#### Блок 1 — KPI месяца

- Выручка СТО (клиентские наряды, income транзакции SERVICE_REVENUE)
- Затраты на свой автопарк (own наряды, expense транзакции FLEET_MAINTENANCE)
- Количество клиентских нарядов за месяц
- Средний чек клиентского наряда
- Загрузка: фактических часов / рабочих часов (напр. 2 механика × 8ч × 22дн = 352ч норма)

#### Блок 2 — По механикам

Таблица за выбранный месяц:

| Механик | Нарядов | Часов факт | Выручка (его работы) | ЗП к выплате |
| ------- | ------- | ---------- | -------------------- | ------------ |

ЗП механика = SUM(`service_order_works.price_client`) × коэффициент (задаётся вручную, ~30–40%).  
**Важно:** Коэффициент ЗП НЕ пересчитывается автоматически — только подсказка.

#### Блок 3 — Топ работ

Топ-10 работ по выручке и частоте за месяц (из `service_order_works` + `work_catalog`).

#### Блок 4 — Склад (критичный остаток)

Запчасти у которых `текущий остаток < min_stock`. Источник: `part_movements` (остаток = SUM in - SUM out).

---

### Проблема №3 — Нет ЗП механика от нарядов

**Сейчас:** Механики в payroll считаются по системе грузоперевозок. СТО-наряды никак не учитываются.

**Нужно:**

- В разделе `/staff` (WebApp) показывать механиков отдельно с расчётом от нарядов
- Расчёт: сумма `service_order_works.price_client` по завершённым нарядам за период × коэффициент
- Выплата ЗП: expense транзакция категории PAYROLL_MECHANIC через существующий `POST /api/staff/settle`

---

### Проблема №4 — Нет управления складом в WebApp

**Нужно:** Страница или раздел `/garage/parts`:

- Список запчастей с текущим остатком (динамический расчёт из `part_movements`)
- Визуальный индикатор: красный если остаток < min_stock
- Приход товара: форма `POST part_movements` (direction='in', counterparty_id поставщика)
- Приход привязывается к expense транзакции (PARTS_PURCHASE) через `transactions`

---

### Проблема №5 — Нет истории по клиентской машине

**Нужно (минимально):**

- В деталях наряда клиентской машины — показать предыдущие наряды на эту машину (по `client_vehicle_reg`)
- Выводить: дата, что делали, итоговая сумма

---

## Порядок реализации (приоритеты)

### Приоритет 1 — Финансовая интеграция (без неё всё остальное бессмысленно)

1. Добавить миграцию: поле `payment_method TEXT` в `service_orders` (cash/card/qr, nullable)
2. Добавить поле `total_amount DECIMAL(12,2)` в `service_orders` (вычисляется при закрытии: SUM works.price_client + SUM parts: qty × unit_price)
3. При `PATCH /api/garage/orders/[id]` с `status='completed'`:
   - Считать total_amount
   - Создавать транзакцию (income или expense)
   - Записывать `total_amount` в наряд
4. В MiniApp: при апруве наряда админом (`PATCH /api/admin/service-orders/[id]` action=approve) — аналогично
5. UI в WebApp: при закрытии наряда (кнопка "Завершить") — модалка выбора способа оплаты (только для client-нарядов)

### Приоритет 2 — Аналитика СТО

6. `GET /api/garage/analytics?month=YYYY-MM` — агрегированные данные по блокам 1-3
7. Новый таб "Аналитика" на странице `/garage`

### Приоритет 3 — Склад

8. `GET /api/garage/parts` — список с текущими остатками
9. `POST /api/garage/parts/movement` — приход/расход с созданием транзакции
10. Новый таб "Склад" на странице `/garage`

### Приоритет 4 — ЗП механиков

11. Обновить `/staff` — добавить вкладку механиков с расчётом от нарядов

---

## Архитектурные ограничения

- **НЕ менять** логику грузоперевозок — это отдельный поток данных
- **НЕ создавать** отдельные кошельки для СТО — деньги идут в те же 3 кошелька (Сейф/Карта/Р/С)
- **НЕ переписывать** существующие рабочие API нарядов — только расширять
- **Миграция БД** — создавать файл в `supabase/migrations/<timestamp>_<описание>.sql`, после запускать `pnpm db:types`, обновлять `kb/wiki/Справочник_таблиц_БД.md`
- **MiniApp vs WebApp** — закрытие наряда с оплатой реализовать в WebApp (на ПК удобнее), MiniApp получает данные автоматически

---

## Формат работы

Работай пошагово, строго в порядке приоритетов. Перед каждым шагом:

1. Покажи что именно будешь делать (файлы, изменения)
2. Дождись подтверждения
3. Реализуй
4. Обнови `kb/wiki/` (схема, API, CrossApp)
5. Закоммить все изменения одним коммитом

После завершения Приоритета 1 — обязательно проверить что транзакции от нарядов появляются в P&L на `/finance`.
