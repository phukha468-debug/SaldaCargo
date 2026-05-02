# GEMINI.md

Инструкции для Gemini Code Assist и Gemini CLI, работающих в этом репозитории.

> **Важно:** этот файл сильно пересекается с `CLAUDE.md`. Если ты Gemini, а в репо открыт `CLAUDE.md` — игнорируй его и читай этот. Содержательно правила те же, но с поправкой на твой контекстный бюджет и манеру работы.

---

## Что это за проект

**SaldaCargo** — система управления транспортным бизнесом в Верхней Салде:

- **MiniApp** — мини-приложение в мессенджере МАХ (роли: водитель, механик, админ).
- **WebApp** — веб-дашборд для админа и владельца.

Стек: Next.js 15 + Supabase + Vercel. Один разработчик-владелец работает с AI.

---

## Работа с задачами

Все задачи на разработку и настройку находятся в папке `tasks/todo/`.

1. **Бери задачу** из `tasks/todo/` (обычно это файл с наименьшим порядковым номером, например `TASK_00_...`).
2. **Выполняй её** в точности по шагам и критериям приёмки.
3. **После завершения** подготовь отчёт для пользователя.
4. **Перемещение файла:** пользователь сам переместит файл в `tasks/done/` после проверки, либо может попросить тебя сделать это в рамках задачи.

---

## Что прочитать перед работой

Перед каждой задачей **обязательно** открой и прочитай:

1. `docs/architecture/01-overview.md` — общая архитектура.
2. `docs/architecture/02-modules.md` — граф модулей и правила импортов.
3. `docs/architecture/03-conventions.md` — соглашения.

Если задача про конкретный модуль — `docs/modules/<имя>/README.md`.
Если задача про пользовательский сценарий — `docs/flows/<имя>.md`.

**Если ты собираешься писать код, не открыв ни одного из этих файлов — ты делаешь ошибку.** Документация — источник истины, твоё знание архитектуры устаревает между задачами.

---

## Основные правила

### 1. Архитектура — Modular Monolith

Бизнес-логика лежит в `packages/domain/` в 9 модулях:

```
shared      — деньги, даты, идемпотентность
identity    — пользователи, роли, MAX OAuth
fleet       — машины, амортизация
finance     — транзакции, кошельки
logistics   — рейсы, заказы
service     — наряды, склад, дефекты
payroll     — ЗП по периодам
receivables — дебиторка
integrations— Опти24, Wialon, банк
```

**Граф зависимостей** (см. `02-modules.md`): модуль может звать только модули с уровней ниже. Между соседями — нельзя.

ESLint-правило `boundaries` следит за этим. Если ты нарушишь — `pnpm lint` упадёт.

### 2. API routes — тонкие обёртки

```typescript
// apps/web/app/api/trips/[id]/approve/route.ts
import { approveTrip } from '@saldacargo/domain-logistics';
import { ApproveTripSchema } from './schema';

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  const body = ApproveTripSchema.parse(await req.json());
  const result = await approveTrip({ tripId: params.id, approverId: user.id, ...body });
  return result.ok
    ? Response.json(result.value)
    : Response.json({ error: result.error }, { status: 400 });
}
```

Никакого SQL в роутах. Никаких `if`/`else` бизнес-логики. Всё — в `domain/<модуль>/services.ts`.

### 3. Двухосный статус транзакций

- `lifecycle_status`: `draft → approved → cancelled`
- `settlement_status`: `pending → completed`

Балансы считаются по `approved + completed`. Точка.

### 4. ЗП — ручной ввод

`trip_orders.driver_pay` вводится водителем вручную. Подсказка «~30%» — только UI. Никаких триггеров, которые пересчитывают введённую цифру.

### 5. Деньги в DECIMAL, не float

Используй `string` в TypeScript для денежных сумм. Арифметика — через `@saldacargo/domain-shared/money`. В БД — `DECIMAL(12,2)`.

### 6. Soft-delete

Никаких `DELETE`. Только `cancelled` со статусом и причиной. История неизменна.

### 7. Идемпотентность

Все мутации с клиента приходят с `idempotency_key` (UUID v4). Сервер дедуплицирует.

### 8. RLS включён везде

Политики Supabase в миграциях. Не пиши проверки прав в коде приложения, если эту проверку можно сделать на уровне БД.

---

## Миграции БД

1. Прочитай `docs/database/schema.md`.
2. Создай файл `supabase/migrations/<timestamp>_<имя>.sql`.
3. Обнови `docs/database/schema.md`.
4. Обнови `docs/modules/<модуль>/README.md` если меняются сущности модуля.
5. Сгенерируй типы: `pnpm gen:types`.
6. Один коммит: миграция + типы + документация.

---

## Стек

- **Frontend:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind, shadcn/ui, Tremor
- **Backend:** Next.js API Routes, Supabase JS Client (НЕ Prisma, НЕ Drizzle)
- **БД:** Supabase PostgreSQL + RLS + pg_cron
- **Auth:** Supabase Auth + MAX OAuth
- **Формы:** react-hook-form + zod
- **Запросы:** TanStack Query
- **Тесты:** Vitest
- **Mono:** pnpm workspaces

---

## Особенности работы с Gemini

Если ты работаешь через Gemini CLI с большим контекстом — **загружай документацию в контекст явно**, не полагайся на индексацию:

```bash
gemini --context docs/architecture/01-overview.md \
       --context docs/architecture/02-modules.md \
       --context docs/architecture/03-conventions.md \
       --context docs/modules/logistics/README.md \
       "Добавь функцию отмены рейса"

---

## Что НЕ делать

- ❌ Не импортируй между соседями по графу модулей.
- ❌ Не добавляй SQL внутрь API routes.
- ❌ Не меняй структуру папок без явной задачи.
- ❌ Не добавляй новые библиотеки без обсуждения.
- ❌ Не используй `number` для денег.
- ❌ Не делай `DELETE` в SQL.
- ❌ Не пиши автопересчёт ЗП.
- ❌ Не коммитишь `.env.*`.

---

## Язык

- Документация и UI — **русский**.
- Код, переменные, имена БД — **английский, snake_case** для БД, **camelCase** для TS.
- Коммиты — **русский** (или английский, на выбор).

---

## Если непонятно

Останавливайся и спрашивай. Не угадывай. Лучше PR с вопросом, чем PR с поломкой.

---

**Если этот файл противоречит коду — прав файл.**
