<!-- BOOT: Перед выполнением прочитай docs/BOOT.md -->

<context>
Монорепо создано (таск 001). Папка docs/ существует, но файлы BRIEF.md, RULES.md,
ENVIRONMENT.md и impeccable.md содержат пустые шаблоны с плейсхолдерами [заполнить].
Нужно заполнить их реальными данными проекта SaldaCargo.
BOOT.md и LESSONS.md уже корректны — не трогать.

ЗАВИСИМОСТИ: 001_init_monorepo
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ:
  - docs/BRIEF.md
  - docs/RULES.md
  - docs/ENVIRONMENT.md
  - docs/impeccable.md
  - tasks/todo/.gitkeep (создать если нет)
  - tasks/done/.gitkeep (создать если нет)
ТИП: feat
</context>

<task>
1. Заменить содержимое docs/BRIEF.md на:

```markdown
# SaldaCargo — Паспорт проекта

**Продукт:** Система управления транспортным бизнесом
**Платформа:** Mini App в мессенджере MAX + Web Dashboard
**Стек:** Next.js 15 + Supabase (PostgreSQL) + Vercel (Hobby)
**Цель:** Оцифровка мульти-направленного бизнеса, выход на чистую прибыль 1 500 000 руб./мес.

---

## 1. Суть проекта

SaldaCargo — система учёта транспортного бизнеса для ИП Нигамедьянов А.С. (г. Верхняя Салда).
Заменяет бумажные путевые листы и Excel. Водители вводят данные рейсов через Mini App в MAX,
владелец и администратор видят финансовую картину в реальном времени через Web Dashboard.

## 2. Целевая аудитория

- **Владелец (owner):** Нигамедьянов А.С. — видит всё, принимает стратегические решения
- **Администратор (admin):** ежедневное ревью смен, подтверждение транзакций
- **Водители (driver):** ввод данных рейса через Mini App, видят только своё
- **Грузчики (loader):** только просмотр своей ЗП

Уровень: базовый — пользуются телефоном и мессенджерами, не более.

## 3. Ключевые функции (Scope MVP)

1. Путевые листы: рейсы, заказы, ЗП (ввод вручную по каждому заказу)
2. Финансовая карта (кошельки, балансы, P&L по направлениям)
3. Ревью смен (подтверждение admin, двухосный статус)
4. Автопарк (амортизация, алерты ТО по пробегу)
5. Опти24 (ручная синхронизация топливных карт кнопкой)
6. Подотчёты водителей (деньги на руках)
7. Дебиторка / кредиторка

## 4. Что НЕ входит в MVP (Out of Scope)

- СТО (следующая фаза)
- Магазин запчастей (следующая фаза)
- Wialon автосинхронизация (следующая фаза, сейчас только при закрытии рейса)
- Банковская выписка API (MVP: ручной импорт CSV)
- Сыпучие материалы, платная стоянка (заморожено)

## 5. Технологический стек

| Компонент | Технология | Роль |
|-----------|-----------|------|
| Язык | TypeScript (strict) | Весь проект |
| Фреймворк | Next.js 15 App Router | apps/web + apps/miniapp |
| База данных | Supabase PostgreSQL + RLS | Хранение данных |
| Auth | Supabase Auth + MAX OAuth | Аутентификация |
| Стилизация | Tailwind CSS + shadcn/ui | UI компоненты |
| Графики | Tremor / Recharts | Аналитика |
| Формы | react-hook-form + zod | Ввод данных |
| Запросы | TanStack Query | Кэш и синхронизация |
| Хостинг | Vercel (Hobby) | Деплой обоих приложений |
| Мониторинг | Sentry (Free) | Отслеживание ошибок |
| Фоновые задачи | pg_cron (Supabase) | Амортизация, синхронизация |

## 6. Структура данных (основные сущности)

| Сущность | Основные поля | Связи |
|----------|--------------|-------|
| users | full_name, role, phone | → assets (закреплённая машина), → wallets |
| assets | plate_number, type, odometer, residual_value | → trips, → asset_types |
| trips | driver_id, asset_id, started_at, lifecycle_status | → trip_orders, → trip_expenses |
| trip_orders | amount, driver_pay, loader_pay, payment_method | → trips, → transactions |
| transactions | direction, amount, from_wallet, to_wallet, lifecycle_status | → wallets, → categories |
| wallets | code, type, owner_user_id | → transactions |

## 7. Текущий статус

### Завершено:
- [x] БД инициализирована (22 таблицы, RLS, pg_cron, seed data)
- [x] Монорепо создано (apps/web + apps/miniapp + packages)
- [x] docs/ заполнены

### В работе:
- [ ] Supabase клиент подключён (003)

### Следующие шаги:
- [ ] Setup Wizard (004)
- [ ] Главная страница / Money Map (005)
- [ ] Mini App водителя — рейсы (006)
- [ ] Ревью смены в Dashboard (007)

---

*Последнее обновление: 22.04.2026*
```

