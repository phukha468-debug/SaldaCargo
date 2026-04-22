# SaldaBiz — Переменные Окружения

**Файлы конфигурации:**
- `.env.local` — локальная разработка (`.gitignore`)
- `.env.production` — production на Vercel
- `.env.example` — шаблон (в repo)

---

## 1. .env.example (Шаблон)

```bash
# ============================================================
# SUPABASE (Database & Auth)
# ============================================================

# NEXT_PUBLIC_* = видны в браузере (публичные)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Только на сервере
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================================
# MAX SDK (Mini App)
# ============================================================

NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.saldabiz.miniapp

# ============================================================
# EXTERNAL APIs
# ============================================================

# Опти24 (топливные карты)
OPTI24_API_KEY=sk_live_xxxxx

# Wialon (GPS машин)
WIALON_API_TOKEN=xxxxx

# Sentry (error tracking)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# ============================================================
# APP CONFIGURATION
# ============================================================

# Окружение
NEXT_PUBLIC_APP_ENV=development  # development | staging | production

# API URL (для API Routes внутри приложения)
NEXT_PUBLIC_API_URL=http://localhost:3000  # для dev
# https://saldabiz.ru  для prod

# ============================================================
# VERCEL (CI/CD, не трогать если деплоим через GitHub Actions)
# ============================================================

VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID_WEB=xxxxx
VERCEL_PROJECT_ID_MINIAPP=xxxxx

# ============================================================
# NEXT.JS
# ============================================================

NODE_ENV=development  # development | production
NEXT_PUBLIC_VERSION=1.0.0
```

---

## 2. Переменные — Подробно

### SUPABASE

| Переменная | Где взять | Где использовать | Публичная? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Везде (client + server) | ✅ Да |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon | Везде (client + server) | ✅ Да |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role | Только server (API Routes) | ❌ Нет |

**Как получить:**

1. Зайти на supabase.com → вход
2. Выбрать проект saldabiz
3. Project Settings (gear icon) → API
4. Скопировать URLs и ключи

**Правила:**
- `ANON_KEY` = для обычных клиентов (RLS их ограничивает)
- `SERVICE_ROLE_KEY` = для админских операций (обходит RLS, **никогда** в браузер!)

---

### MAX SDK

| Переменная | Значение | Где взять | Примечание |
|---|---|---|---|
| `NEXT_PUBLIC_MAX_BOT_TOKEN` | 123456789:ABCDEFGH... | MAX Developer Console | Token бота |
| `NEXT_PUBLIC_MAX_APP_ID` | com.saldabiz.miniapp | MAX Developer Console | ID приложения |

**Правила:**
- Оба `NEXT_PUBLIC_*` — видны в браузере (это нормально для MAX)
- Использовать для инициализации MAX SDK в Mini App

---

### External APIs

| Переменная | Сервис | Как получить | Для чего |
|---|---|---|---|
| `OPTI24_API_KEY` | Опти24 | Личный кабинет Опти24 → Управление → API | Синхронизация топливных карт |
| `WIALON_API_TOKEN` | Wialon | Wialon.com → Управление → API | Получение GPS данных |
| `SENTRY_DSN` | Sentry | sentry.io → Project Settings | Отслеживание ошибок |

---

### App Configuration

| Переменная | Значения | Когда менять |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development` \| `staging` \| `production` | При деплое на разные окружения |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` (dev) <br> `https://saldabiz.ru` (prod) | В Vercel secrets для prod |
| `NEXT_PUBLIC_VERSION` | `1.0.0` | При каждом релизе |

---

## 3. .env.local (Локальная разработка)

Копировать из `.env.example`, заполнить своими значениями:

```bash
# Локальный Supabase (если используешь `supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MAX (можно оставить как в примере, или leave empty если не тестируешь)
NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.saldabiz.miniapp

# API (локально)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development

# Опти24, Wialon (в разработке можно оставить пустыми или use mocks)
OPTI24_API_KEY=
WIALON_API_TOKEN=
SENTRY_DSN=
```

**⚠️ ВАЖНО:** `.env.local` не коммитить в git. Добавлено в `.gitignore`.

---

## 4. .env.production (Production на Vercel)

**Заполняется в Vercel Dashboard:**

Settings → Environment Variables

| Ключ | Значение | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prodction ключ из Supabase | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Prodction key из Supabase | Production (не видна в браузере) |
| `NEXT_PUBLIC_MAX_BOT_TOKEN` | Production токен | Production |
| `NEXT_PUBLIC_MAX_APP_ID` | Production app ID | Production |
| `OPTI24_API_KEY` | Production ключ | Production |
| `WIALON_API_TOKEN` | Production токен | Production |
| `SENTRY_DSN` | Production DSN | Production |
| `NEXT_PUBLIC_APP_ENV` | `production` | Production |
| `NEXT_PUBLIC_API_URL` | `https://saldabiz.ru` | Production |

