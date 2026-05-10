# КОНТЕКСТ ПРОЕКТА: SaldaCargo (10.05.2026 — сессия 5)

> Этот файл — точка входа для AI-ассистента. Прочитав его, ты знаешь где мы находимся и что делать дальше.
> База знаний: `kb/wiki/` — читай соответствующие статьи перед задачами.

---

## 1. Что за проект

SaldaCargo — ERP-система для транспортной компании (Верхняя Салда).  
Цель: в будущем продать как коробочное решение для других транспортных компаний.

**Два приложения:**

- `apps/miniapp` — Next.js 15, мобильный интерфейс для водителей/механиков/админа (мессенджер MAX)
- `apps/web` — Next.js 15, десктопный дашборд для владельца и админа

**Стек:** Next.js 15, React 19, TypeScript, Supabase (PostgreSQL), TanStack Query, Tailwind CSS 4  
**Auth:** кастомная cookie-схема (`salda_user_id`), НЕ Supabase Auth  
**Деплой:** Vercel (miniapp и webapp — оба задеплоены, автодеплой из `main`)

---

## 2. Что уже реализовано

### MiniApp (apps/miniapp) — ГОТОВО ✅

- Авторизация водителей/механиков/админа через MAX и PIN
- **Водитель:** создание рейса, заказы (способы оплаты: cash/qr/bank_invoice/debt_cash/card_driver), расходы, завершение с одометром. Обязательное поле клиента при добавлении заказа. Кнопка **🔧 Починить** → форма заявки на ремонт своего авто (`lifecycle_status='draft'`).
- **Механик:** наряды, запчасти, статусы. Видит **только** наряды с `lifecycle_status='approved'` — пока админ не одобрил, наряд механику недоступен.
- **Админ (мобильный):**
  - Дашборд с KPI (summary)
  - **Рейсы** — три вкладки:
    - 📋 **На ревью** — раскрываемые карточки с полными данными, кнопки ✏️ Изменить / ↩ Вернуть / ✓ Одобрить прямо в карточке
    - 🚛 **Активные** — простые ссылки-карточки
    - 📅 **История** — навигация по датам (← →), раскрываемые карточки, редактирование, апрув/возврат, итоги за день
  - **Редактирование заявок** (EditModal): клиент, сумма, ЗП водителя/грузчика, способ оплаты.
  - **Наряды** (`/admin/orders`) — три вкладки: На ревью / Активные / История.
    - На ревью: `lifecycle_status='draft'`
    - Активные: `lifecycle_status='approved'` + `status IN ('created','in_progress')`
    - История: `(lifecycle_status='approved' AND status='completed') OR lifecycle_status IN ('cancelled','returned')`
    - Раскрываемые карточки с апрувом/возвратом, кнопка "Отменить" (двойное подтверждение). API: `/api/admin/service-orders`.
  - **Финансы:**
    - Доход / Расход / Долги (кредиты + поставщики) / Инкассация
    - ЗП сотрудников (`/api/admin/staff-settle`)
    - **Дебиторка** (`/api/admin/receivables` + `/api/admin/receivables/settle`): список должников → заказы → погасить (обновляет trip_orders + создаёт income-транзакцию)

### WebApp (apps/web) — В РАЗРАБОТКЕ 🔨

- Авторизация (PIN, middleware настроен, для локального тестирования — отключена)
- **Главная (/):** KPI за месяц из БД
- **Ревью (/review):** одобрение/возврат + История по датам. Редактирование заявок включает поле **Клиент** (find-or-create в counterparties)
- **Ретро (/retro):** ручной ввод рейса задним числом
- **Финансы (/finance):** P&L за 6 месяцев, журнал транзакций, подотчёт водителей
- **Дебиторка (/receivables):** список должников, просрочка, отметить оплаченным
- **Автопарк (/fleet):** ✅ ГОТОВО — коллапсируемые плитки, юнит-экономика, monthly_fixed_cost
- **Гараж (/garage):** ✅ ГОТОВО — наряды СТО: На ревью / Активные / История. Апрув/возврат/отмена, hard DELETE с двойным подтверждением. API: `/api/garage/orders`. Те же фильтры что и в MiniApp нарядах.
- **Персонал (/staff):** ✅ ГОТОВО — таблица по группам, переключатель месяцев, заработано/выплачено/долг, Рассчитаться, CRUD сотрудников

---

## 3. Архитектура учёта ЗП (важно!)

ЗП — **два разных источника**, не смешивать:

| Источник                              | Что даёт                 | Где используется                                   |
| ------------------------------------- | ------------------------ | -------------------------------------------------- |
| `trip_orders.driver_pay / loader_pay` | Начисленная ЗП из рейсов | P&L, плитка ЗП на дашборде, "заработано" на /staff |
| `transactions` (category PAYROLL\_\*) | Факт выплаты денег       | "выплачено" на /staff, debt tracking               |

**Правило:** PAYROLL-транзакции **исключены** из P&L (`expenses`), чтобы не задваивать с `payrollFromOrders`.  
**Расчёт долга:** `debt = MAX(earned - paid, 0)`. Если `auto_settle = true` → `debt = 0` всегда.

---

## 4. Дебиторка — архитектура (важно!)

- **Источник долга:** `trip_orders` где `settlement_status='pending'` AND `lifecycle_status='approved'`
- **Погашение:** POST `/api/admin/receivables/settle` → `trip_orders.settlement_status='completed'` + INSERT в `transactions` (direction='income', category=TRIP_REVENUE `74008cf7-...`)
- После погашения долг исчезает из дебиторки в WebApp и MiniApp одновременно (одна БД)

---

## 5. Workflow нарядов (важно!)

