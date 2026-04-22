# SaldaBiz — Структура Монорепо

**Фреймворк:** pnpm monorepo (workspaces)  
**Язык:** TypeScript  
**Package Manager:** pnpm (вместо npm/yarn)  

---

## 1. Полная структура проекта

```
saldabiz/                                  ← root монорепо
│
├── .github/
│   ├── workflows/
│   │   ├── deploy-web.yml                ← CI/CD: deploy web на Vercel
│   │   ├── deploy-miniapp.yml            ← CI/CD: deploy miniapp на Vercel
│   │   └── test.yml                      ← Run tests на каждый push
│   └── CODEOWNERS
│
├── apps/
│   │
│   ├── web/                              ← Dashboard для admin/owner
│   │   ├── app/                          ← Next.js 15 App Router
│   │   │   ├── layout.tsx                ← Root layout
│   │   │   ├── page.tsx                  ← Home (перенаправление)
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── setup/page.tsx        ← Setup Wizard
│   │   │   ├── (dashboard)/
│   │   │   │   ├── money-map/page.tsx    ← Карта денег (Главная)
│   │   │   │   ├── trips/
│   │   │   │   │   ├── page.tsx          ← Список рейсов
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx      ← Детали рейса
│   │   │   │   │       └── review/page.tsx ← Ревью смены
│   │   │   │   ├── assets/
│   │   │   │   │   ├── page.tsx          ← Автопарк (сетка)
│   │   │   │   │   └── [id]/page.tsx     ← Детали машины
│   │   │   │   ├── transactions/page.tsx ← Лента транзакций
│   │   │   │   ├── payroll/
│   │   │   │   │   ├── page.tsx          ← ЗП (периоды)
│   │   │   │   │   └── [id]/page.tsx     ← Детали периода
│   │   │   │   ├── receivables/page.tsx  ← Дебиторка
│   │   │   │   ├── payables/page.tsx     ← Кредиторка
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx          ← Настройки (юрлица, категории и т.д.)
│   │   │   │       ├── users/page.tsx
│   │   │   │       ├── payroll-rules/page.tsx
│   │   │   │       └── integrations/page.tsx
│   │   │   └── api/
│   │   │       ├── auth/
│   │   │       │   ├── max/route.ts      ← MAX OAuth
│   │   │       │   └── logout/route.ts
│   │   │       ├── trips/route.ts        ← GET/POST trips
│   │   │       ├── trips/[id]/
│   │   │       │   ├── route.ts          ← GET/PATCH trip
│   │   │       │   ├── approve/route.ts  ← POST approve
│   │   │       │   ├── review/route.ts   ← GET ревью данные
│   │   │       │   └── summary/route.ts  ← GET сводка за день
│   │   │       ├── transactions/route.ts ← GET/POST/PATCH
│   │   │       ├── transactions/[id]/
│   │   │       │   ├── route.ts
│   │   │       │   ├── approve/route.ts
│   │   │       │   └── complete/route.ts
│   │   │       ├── money-map/route.ts    ← GET баланс кошельков + P&L
│   │   │       ├── assets/route.ts       ← CRUD автопарк
│   │   │       ├── payroll/
│   │   │       │   ├── calculate/route.ts
│   │   │       │   └── periods/route.ts
│   │   │       ├── admin/
│   │   │       │   ├── depreciation/route.ts
│   │   │       │   └── sync-opti24/route.ts
│   │   │       └── health/route.ts       ← Health check
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── features/
│   │   │   │   ├── MoneyMap.tsx          ← Главная (карта денег)
│   │   │   │   ├── TripReviewTable.tsx   ← Ревью смены
│   │   │   │   ├── TransactionList.tsx
│   │   │   │   ├── AssetGrid.tsx
│   │   │   │   ├── PayrollCalculator.tsx
│   │   │   │   └── SetupWizard.tsx
│   │   │   └── common/
│   │   │       ├── (все используются из packages/ui)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTrips.ts
│   │   │   ├── useTransactions.ts
│   │   │   ├── usePayroll.ts
│   │   │   ├── useMoneyMap.ts
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase.ts               ← Client Supabase
│   │   │   ├── api-client.ts             ← Обёртка над API Routes
│   │   │   └── utils.ts                  ← Хелперы (форматирование денег и т.д.)
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css               ← Tailwind init
│   │   │
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── package.json
│   │   └── .env.example                  ← Шаблон переменных
│   │
│   └── miniapp/                          ← Mini App для MAX (водители)
│       ├── app/
│       │   ├── layout.tsx                ← Root layout (safe-areas)
│       │   ├── page.tsx                  ← Home водителя
│       │   ├── (app)/
│       │   │   ├── dashboard/page.tsx    ← Главная (если нет рейса)
│       │   │   ├── trip/
│       │   │   │   ├── [id]/page.tsx     ← Активный рейс
│       │   │   │   ├── [id]/start/page.tsx ← Начало рейса (modal)
│       │   │   │   ├── [id]/order/page.tsx ← Форма заказа (modal)
│       │   │   │   ├── [id]/expense/page.tsx ← Форма расхода (modal)
│       │   │   │   └── [id]/complete/page.tsx ← Завершение рейса (modal)
│       │   │   ├── my-accountable/page.tsx ← Мой подотчёт
│       │   │   ├── my-payroll/page.tsx   ← Моя ЗП
│       │   │   ├── history/page.tsx      ← История рейсов
│       │   │   ├── service-orders/page.tsx ← Мои заказ-наряды (mechanic)
│       │   │   └── settings/page.tsx     ← Настройки
│       │   └── api/
│       │       ├── auth/
│       │       │   ├── max/route.ts
│       │       │   └── me/route.ts       ← GET профиль текущего юзера
│       │       ├── trips/
│       │       │   ├── route.ts          ← GET активный + GET список
│       │       │   └── [id]/route.ts     ← GET/PATCH/POST (start, orders, expenses, complete)
│       │       ├── my/
│       │       │   ├── accountable/route.ts
│       │       │   └── payroll/route.ts
│       │       ├── sync/route.ts         ← POST синхронизация IndexedDB → Supabase
│       │       └── health/route.ts
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.tsx            ← Простая шапка с <
│       │   │   ├── TabBar.tsx            ← Bottom tabs (4 иконки)
│       │   │   └── MiniAppLayout.tsx
│       │   ├── features/
│       │   │   ├── TripCard.tsx
│       │   │   ├── OrderForm.tsx         ← Форма заказа
│       │   │   ├── ExpenseForm.tsx
│       │   │   ├── TripStartModal.tsx
│       │   │   ├── TripCompleteModal.tsx
│       │   │   └── AccountableBalance.tsx
│       │   └── (остальное из packages/ui)
│       │
│       ├── hooks/
│       │   ├── useOfflineStorage.ts      ← IndexedDB via Dexie
│       │   ├── useSync.ts                ← Синхронизация
│       │   ├── useActiveTrip.ts
│       │   ├── useTrips.ts
│       │   ├── useAuth.ts
│       │   └── useHaptic.ts              ← Вибрация
│       │
│       ├── lib/
│       │   ├── supabase.ts               ← Client Supabase
│       │   ├── api-client.ts
│       │   ├── db.ts                     ← Dexie (IndexedDB схема)
│       │   ├── offline-queue.ts          ← Очередь мутаций для sync
│       │   └── max-sdk.ts                ← Обёртка над MAX SDK
│       │
│       ├── styles/
│       │   ├── globals.css
│       │   └── safe-areas.css            ← env(safe-area-inset-*)
│       │
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── package.json
│       └── .env.example
│
├── packages/
│   │
│   ├── shared-types/                    ← Общие типы
│   │   ├── index.ts
│   │   ├── database.types.ts            ← Генерируется из Supabase (supabase gen types)
│   │   ├── api.types.ts                 ← Типы API запросов/ответов
│   │   ├── business.types.ts            ← Бизнес-логика (PaymentMethod, TripType и т.д.)
│   │   └── package.json
│   │
│   ├── ui/                              ← Компоненты + стили
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx            ← shadcn/ui + наш стилинг
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx             ← Статус-бейджи
│   │   │   │   ├── Dialog.tsx
│   │   │   │   ├── Combobox.tsx          ← Autocomplete
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── StatusBadge.tsx       ← Для двухосного статуса
│   │   │   │   ├── MoneyBadge.tsx        ← Форматирование денег
│   │   │   │   └── ...остальное shadcn/ui
│   │   │   ├── icons/
│   │   │   │   ├── TripIcon.tsx
│   │   │   │   ├── MoneyIcon.tsx
│   │   │   │   └── ...
│   │   │   ├── hooks/
│   │   │   │   └── useToast.ts           ← Из sonner
│   │   │   ├── theme/
│   │   │   │   ├── colors.ts             ← Палитра из дизайна
│   │   │   │   ├── typography.ts
│   │   │   │   └── spacing.ts
│   │   │   ├── index.ts                  ← Export всех компонентов
│   │   │   └── global.css
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   ├── api-client/                      ← Supabase функции
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── supabase.ts               ← Инициализация Supabase Client
│   │   │   ├── auth.ts                   ← Login, logout, getCurrentUser
│   │   │   ├── trips.ts                  ← CRUD trips + trip_orders
│   │   │   ├── transactions.ts           ← CRUD transactions
│   │   │   ├── assets.ts                 ← CRUD assets
│   │   │   ├── payroll.ts                ← Расчёт ЗП
│   │   │   ├── wallets.ts                ← Баланс кошельков
│   │   │   ├── integrations/
│   │   │   │   ├── opti24.ts
│   │   │   │   ├── wialon.ts
│   │   │   │   └── bank.ts
│   │   │   ├── utils.ts                  ← Хелперы (форматирование, валидация)
│   │   │   └── types.ts                  ← Локальные типы для API
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── constants/                        ← Константы и конфиг
│       ├── src/
│       │   ├── index.ts
│       │   ├── business-rules.ts         ← % ЗП, типы рейсов и т.д.
│       │   ├── api-endpoints.ts
│       │   ├── error-messages.ts
│       │   └── feature-flags.ts          ← A/B тесты, фичи
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── BOOT.md                          ← Как запустить dev сервер
│   ├── DATABASE.md                      ← Полная карта БД (этот файл создам)
│   ├── ENVIRONMENT.md                   ← Переменные окружения (этот файл создам)
│   ├── ROADMAP.md                       ← Дорожная карта (создам)
│   ├── DEPLOYMENT.md                    ← Как деплоить (создам)
│   ├── API.md                           ← Спека API Routes (создам)
│   ├── OFFLINE_SYNC.md                  ← Offline-first синхронизация
│   └── TESTING.md                       ← Как тестировать
│
├── scripts/
│   ├── setup-db.ts                      ← Init Supabase (создание таблиц)
│   ├── seed-db.ts                       ← Seed данные (SaldaBiz_Seed_Data.md)
│   ├── export-types.sh                  ← Генерация типов из Supabase
│   └── clean.sh                         ← Очистка build артифактов
│
├── .env.example                         ← Шаблон (все переменные со значениями)
├── .env.local                           ← Git ignored, локальный dev
├── .env.production                      ← Production переменные (Vercel secrets)
├── .gitignore
├── pnpm-workspace.yaml                  ← Конфиг monorepo (pnpm)
├── package.json                         ← Root: скрипты, deps, версии
├── tsconfig.base.json                   ← Base TypeScript конфиг
├── turbo.json                           ← Turbo для build caching (опционально)
├── README.md
├── LICENSE
└── .github/
    ├── CONTRIBUTING.md
    ├── PULL_REQUEST_TEMPLATE.md
    └── ISSUE_TEMPLATE/
        ├── task.md
        └── bug.md
```