**Процесс:**

1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add New → ввести ключ и значение → Select Environment: Production
3. Сохранить
4. Редеплой (он произойдёт автоматически или нужна кнопка Redeploy)

---

## 5. Разные переменные для apps/web и apps/miniapp

Если нужно разные значения:

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_API_URL=https://saldabiz.ru/api
```

**apps/miniapp/.env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_MAX_BOT_TOKEN=...
```

Каждое приложение читает свой `.env.local`.

---

## 6. Доступ к переменным в коде

### Client-side (браузер)

```tsx
// ✅ Работает: NEXT_PUBLIC_*
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ❌ НЕ работает: переменные без NEXT_PUBLIC_
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // undefined в браузере!
```

### Server-side (API Routes, Server Components)

```ts
// ✅ Работает: все переменные
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ доступна

// ✅ Работает: и NEXT_PUBLIC_*
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; // ✅ доступна
```

### TypeScript

Для автодополнения типов, создать `env.d.ts`:

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXT_PUBLIC_MAX_BOT_TOKEN: string;
    OPTI24_API_KEY: string;
    WIALON_API_TOKEN: string;
    SENTRY_DSN: string;
    NEXT_PUBLIC_APP_ENV: 'development' | 'staging' | 'production';
    NEXT_PUBLIC_API_URL: string;
  }
}
```

---

## 7. Секреты в Vercel (GitHub Actions)

Если используешь GitHub Actions для деплоя:

**.github/workflows/deploy-web.yml:**

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL_PROD }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_PROD }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_PROD }}
```

Добавить секреты в GitHub:

1. Repo → Settings → Secrets and variables → Actions
2. New repository secret
3. Добавить: `SUPABASE_URL_PROD`, `SUPABASE_ANON_KEY_PROD` и т.д.

---

## 8. Fallbacks & Defaults

Если переменная не установлена, использовать defaults:

```ts
// packages/api-client/src/supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-anon-key';
```

---

## 9. Checklist: как настроить окружение

### Локальная разработка

- [ ] Создать Supabase проект
- [ ] Скопировать `.env.example` → `.env.local`
- [ ] Заполнить `NEXT_PUBLIC_SUPABASE_URL` и ключи из Supabase
- [ ] `pnpm install`
- [ ] `pnpm db:setup` (инициализировать БД)
- [ ] `pnpm dev`

### Production (Vercel)

- [ ] Создать проекты в Vercel для `apps/web` и `apps/miniapp`
- [ ] Добавить Environment Variables в Vercel (Settings → Environment Variables)
- [ ] Получить production ключи Supabase
- [ ] Добавить GitHub integration
- [ ] Push в main → автоматический деплой

### Production (собственный сервер)

- [ ] Создать `.env.production` с production значениями
- [ ] Заполнить все переменные
- [ ] `pnpm build`
- [ ] Запустить `next start` или через Docker

---

## 10. Пример конкретных значений для MVP

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAwMDAwMDAsImV4cCI6MTk5OTk5OTk5OX0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXX
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4MDAwMDAwMCwiZXhwIjoxOTk5OTk5OTk5fQ.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyYYY

# MAX (example)
NEXT_PUBLIC_MAX_BOT_TOKEN=987654321:ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqp
NEXT_PUBLIC_MAX_APP_ID=com.saldabiz.miniapp

# APIs
OPTI24_API_KEY=sk_live_abc123def456ghi789
WIALON_API_TOKEN=wialon_token_xyz123
SENTRY_DSN=https://publickey@o1234567.ingest.sentry.io/1234567

# App
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_VERSION=1.0.0

# Node
NODE_ENV=development
```

---

## Итого

✅ **Все переменные документированы**  
✅ **Знаешь где взять каждую**  
✅ **Знаешь как настроить для dev/prod**  
✅ **Security: service_role_key не выходит в браузер**  

**Следующий файл:** ROADMAP.md (дорожная карта разработки)
