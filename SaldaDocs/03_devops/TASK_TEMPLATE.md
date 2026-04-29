# SaldaCargo — Шаблон Задачи для Разработчика

Используй этот шаблон для создания тасков, которые будут передаваться Claude Code / Cursor / Gemini CLI.

---

## 📋 ШАБЛОН ЗАДАЧИ

````markdown
# [НОМЕР НЕДЕЛИ]-[№ ЗАДАЧИ]: [НАЗВАНИЕ]

**Статус:** todo | in_progress | review | done

---

## 📌 Контекст

[2-3 предложения: зачем нужна задача, что она даёт, где используется]

**Зависит от:** [номер(а) предыдущих задач или "нет"]  
**Блокирует:** [какие задачи ждут этого]  
**Время оценка:** X часов  
**Язык:** TypeScript / React / SQL  
**Сложность:** ⭐⭐☆ (1-5 звёзд)

---

## 🎯 Что делать

### 1. [Основное действие]

[Описание с примерами кода или структурой]

```typescript
// Пример кода
```
````

### 2. [Второе действие]

### N-2. ВЕРИФИКАЦИЯ

**Сценарий проверки:** что ты нажимаешь и какой результат должен быть?

```
1. Открыть Dashboard → Money Map
2. Проверить: баланс кошельков вычисляется из transactions (только approved + completed)
3. Нажать в консоли: console.log(wallet_balance) → должно быть число ≥ 0
4. Отключить интернет → рейс всё ещё видимый (offline-first работает)
5. Включить интернет → автоматическая синхронизация ✓
```

### N-1. Заполнить COMPLETION LOG

```markdown
**Статус:** done
**Исполнитель:** Claude Code (claude-opus-4-6)
**Время фактическое:** X часов
**Что сделано:**

- ✅ Создано /api/trips/route.ts с GET/POST
- ✅ Типы в packages/shared-types/api.types.ts
- ✅ Тесты в **tests**/trips.test.ts
- ✅ Результаты верификации: успешно

**Проблемы:** [если были]
```

### N. Создать Pull Request

- Название: `[НОМЕР ЗАДАЧИ] Название коротко`
- Описание: скопировать этот таск
- Assign: тебе
- Add to Project: SaldaCargo Development Roadmap

---

## 🔐 Правила

- **Типы:** Всегда strict TypeScript, нет `any`
- **Файлы:** Новые файлы в правильные папки (согласно MONOREPO_STRUCTURE.md)
- **База данных:** Использовать только ключи из DATABASE_MAP.md
- **API:** GET → только чтение, POST → создание, PATCH → обновление, DELETE → soft delete (marked as cancelled)
- **Переменные:** Все из .env.example, не hardcoded
- **Безопасность:** RLS политики на место, SERVICE_ROLE_KEY только на сервере
- **Транзакции:** Двухосный статус (lifecycle_status + settlement_status) везде

---

## 📁 Затрагиваемые файлы

```
apps/web/app/api/trips/route.ts          ← создать
apps/miniapp/components/TripCard.tsx     ← обновить
packages/shared-types/api.types.ts       ← добавить типы
docs/API.md                              ← документировать
```

---

## 💡 Советы

- Сначала подумай: как БД выглядит (DATABASE_MAP.md)
- Потом написи SQL запрос (для Supabase)
- Потом типы (packages/shared-types)
- Потом API Route
- Потом компоненты React

**Используй:**

- `@supabase/supabase-js` для работы с БД (не Prisma)
- `shadcn/ui` для компонентов (не Material UI)
- `react-hook-form` + `zod` для форм
- `@tanstack/react-query` для запросов
- `tailwind` для стилей (не кастомные CSS)

---

## 🚨 Если что-то не ясно

Если:

- Требует clarification → добавь вопрос в комментарии задачи
- Вышла ошибка → напиши в COMPLETION LOG
- Нужно изменить архитектуру → создай issue в репо

**Не делай:**

- ❌ Свои угадывания о структуре БД
- ❌ Кастомные компоненты вместо shadcn/ui
- ❌ import without type checking
- ❌ Коммиты без тестирования

---

## ✅ Чеклист перед сдачей

- [ ] Код компилируется без ошибок (`pnpm type-check`)
- [ ] Нет `console.log` / `console.error` (оставить только для debug)
- [ ] Все импорты используются
- [ ] Нет undefined переменных
- [ ] Функция тестирована локально
- [ ] COMPLETION LOG заполнен
- [ ] PR создан с правильным названием
- [ ] Готово к ревью

---

````

---

## 📝 РЕАЛЬНЫЙ ПРИМЕР ЗАДАЧИ

### W1-03: Создать API trips (GET/POST)

**Статус:** in_progress

---

## 📌 Контекст

Основной API для управления рейсами: водитель открывает Mini App и может начать новый рейс (POST), а админ видит список всех рейсов (GET). Это блокирует все остальные логики рейсов (заказы, расходы, завершение).