---

## 2. pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 3. package.json (root)

```json
{
  "name": "saldabiz",
  "version": "1.0.0",
  "description": "Transport business management system",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev:web": "pnpm --filter @saldabiz/web dev",
    "dev:miniapp": "pnpm --filter @saldabiz/miniapp dev",
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "build:web": "pnpm --filter @saldabiz/web build",
    "build:miniapp": "pnpm --filter @saldabiz/miniapp build",
    "lint": "pnpm -r lint",
    "type-check": "pnpm -r type-check",
    "test": "pnpm -r test",
    "db:setup": "ts-node scripts/setup-db.ts",
    "db:seed": "ts-node scripts/seed-db.ts",
    "db:types": "scripts/export-types.sh",
    "clean": "scripts/clean.sh"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5.3",
    "ts-node": "^10.9",
    "turbo": "^1.10"
  }
}
```

---

## 4. tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "baseUrl": ".",
    "paths": {
      "@saldabiz/shared-types": ["packages/shared-types/src"],
      "@saldabiz/ui": ["packages/ui/src"],
      "@saldabiz/api-client": ["packages/api-client/src"],
      "@saldabiz/constants": ["packages/constants/src"],
      "@/*": ["./apps/web/src/*"],
      "@miniapp/*": ["./apps/miniapp/src/*"]
    }
  }
}
```

---

## 5. .env.example (в root)

```bash
# ============ SUPABASE ============
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============ MAX SDK ============
NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.example.saldabiz