```
Водитель → создаёт заявку (lifecycle_status='draft')
              ↓
Админ → видит на ревью → Одобрить / Вернуть / Отменить
              ↓ (approve)
Механик → видит наряд → берёт в работу → завершает (status='completed')
              ↓
История: lifecycle_status='approved' + status='completed'
```

**Правило:** механик видит ТОЛЬКО `lifecycle_status='approved'`. Черновики (`draft`) ему недоступны.  
**API механика:** `GET /api/mechanic/orders?mechanic_id=...` → фильтр `lifecycle_status='approved' AND status IN ('created','in_progress')` в `getMechanicOrders()` из `@saldacargo/domain-service`.  
**API водителя:** `POST /api/driver/service-orders` → всегда создаёт `lifecycle_status='draft'`.

---

## 6. Следующие шаги (в порядке выполнения)

> Статус на 10.05.2026 (сессия 5): Баги нарядов исправлены. Bottom-sheet модалки работают.
> Фильтры истории нарядов починены (только завершённые/отменённые). price_per_unit → unit_price.

### ШАГ 1 — Долги поставщикам: migration + API + WebApp + MiniApp

**Миграция:** добавить `payable_amount DECIMAL(12,2) DEFAULT 0` в `counterparties`  
**WebApp /counterparties:** поле "Мы должны: X ₽" на карточке поставщика  
**API PATCH /api/counterparties/[id]:** принимать `payable_amount`  
**MiniApp /api/admin/payables:** заменить хардкод — брать из `counterparties.payable_amount > 0`

### ШАГ 2 — Починить переключатель периода (WebApp)

Переключатель есть в layout.tsx (sticky под хэдером), кнопки пишут `?period=` в URL.  
Проблема: отдельные страницы не передают `period` в запросы к API или API его игнорирует.  
Проверить: fleet, главная, finance, staff, receivables.

### ШАГ 3 — WebApp: активные/апрувнутые рейсы не отображаются

На странице `/review` (история) рейсы с `lifecycle_status='approved'` фильтруются по дате `started_at`.  
Активные рейсы (`status='in_progress'`) могут не показываться если начались в другой день.  
Нужно добавить вкладку "Активные" без фильтра по дате, либо убрать date-фильтр для `in_progress`.

### ШАГ 4 — MiniApp: реструктуризация кнопок финансов

**Файл:** `apps/miniapp/app/admin/finance/page.tsx`  
Новая двухуровневая структура: [Доход] [Расход] → подменю с вариантами.  
Из expense form убрать: Аренда, Амортизация, Списание актива, PAYROLL\_\*.

---

## 7. Ключевые технические факты

- `users.roles` — массив, фильтровать через `.contains('roles', ['driver'])`, НЕ `.eq('role', ...)`
- Все API-роуты используют `createAdminClient()` с `(supabase.from('table') as any)`
- Деньги — только строкой: `"5000.00"`, компонент `<Money amount="5000.00" />`
- `crypto.randomUUID()` для idempotency_key в webapp (НЕ пакет `uuid`)
- `useSearchParams()` в Next.js 15 — обязательно в `<Suspense>` иначе падает сборка
- Скроллируемый flex-child — обязательно `min-h-0` + `overflow-y-auto`, иначе кнопки за экраном
- **Bottom-sheet в MAX WebView:** НЕ использовать `overflow:hidden` на body (ломает скролл внутри), НЕ использовать `touchAction:none` (ломает pan-y у детей). Использовать `position:fixed` на body при монтировании + `paddingBottom: calc(env(safe-area-inset-bottom,0px) + 56px)` на оверлее
- Скролл в модалке: `overflowY:auto` + `WebkitOverflowScrolling:touch` на самом белом листе (не на вложенном div), `maxHeight: 'calc(100vh - 80px)'`
- Контрагент (клиент) при редактировании заявки — find-or-create: `.ilike('name', name).maybeSingle()` → если нет → insert
- `shrink-0` на метриках + `flex-1 min-w-0` на идентификаторе — выравнивание колонок
- Двухшаговое удаление: `boolean state` + `useRef` таймер 4 сек авто-сброс
- Деплой: Vercel автодеплой из `main` для обоих приложений — **всегда делать `git push` после коммита**
- Генерация типов: `npx supabase gen types typescript --project-id dzwuvbhfqnsxbfbynmgz > packages/shared-types/src/database.types.ts`
- `service_order_parts` — колонка называется `unit_price` (НЕ `price_per_unit`)
- История нарядов: фильтровать `.or('lifecycle_status.in.(cancelled,returned),and(lifecycle_status.eq.approved,status.eq.completed)')` — НЕ тянуть все записи без фильтра

### ID кошельков (hardcoded):

```
10000000-0000-0000-0000-000000000001 — Расчётный счёт
10000000-0000-0000-0000-000000000002 — Сейф (Наличные)
10000000-0000-0000-0000-000000000003 — Карта
```

### ID категорий (hardcoded):

```
74008cf7-0527-4e9f-afd2-d232b8f8125a — TRIP_REVENUE (выручка с рейса)
d79213ee-3bc6-4433-b58a-ca7ea1040d00 — PAYROLL_DRIVER
18792fa8-fda8-472d-8e04-e19d2c6c053c — PAYROLL_LOADER
3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6 — PAYROLL_MECHANIC
```

→ Полная схема БД: [`kb/wiki/Справочник_таблиц_БД.md`](../../kb/wiki/Справочник_таблиц_БД.md)  
→ API miniapp: [`kb/wiki/MiniApp_API.md`](../../kb/wiki/MiniApp_API.md)  
→ Структура проекта: [`kb/wiki/Структура_монорепозитория.md`](../../kb/wiki/Структура_монорепозитория.md)

---

_Обновлён: 10.05.2026 (сессия 5). Наряды работают корректно. Bottom-sheet модалки исправлены._