**Зависит от:** W1-01 (Auth), PREP-06 (типы БД)
**Блокирует:** W1-04, W1-09, W2-02, W3-01
**Время оценка:** 3 часа
**Язык:** TypeScript + Next.js API Routes
**Сложность:** ⭐⭐☆

---

## 🎯 Что делать

### 1. Создать файл `/apps/web/app/api/trips/route.ts`

Реализовать два endpoint'а:

#### GET /api/trips
- **Параметры:**
  - `?asset_id=UUID` (фильтр по машине, опционально)
  - `?driver_id=UUID` (фильтр по водителю, опционально)
  - `?status=draft|completed|cancelled` (фильтр по статусу)
  - `?limit=50&offset=0` (пагинация)

- **Возврат:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "asset_id": "uuid-asset",
      "driver_id": "uuid-driver",
      "driver_name": "Вова",
      "asset_name": "Газель 866",
      "started_at": "2024-08-19T08:30:00Z",
      "ended_at": null,
      "trip_type": "local",
      "lifecycle_status": "draft",
      "odometer_start": 142580,
      "odometer_end": null,
      "orders_count": 3,
      "total_revenue": 10700,
      "notes": ""
    }
  ],
  "total": 15
}
````

- **Авторизация:** только `draft` рейсы водителя, `approved` видят все. Админ видит всё.
- **Сортировка:** по `started_at DESC` (свежие первыми)

#### POST /api/trips

- **Параметры (body):**

```json
{
  "asset_id": "uuid",
  "driver_id": "uuid",
  "loader_id": "uuid (опционально)",
  "trip_type": "local | intercity | moving | hourly",
  "odometer_start": 142580,
  "odometer_start_photo": "file data or URL"
}
```

- **Логика:**
  1. Проверить: driver_id = current user или admin (RLS)
  2. Создать запись в `trips` таблице (lifecycle_status='draft', status='in_progress')
  3. Вернуть созданный рейс с ID

- **Возврат:**

```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "asset_id": "...",
    "driver_id": "...",
    "lifecycle_status": "draft",
    "status": "in_progress",
    "started_at": "2024-08-19T08:30:00Z",
    "orders_count": 0,
    "total_revenue": 0
  }
}
```

- **Ошибки:**
  - 401: не авторизирован
  - 403: не твой рейс / недостаточно прав
  - 400: обязательные поля не заполнены

### 2. Создать типы в `packages/shared-types/api.types.ts`

```typescript
export interface GetTripsRequest {
  asset_id?: string;
  driver_id?: string;
  status?: 'draft' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}

export interface Trip {
  id: string;
  asset_id: string;
  driver_id: string;
  driver_name: string;
  asset_name: string;
  trip_type: 'local' | 'intercity' | 'moving' | 'hourly';
  started_at: string; // ISO 8601
  ended_at?: string;
  lifecycle_status: 'draft' | 'approved' | 'cancelled';
  status: 'in_progress' | 'completed' | 'cancelled';
  odometer_start: number;
  odometer_end?: number;
  orders_count: number;
  total_revenue: number;
  notes?: string;
}

export interface CreateTripRequest {
  asset_id: string;
  driver_id: string;
  loader_id?: string;
  trip_type?: 'local' | 'intercity' | 'moving' | 'hourly';
  odometer_start: number;
  odometer_start_photo?: string; // base64 или URL
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  total?: number;
}
```

### 3. Добавить в `packages/api-client/src/trips.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { GetTripsRequest, Trip, CreateTripRequest } from '@saldacargo/shared-types';