# ============ EXTERNAL APIs ============
OPTI24_API_KEY=api_key_from_opti24
WIALON_API_TOKEN=token_from_wialon
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# ============ APP CONFIG ============
NEXT_PUBLIC_APP_ENV=development|production
NEXT_PUBLIC_API_URL=http://localhost:3000 (для dev), https://saldabiz.ru (для prod)

# ============ VERCEL (для автодеплоя) ============
VERCEL_TOKEN=vercel_token
```

---

## 6. GitHub Actions: deploy-web.yml

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build:web
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_WEB }}
```

То же для deploy-miniapp.yml (но с путями на `apps/miniapp`).

---

## 7. Инициализация репо

```bash
# 1. Создать репо на GitHub
git clone https://github.com/your-org/saldabiz.git
cd saldabiz

# 2. Инициализировать pnpm monorepo
pnpm init
# Отредактировать package.json (скопировать из п.3 выше)

# 3. Создать структуру
mkdir -p apps/{web,miniapp} packages/{shared-types,ui,api-client,constants}

# 4. Инициализировать Next.js приложения
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --no-git
cd ../miniapp
pnpm create next-app@latest . --typescript --tailwind --no-git
cd ../..

# 5. Установить общие зависимости
pnpm add -D -w typescript @types/node

# 6. Создать пакеты
cd packages/shared-types && pnpm init
cd ../ui && pnpm init
cd ../api-client && pnpm init
cd ../constants && pnpm init

# 7. Установить все зависимости
cd ../..
pnpm install

# 8. Инициализировать Supabase локально (опционально)
npx supabase start

# 9. Запустить оба приложения
pnpm dev
```