2. Заменить содержимое docs/RULES.md на:

```markdown
# SaldaCargo — Правила разработки v4.1

> Программист ОБЯЗАН прочитать этот файл перед каждой задачей.

---

## 1. Роли

| Роль | Кто | Обязанности |
|------|-----|-------------|
| **Заказчик** | Human | Формулирует задачи, принимает решения. НЕ пишет код. |
| **Архитектор** | Claude (claude.ai) | Проектирует решения, создаёт таски. НЕ пишет код. |
| **Программист** | Gemini CLI | Выполняет таски строго по заданию. |

---

## 2. Технологический стек (строго)

| Компонент | Технология | Запрещено |
|-----------|-----------|-----------|
| БД | Supabase PostgreSQL + RLS | Prisma, любой другой ORM |
| Auth | Supabase Auth | NextAuth, Clerk, Auth0 |
| Client | @supabase/supabase-js + @supabase/ssr | @supabase/auth-helpers (устарел) |
| Frontend | Next.js 15 App Router + React 19 | Pages Router |
| Стили | Tailwind CSS + shadcn/ui | Material UI, Chakra, Ant Design |
| Графики | Tremor или Recharts | — |
| Формы | react-hook-form + zod | Formik, yup |
| Запросы | TanStack Query | SWR, Apollo |
| Пакет-менеджер | pnpm | npm, yarn |
| Деплой | Vercel Hobby | — |

---

## 3. Именование

- Package names: @saldacargo/*
- Таблицы БД: snake_case, множественное число (transactions, trip_orders)
- Поля БД: snake_case (created_at, asset_id)
- Компоненты React: PascalCase (TripCard, MoneyMap)
- Файлы: kebab-case (trip-card.tsx, money-map.tsx)
- API роуты: /api/trips, /api/transactions/:id/approve
- Язык UI: русский (кнопки, лейблы, сообщения об ошибках)

---

## 4. Финансовые данные (критично)

- Все суммы в БД: DECIMAL(12,2) — НИКОГДА float
- Балансы кошельков = ВСЕГДА вычисляемые из transactions (не хранимые)
- Считать балансы ТОЛЬКО по lifecycle_status='approved' AND settlement_status='completed'

---

## 5. Двухосный статус транзакций

Каждая транзакция имеет ДВА независимых статуса:
1. lifecycle_status: draft → approved → cancelled (кто утвердил)
2. settlement_status: pending → completed (прошли ли деньги)

- Сотрудники создают ТОЛЬКО draft
- Внешние API (Опти24) создают сразу approved
- P&L и балансы считаются ТОЛЬКО по approved + completed

---

## 6. Supabase — правила работы

| Клиент | Ключ | Где использовать |
|--------|------|-----------------|
| client.ts | ANON_KEY | Client Components (RLS ограничивает) |
| server.ts | ANON_KEY | Server Components, Route Handlers |
| admin.ts | SERVICE_ROLE_KEY | Только API Routes на сервере — НИКОГДА в браузер! |

---

## 7. Строгие табу

🚫 **СЕКРЕТЫ В КОДЕ** — только .env, никогда хардкод
🚫 **CONSOLE.LOG** — нет в production коде
🚫 **ЗАКОММЕНТИРОВАННЫЙ КОД** — удалять, не комментировать
🚫 **DELETE ИЗ БД** — только soft delete (status='cancelled' + reason)
🚫 **FLOAT ДЛЯ ДЕНЕГ** — только DECIMAL(12,2)
🚫 **ХРАНИТЬ БАЛАНС** — только вычислять из транзакций
🚫 **ASYNC БЕЗ TRY/CATCH** — каждый async-вызов в try/catch с console.error
🚫 **НАВИГАЦИЯ ДО AWAIT** — router.push() только после подтверждения записи в БД
🚫 **ВЫХОД ЗА РАМКИ ЗАДАЧИ** — только файлы из таска
🚫 **НЕСКОЛЬКО ЗАДАЧ** — один таск за раз
🚫 **AI-СЛОП В UI** — фиолетовые градиенты, glassmorphism, карточки в карточках

---

## 8. Протокол завершения задачи

1. ✅ Код работает без ошибок
2. ✅ Выполнены ВСЕ шаги верификации из таска
3. 📋 COMPLETION LOG заполнен в конце файла задачи
4. 📁 Файл перемещён из tasks/todo/ в tasks/done/
5. 📝 Статус обновлён в docs/BRIEF.md

---

## 9. Протокол при ошибке

1. НЕ чинить архитектуру самостоятельно
2. Описать проблему: что пытался, какая ошибка, почему не получается
3. Оставить задачу в tasks/todo/
4. Дождаться Заказчика

---

*Последнее обновление: 22.04.2026 | VibeCraft v4.1*
```

3. Заменить содержимое docs/ENVIRONMENT.md на:

```markdown
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

## 5. База данных

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
```