export async function getTrips(
  supabase: ReturnType<typeof createClient>,
  params?: GetTripsRequest,
): Promise<Trip[]> {
  let query = supabase
    .from('trips')
    .select(
      `
      id,
      asset_id,
      driver_id,
      drivers:users(full_name),
      assets(plate_number, asset_types(name)),
      trip_type,
      started_at,
      ended_at,
      lifecycle_status,
      status,
      odometer_start,
      odometer_end,
      notes,
      trip_orders(count)
    `,
    )
    .order('started_at', { ascending: false });

  if (params?.asset_id) {
    query = query.eq('asset_id', params.asset_id);
  }
  if (params?.driver_id) {
    query = query.eq('driver_id', params.driver_id);
  }
  if (params?.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query.limit(params?.limit || 50).offset(params?.offset || 0);

  if (error) throw error;

  return data || [];
}

export async function createTrip(
  supabase: ReturnType<typeof createClient>,
  input: CreateTripRequest,
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      asset_id: input.asset_id,
      driver_id: input.driver_id,
      loader_id: input.loader_id,
      trip_type: input.trip_type || 'local',
      started_at: new Date().toISOString(),
      odometer_start: input.odometer_start,
      odometer_start_photo: input.odometer_start_photo,
      lifecycle_status: 'draft',
      status: 'in_progress',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 4. Добавить в `apps/web/lib/api-client.ts`

```typescript
export const tripsApi = {
  getTrips: (params) => fetch(`/api/trips?${new URLSearchParams(params)}`).then((r) => r.json()),
  createTrip: (data) =>
    fetch('/api/trips', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
};
```

### 5. Тестирование (локально)

```bash
# 1. Запустить оба приложения
pnpm dev

# 2. В браузере отправить GET запрос
curl -H "Authorization: Bearer $ANON_KEY" http://localhost:3000/api/trips

# 3. Проверить Supabase: таблица trips должна быть пустой или с тестовыми данными
```

---

## ✅ ВЕРИФИКАЦИЯ

**Сценарий проверки:**

```
1. Открыть Mini App (водитель логин)
2. Нажать [Начать рейс]
3. В компонент передать: asset_id, loader_id, odometer_start
4. POST /api/trips → создан новый рейс в БД
5. Проверить в Supabase:
   - lifecycle_status = 'draft' ✓
   - status = 'in_progress' ✓
   - started_at заполнен ✓
6. Открыть Dashboard → видеть этот рейс в списке (если админ или владелец)
7. Водитель видит только свой рейс (RLS работает)
8. Админ видит все рейсы (RLS работает)
9. Нажать GET /api/trips?driver_id=xxx → вернулся только твой рейс ✓
```

---

## COMPLETION LOG

**Статус:** _pending_
**Исполнитель:** **\_
**Время фактическое:** \_**
**Что сделано:**

- [ ] /apps/web/app/api/trips/route.ts (GET + POST)
- [ ] packages/shared-types/api.types.ts (типы)
- [ ] packages/api-client/src/trips.ts (функции)
- [ ] apps/web/lib/api-client.ts (обёртка)
- [ ] Тестировано локально (GET и POST работают)
- [ ] RLS политики проверены (водитель видит свои, админ видит все)
- [ ] Типы TS: strict mode ✓
- [ ] Результаты верификации: ✅ Успешно

**Проблемы:** (если были)

---

```

---

## 🎨 Как использовать этот шаблон

### Для каждого таска из ROADMAP.md:

1. **Скопировать этот шаблон**
2. **Заполнить:**
   - Название из ROADMAP (например, W1-03)
   - Контекст (зачем, что даёт)
   - Зависимости (от каких задач зависит)
   - Время оценка (из ROADMAP)
   - Блокирует (какие задачи ждут)
3. **Добавить конкретное описание:**
   - Какие файлы трогать
   - Какие функции писать
   - Какие типы создать
   - Примеры кода (если нужны)
4. **Добавить верификацию:**
   - Сквозной сценарий (от пользователя до БД)
   - Как проверить в консоли или UI
5. **Разместить в GitHub Issues**

---

## 📊 Где хранить таски

### Вариант 1: GitHub Issues (рекомендуется)
- Repo → Issues
- Create Issue → выбрать этот шаблон
- Assign себе или Claude Code
- Add to Project: SaldaCargo Development Roadmap
- Комментарии = progress

### Вариант 2: Файлы в repo
```

tasks/
├── todo/
│ └── W1-03_trips_api.md
├── in_progress/
│ └── (пусто)
└── done/
└── PREP-01_init_supabase.md

````

Перемещать файл из папки в папку по мере выполнения.

### Вариант 3: Notion / Linear (если у тебя есть)
- Создать таблицу Tasks
- Скопировать поля из этого шаблона
- Sync с GitHub?

---

## 🤖 Как передать разработчику (Claude Code / Cursor)

### Через CLI:

```bash
# Copy задачу в буфер обмена
pbcopy < tasks/todo/W1-03_trips_api.md

# Или прямо передать:
cat tasks/todo/W1-03_trips_api.md | xargs -0 -I {} claude "Выполни эту задачу: {}"
````

### Через UI Claude.ai:

1. Скопировать весь текст задачи
2. Вставить в чат с Claude
3. Он поймёт структуру и выполнит пошагово

### Через Cursor:

1. Ctrl+K → "выполнить эту задачу"
2. Вставить текст задачи
3. Cursor использует файлы в workspace

---

## 💾 Template в Markdown

Сохрани этот текст в `docs/TASK_TEMPLATE.md` и используй как основу для всех задач.

```bash
# Создать задачу из шаблона
cp docs/TASK_TEMPLATE.md tasks/todo/W1-03_trips_api.md
# Отредактировать в editor
```

---

## ✅ Итого

✅ **У тебя есть шаблон для всех тасков**  
✅ **Примеры реальных задач (W1-03)**  
✅ **Четкая верификация (как проверять)**  
✅ **Правила и чеклисты (что не делать)**

Теперь используй ROADMAP.md + этот шаблон → создавай задачи для разработчиков!