---

## 8. Развертывание на Vercel

**Вариант 1: Отдельные Vercel проекты (рекомендуется)**

1. Создать два проекта на Vercel:
   - `saldabiz-web` → deploy из `apps/web`
   - `saldabiz-miniapp` → deploy из `apps/miniapp`

2. В каждом проекте указать:
   - **Root Directory:** `apps/web` (или `apps/miniapp`)
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next`
   - **Environment:** скопировать переменные из `.env.example`

3. Настроить GitHub Actions (см. п.6) — они будут автоматически деплоить при push.

**Вариант 2: Один Vercel с функциями перенаправления**

- Основной деплой: `apps/web`
- Перенаправить `/miniapp/*` → отдельный Next.js SPA (более сложно)

**Рекомендуем Вариант 1** — чистой и независимые деплои.

---

## 9. Локальная разработка

### Запуск

```bash
# Запустить обе приложения
pnpm dev

# Или отдельно
pnpm dev:web       # http://localhost:3000
pnpm dev:miniapp   # http://localhost:3001
```

### IDE Setup (VS Code)

Создать `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.turbo": true
  }
}
```

---

## 10. Деплой на собственный сервер (альтернатива Vercel)

Если нужен собственный сервер (Docker, PM2):

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Копировать всё
COPY . .

# Установить зависимости
RUN pnpm install --frozen-lockfile

# Собрать
RUN pnpm build

# Запустить обе приложения
CMD pnpm dev
```

Для production — использовать `next start` вместо `dev`.

---

## Итого

✅ Монорепо готов к разработке  
✅ Два независимых приложения (web + miniapp)  
✅ Общие пакеты для кода, типов, компонентов  
✅ CI/CD через GitHub Actions + Vercel  
✅ Локальная разработка через `pnpm dev`  

**Следующий файл:** DATABASE.md (полная карта Supabase)
