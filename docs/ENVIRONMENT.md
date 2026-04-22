# SaldaCargo — Среда разработки

---

## 1. Фреймворк и версия

- Фреймворк: Next.js 15 (App Router)
- React: 19
- TypeScript: 5.x (strict mode)
- Node.js: 18+
- Документация Next.js: https://nextjs.org/docs

---

## 2. Структура монорепо

```
SaldaCargo/
├── apps/
│   ├── web/          # Dashboard владельца/админа (порт 3000)
│   └── miniapp/      # Mini App для водителей в MAX (порт 3001)
├── packages/
│   ├── shared-types/ # TypeScript типы из Supabase (@saldacargo/shared-types)
│   └── ui/           # Общие UI компоненты (@saldacargo/ui)
├── docs/             # Документация проекта (BOOT, RULES, BRIEF, ENVIRONMENT, LESSONS)
├── tasks/
│   ├── todo/         # Задачи в работе
│   └── done/         # Завершённые задачи
├── pnpm-workspace.yaml
├── .env.example
└── package.json
```

---

## 3. Переменные окружения

Файлы: apps/web/.env.local и apps/miniapp/.env.local (не в git!)
Шаблон: .env.example в корне репо

```bash
# Supabase (обязательно)
NEXT_PUBLIC_SUPABASE_URL=        # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # публичный ключ (RLS ограничивает)
SUPABASE_SERVICE_ROLE_KEY=       # серверный ключ (обходит RLS — только сервер!)

# MAX SDK (Mini App)
NEXT_PUBLIC_MAX_BOT_TOKEN=
NEXT_PUBLIC_MAX_APP_ID=com.saldacargo.miniapp

# External APIs
OPTI24_API_KEY=
WIALON_API_TOKEN=
SENTRY_DSN=

# App
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_VERSION=1.0.0
```

---

## 4. Supabase клиенты

| Файл | Ключ | Где использовать |
|------|------|-----------------|
| src/lib/supabase/client.ts | ANON_KEY | Client Components ('use client') |
| src/lib/supabase/server.ts | ANON_KEY | Server Components, Route Handlers |
| src/lib/supabase/admin.ts | SERVICE_ROLE_KEY | Только API Routes (сервер!) |

---

## 5. Детализация переменных

| Переменная | Источник | Назначение |
|------------|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Settings -> API | Базовый URL БД |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Settings -> API | Полный доступ (bypass RLS) |
| `OPTI24_API_KEY` | Личный кабинет Опти24 | Синхронизация ГСМ |
| `WIALON_API_TOKEN` | Wialon -> Управление | Проверка пробега |

---

## 6. База данных

- Supabase PostgreSQL (Free tier, Europe Frankfurt)
- 22 таблицы, все созданы и готовы
- RLS включён на: users, assets, trips, trip_orders, transactions, wallets
- pg_cron установлен (v1.6.4)
- Seed data загружены: asset_types, business_units, categories, payroll_rules, wallets

Supabase Dashboard: https://supabase.com/dashboard

---

## 6. Зависимости (основные)

| Пакет | Назначение |
|-------|-----------|
| @supabase/supabase-js | Supabase клиент |
| @supabase/ssr | SSR-совместимый клиент для Next.js |
| @tanstack/react-query | Кэш и синхронизация данных |
| react-hook-form | Управление формами |
| zod | Валидация схем |
| @hookform/resolvers | Связка zod + react-hook-form |
| shadcn/ui | UI компоненты (только в apps/web) |
| tailwindcss | Стилизация |

---

## 7. Команды

```bash
# Разработка
pnpm dev:web          # Dashboard на localhost:3000
pnpm dev:miniapp      # Mini App на localhost:3001

# Сборка
pnpm build:web
pnpm build:miniapp

# Установка пакетов
pnpm --filter web add <pkg>
pnpm --filter miniapp add <pkg>
pnpm --filter @saldacargo/shared-types add <pkg>

# Из корня
pnpm install          # Установить все зависимости
```

---

## 8. Известные ограничения

- Vercel Hobby: нет Cron Jobs → используем pg_cron в Supabase (бесплатно)
- Supabase Free: 500 МБ БД, 1 ГБ Storage, 50k API/мес
- Сборка на Vercel: SUPABASE_SERVICE_ROLE_KEY должен быть добавлен в Vercel Environment Variables

---

*Последнее обновление: 22.04.2026*