4. Заменить содержимое docs/impeccable.md на:

```markdown
# SaldaCargo — Design Context (Impeccable)

---

## Target Audience

- **Primary users:** Владелец транспортного бизнеса + администратор, 35-55 лет, Верхняя Салда
- **Context of use:** Dashboard — Desktop ежедневно утром; Mini App — мобильный в течение рабочего дня, часто в кабине грузовика
- **Tech comfort level:** Базовый — телефон, мессенджеры, ничего сложнее

## Brand Personality

- **Tone:** Деловой и чёткий. Как хороший прораб — говорит по делу, без воды.
- **Values:** Контроль, прозрачность, скорость принятия решений
- **If this brand were a person:** Опытный логист. Знает каждую машину и каждый рубль. Не терпит неопределённости.

## Aesthetic Direction

- **Style:** Промышленный минимализм. Функция важнее формы. Данные на первом плане.
- **Color mood:** Тёмно-синий (#1e3a5f) + белый/светло-серый фон + янтарный (#f59e0b) для алертов и акцентов. Красный (#ef4444) только для критических ошибок.
- **Typography feel:** Чёткий технический sans-serif (Geist или Inter). Цифры крупные и читаемые с первого взгляда.
- **Avoid:** Пастельные цвета, скруглённые «милые» формы, градиенты ради красоты, анимации ради анимаций

## Design Constraints

- **Framework:** Next.js 15 + Tailwind CSS + shadcn/ui
- **Must support:** Русский язык, Mobile-first для Mini App, Desktop-first для Dashboard
- **Accessibility:** Крупные touch-targets минимум 44px (водители в перчатках), высокий контраст
- **Performance:** Быстрая загрузка — водители открывают Mini App в поле со слабым 4G

## Reference Points

- **Like this:** Linear.app (плотность данных + чистота), Stripe Dashboard (финансовые таблицы), Revolut Business (карта денег)
- **NOT like this:** Детские SaaS-шаблоны с иллюстрациями, стартап-лендинги, Dribbble-bait дизайн

## Anti-Patterns (DO NOT generate)

- ❌ "AI palette": cyan-on-dark, purple-to-blue градиенты, неоновые акценты
- ❌ Серый текст на цветном фоне
- ❌ Чисто чёрный (#000) или чисто белый (#fff) — добавляй тинт
- ❌ Карточки внутри карточек внутри карточек
- ❌ Glassmorphism без функции
- ❌ Огромные hero-цифры с крошечными подписями
- ❌ Декоративные градиенты без информации
- ❌ Скелетон-анимации на каждом элементе
- ❌ Иконки вместо текста в таблицах (данные должны читаться быстро)

---

*SaldaCargo Design Context | Обновлено: 22.04.2026*
```

5. Создать папки для задач если их нет:
   mkdir -p tasks/todo tasks/done
   touch tasks/todo/.gitkeep tasks/done/.gitkeep

6. Закоммитить:
   git add docs/ tasks/
   git commit -m "docs: fill in BRIEF, RULES, ENVIRONMENT, impeccable for SaldaCargo"
   git push origin main

7. ВЕРИФИКАЦИЯ:
   Открыть https://github.com/phukha468-debug/SaldaCargo/tree/main/docs
   - [ ] docs/BRIEF.md — нет слова "[заполнить]", есть "SaldaCargo"
   - [ ] docs/RULES.md — нет слова "[заполнить]", есть "@saldacargo/*"
   - [ ] docs/ENVIRONMENT.md — нет слова "[заполнить]", есть структура монорепо
   - [ ] docs/impeccable.md — нет плейсхолдеров [e.g., ...], есть реальные данные
   - [ ] Папки tasks/todo/ и tasks/done/ существуют

8. Заполнить COMPLETION LOG.
9. Перенести этот файл из tasks/todo/ в tasks/done/.
</task>

<rules>
- docs/BOOT.md и docs/LESSONS.md — НЕ ТРОГАТЬ, они уже корректны
- Название проекта везде: SaldaCargo (не SaldaBiz, не [НАЗВАНИЕ ПРОЕКТА])
- Package names: @saldacargo/* (не @saldabiz/*)
- НЕ трогать файлы приложений (apps/) — только docs/ и tasks/
- ПРОТОКОЛ ОШИБКИ: Если push упадёт с конфликтом — описать и ждать Архитектора.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:** 
- Заполнено содержимое docs/BRIEF.md (паспорт проекта SaldaCargo).
- Заполнено содержимое docs/RULES.md (правила разработки v4.1).
- Заполнено содержимое docs/ENVIRONMENT.md (среда разработки).
- Заполнено содержимое docs/impeccable.md (дизайн-контекст).
- Созданы папки и .gitkeep в tasks/todo и tasks/done.
- Изменения закоммичены в Git.
**Результат верификации:** [x] Успешно. Все документы заполнены актуальными данными SaldaCargo без плейсхолдеров.