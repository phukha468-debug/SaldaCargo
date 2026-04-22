# SaldaBiz — Полный Контрольный Центр 🎛️

**Версия:** 1.0 (Project Foundation)  
**Дата:** 22 апреля 2026  
**Статус:** Ready for Development  

---

## 📚 СТРУКТУРА ДОКУМЕНТОВ (Читать в этом порядке)

### 1️⃣ **MONOREPO_STRUCTURE.md** (Архитектура проекта)
**Читай первым** — полная структура папок, конфигов, как запустить.

```
📖 Что содержит:
✅ Структура apps/ (web + miniapp)
✅ Структура packages/ (shared-types, ui, api-client, constants)
✅ Файлы конфигурации (tsconfig, tailwind, next.config)
✅ GitHub Actions (CI/CD)
✅ Как инициализировать репо

⏱️ Время на прочтение: 15 мин
🎯 Результат: понимаешь полную архитектуру
```

**Когда использовать:** При первой инициализации проекта. Следуй пошагово разделу "7. Инициализация репо".

---

### 2️⃣ **DATABASE_MAP.md** (Полная карта Supabase)
**Читай вторым** — все таблицы, поля, отношения, SQL script.

```
📖 Что содержит:
✅ Полный SQL init script (копирование в Supabase SQL Editor)
✅ Диаграмма всех таблиц и отношений
✅ Справочник всех полей (какой тип, constraints)
✅ Как считаются балансы (SQL запросы)
✅ Триггеры и автоматизация

⏱️ Время на прочтение: 30 мин
🎯 Результат: Supabase инициализирована, все таблицы созданы
```

**Когда использовать:** После создания Supabase проекта. Скопируй SQL из раздела 2 в Supabase SQL Editor.

---

### 3️⃣ **ENVIRONMENT_VARS.md** (Переменные окружения)
**Читай третьим** — где взять ключи, как настроить для dev/prod.

```
📖 Что содержит:
✅ Все переменные (.env.example)
✅ Где взять каждую (Supabase, MAX, Opti24 и т.д.)
✅ Как настроить локально (.env.local)
✅ Как настроить в production (Vercel)
✅ GitHub Secrets для CI/CD

⏱️ Время на прочтение: 10 мин
🎯 Результат: все переменные собраны, .env готов
```

**Когда использовать:** Перед `pnpm install` и `pnpm dev`. Скопируй .env.example → .env.local и заполни.

---

### 4️⃣ **ROADMAP.md** (Дорожная карта разработки)
**Читай четвёртым** — что разрабатывать, в каком порядке, сколько времени.

```
📖 Что содержит:
✅ Неделя 0: Подготовка (PREP-01 до PREP-06)
✅ Неделя 1-6: По итерациям (список тасков)
✅ Зависимости между тасками (Gantt диаграмма)
✅ Metrics & Success criteria
✅ Что можно ускорить / отложить

⏱️ Время на прочтение: 20 мин
🎯 Результат: понимаешь полный план до MVP (5-6 недель)
```

**Когда использовать:** Для планирования спринтов. Создавай задачи по порядку из каждой недели.

---

### 5️⃣ **TASK_TEMPLATE.md** (Шаблон задачи для разработчика)
**Читай пятым** — как создавать задачи для Claude Code / Cursor / Gemini.

```
📖 Что содержит:
✅ Шаблон задачи (контекст, действия, верификация)
✅ Реальный пример (W1-03: trips API)
✅ Как использовать шаблон
✅ Где хранить задачи (GitHub Issues, файлы)
✅ Как передать разработчику (CLI, UI)

⏱️ Время на прочтение: 15 мин
🎯 Результат: шаблон копируешь, заполняешь, передаёшь разработчику
```

**Когда использовать:** Для каждого таска из ROADMAP.md. Скопируй шаблон, заполни конкретные детали.

---

## 🚀 QUICKSTART: Как начать разработку?

### День 1: Инициализация

```bash
# 1. Прочитать документы (40 мин)
# - MONOREPO_STRUCTURE.md
# - DATABASE_MAP.md (до раздела 3)
# - ENVIRONMENT_VARS.md

# 2. Создать Supabase проект
# Verить сюда: https://supabase.com → New Project

# 3. Инициализировать GitHub репо
git clone https://github.com/your-org/saldabiz.git
cd saldabiz

# 4. Создать монорепо структуру (из MONOREPO_STRUCTURE.md раздел 7)
pnpm init
# (скопировать package.json из п.3)
mkdir -p apps/{web,miniapp} packages/{shared-types,ui,api-client,constants}

# 5. Инициализировать Next.js
cd apps/web && pnpm create next-app@latest . --typescript --tailwind
cd ../miniapp && pnpm create next-app@latest . --typescript --tailwind

# 6. Инициализировать Supabase
# (из DATABASE_MAP.md раздел 2 → скопировать SQL)
# Открыть Supabase Dashboard → SQL Editor → вставить и выполнить

# 7. Настроить переменные (.env.local)
cp .env.example .env.local
# Заполнить SUPABASE_URL и ключи из Supabase Dashboard

# 8. Запустить оба приложения
pnpm dev
# web: http://localhost:3000
# miniapp: http://localhost:3001

# 9. Проверить
open http://localhost:3000
```

**Время: 2-3 часа**

---

### День 2-3: Неделя 0 (PREP таски)

Выполни таски из ROADMAP.md раздел "Неделя 0":

| Таск | Что делать | Время |
|------|-----------|-------|
| PREP-01 | Supabase уже создан ✓ | — |
| PREP-02 | Подключить GitHub Actions (см. MONOREPO_STRUCTURE.md п.6) | 1ч |
| PREP-03 | Структура уже создана ✓ | — |
| PREP-04 | Next.js уже создано ✓ | — |
| PREP-05 | Tailwind + tsconfig.base.json (копировать из MONOREPO_STRUCTURE.md) | 30мин |
| PREP-06 | Экспортировать типы: `supabase gen types typescript` | 15мин |

---

### День 4-10: Неделя 1 (W1 таски)

Начни с W1-01 и дальше по порядку.

**Для каждого таска:**

1. Открыть TASK_TEMPLATE.md
2. Скопировать шаблон
3. Заполнить конкретные детали (из ROADMAP.md + DATABASE_MAP.md)
4. Передать разработчику (Claude Code / Cursor)
5. Когда готово → проверить верификацию → merge PR

**Пример создания первого таска:**

```markdown
# W1-01: Настроить Supabase Auth + MAX OAuth

(скопировать шаблон из TASK_TEMPLATE.md)

## 📌 Контекст
Водитель должен войти через MAX мессенджер. 
Это первая точка входа для всех пользователей.

## 🎯 Что делать
1. Создать /api/auth/max/route.ts с GET handler
2. Интегрировать MAX SDK
3. ...
```

Сохрани это в `tasks/todo/W1-01_auth_max.md` и передай разработчику.

---

## 📊 СТРУКТУРА ФАЙЛОВ В ПРОЕКТЕ

Когда разработка начнётся, структура будет выглядеть так:

```
saldabiz/
├── 📄 MONOREPO_STRUCTURE.md       ← Архитектура (твой новый файл)
├── 📄 DATABASE_MAP.md               ← Карта БД (твой новый файл)
├── 📄 ENVIRONMENT_VARS.md           ← Переменные (твой новый файл)
├── 📄 ROADMAP.md                    ← Дорожная карта (твой новый файл)
├── 📄 TASK_TEMPLATE.md              ← Шаблон задачи (твой новый файл)
│
├── 📄 SaldaBiz_Architecture_v2_3.md    ← Архитектура системы (исходный)
├── 📄 SaldaBiz_DB_Schema_FlowMap_v2.md ← Схема БД (исходный)
├── 📄 SaldaBiz_Seed_Data.md            ← Данные (исходный)
│
├── docs/                          ← Документация разработчика
│   ├── BOOT.md                    ← Как запустить dev
│   ├── API.md                     ← Спека всех endpoint'ов
│   ├── OFFLINE_SYNC.md            ← Offline-first механика
│   └── TESTING.md                 ← Как тестировать
│
├── tasks/
│   ├── todo/
│   │   ├── W1-01_auth_max.md
│   │   ├── W1-02_ui_components.md
│   │   └── ...
│   ├── in_progress/
│   │   └── (текущие таски)
│   └── done/
│       └── (выполненные таски)
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── package.json
│   │   └── ...
│   └── miniapp/
│       ├── app/
│       ├── components/
│       ├── package.json
│       └── ...
│
├── packages/
│   ├── shared-types/
│   ├── ui/
│   ├── api-client/
│   └── constants/
│
├── scripts/
│   ├── setup-db.ts
│   ├── seed-db.ts
│   └── export-types.sh
│
├── .env.example                   ← Шаблон переменных
├── .env.local                     ← Локальные переменные (git ignored)
├── .env.production                ← Production (Vercel secrets)
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── README.md
└── .gitignore
```

---

## 🔑 КЛЮЧЕВЫЕ МОМЕНТЫ (Не забыть!)

### 1. Двухосный статус (КРИТИЧНО!)

Каждая транзакция имеет ДВА статуса:
- `lifecycle_status`: draft → approved → cancelled (ОН утвердил)
- `settlement_status`: pending → completed (деньги прошли)

Это отличает SaldaBiz от других систем. Всегда это помни!

```sql
-- Балансы считаются ТОЛЬКО по approved + completed
SELECT SUM(amount) 
FROM transactions
WHERE lifecycle_status = 'approved' AND settlement_status = 'completed';
```

### 2. ЗП — ручной ввод

ЗП водителя вводится ВРУЧНУЮ (поле `driver_pay` в `trip_orders`).
Система только ПОДСКАЗЫВАЕТ (30% серым текстом).
Никаких автоматических расчётов!

### 3. Монорепо — два приложения

`apps/web` и `apps/miniapp` — это ОТДЕЛЬНЫЕ приложения.
Они живут в одном репо, но деплоятся независимо.
- web → Vercel (Main domain)
- miniapp → Vercel (для MAX SDK)

### 4. RLS на месте

Row Level Security в Supabase — это SECURITY, не опция.
- Водитель видит только свои рейсы
- Админ видит всё
- Механик видит только свои заказ-наряды

### 5. Нет Prisma

Используем Supabase JS Client напрямую.
- Почему: RLS политики работают на уровне БД
- Prisma усложнит

---

## 🎯 МЕТРИКИ УСПЕХА

После выполнения каждой недели проверь:

| Неделя | Метрика | Goal | Как проверить |
|--------|---------|------|-------------|
| **W0** | Суpabase ready | ✅ | `SELECT COUNT(*) FROM trips;` → 0 |
| **W1** | Можно создать рейс | ✅ | POST /api/trips → 201 Created |
| **W2** | Карта денег работает | ✅ | Dashboard → Money Map → балансы |
| **W3** | ЗП рассчитается | ✅ | Dashboard → Payroll → месяц август ✓ |
| **W4** | Опти24 синхронизируется | ✅ | Dashboard → [🔄 Sync Opti24] → ✓ |
| **W5** | Offline работает | ✅ | Выключить интернет → add order → включить → sync ✓ |
| **W6** | Всё работает вместе | ✅ | Сквозной рейс от водителя до финансов |

---

## 🆘 Если что-то не ясно

| Вопрос | Ответ | Файл |
|--------|-------|------|
| Как структурирован проект? | Монорепо с apps + packages | MONOREPO_STRUCTURE.md |
| Какие таблицы в БД? | Все в SQL скрипте | DATABASE_MAP.md раздел 2 |
| Где взять ключи Supabase? | Settings → API | ENVIRONMENT_VARS.md |
| Что разрабатывать сначала? | PREP-01 до PREP-06 | ROADMAP.md раздел 0 |
| Как создать задачу? | Скопировать шаблон и заполнить | TASK_TEMPLATE.md |
| Как деплоить? | GitHub Actions + Vercel | MONOREPO_STRUCTURE.md п.6 |
| Как настроить RLS? | Примеры в DATABASE_MAP.md | DATABASE_MAP.md раздел 11 |
| Как работает offline-first? | IndexedDB + sync при интернете | ROADMAP.md W5 |

---

## ✅ ЧЕКЛИСТ: Готов ли я начинать разработку?

- [ ] Прочитал MONOREPO_STRUCTURE.md
- [ ] Прочитал DATABASE_MAP.md (до раздела 3)
- [ ] Прочитал ENVIRONMENT_VARS.md
- [ ] Создан Supabase проект
- [ ] GitHub репо инициализирован
- [ ] .env.local заполнен
- [ ] Оба приложения (web + miniapp) запускаются (`pnpm dev`)
- [ ] Supabase SQL script выполнен успешно
- [ ] Все таблицы видны в Supabase Dashboard
- [ ] Прочитал ROADMAP.md
- [ ] Первый таск (PREP-02 или W1-01) готовится к выполнению

**Если все отмечено** — готов начинать! 🚀

---

## 📞 КОНТАКТЫ & ПОДДЕРЖКА

### При проблемах с разработкой:
- 🐛 GitHub Issues → описать проблему
- 💬 Slack / Telegram → быстрое уточнение
- 📧 Email → архитектурные вопросы

### Кто ответит:
- **Архитектуру**: Я (автор документов)
- **TypeScript вопросы**: Claude Code (AI)
- **React вопросы**: Cursor (AI)
- **SQL вопросы**: Supabase docs + DATABASE_MAP.md

---

## 🎓 ДОПОЛНИТЕЛЬНОЕ ОБУЧЕНИЕ

Если нужно углубиться:

| Тема | Источник | Время |
|------|----------|-------|
| Next.js 15 App Router | https://nextjs.org/docs | 2ч |
| Supabase с RLS | https://supabase.com/docs/guides/auth/row-level-security | 1ч |
| Tailwind CSS | https://tailwindcss.com/docs | 1ч |
| React Query (TanStack) | https://tanstack.com/query/latest | 1ч |
| TypeScript strict mode | https://www.typescriptlang.org/docs/handbook/ | 2ч |
| PostgreSQL basics | https://www.postgresql.org/docs/ | 3ч |

---

## 📝 ИСТОРИЯ ВЕРСИЙ

| Версия | Дата | Что изменилось |
|--------|------|---------|
| 1.0 | 22.04.2026 | Первая версия: MONOREPO, DATABASE, ENV, ROADMAP, TASK_TEMPLATE |
| 1.1 | _pending_ | (после первого спринта) |

---

## 🎉 ИТОГО

**У тебя есть:**
✅ Полная архитектура (MONOREPO_STRUCTURE.md)  
✅ Полная схема БД (DATABASE_MAP.md + SQL)  
✅ Все переменные окружения (ENVIRONMENT_VARS.md)  
✅ Дорожная карта на 5-6 недель (ROADMAP.md)  
✅ Шаблон для создания задач (TASK_TEMPLATE.md)  
✅ Этот контрольный центр (этот файл)  

**Готово к разработке!** 🚀

Начни с **День 1: Инициализация** выше.
При вопросах — читай нужный документ из списка в начале.

---

**P.S.** Все документы находятся в `/mnt/project/`:
- MONOREPO_STRUCTURE.md
- DATABASE_MAP.md
- ENVIRONMENT_VARS.md
- ROADMAP.md
- TASK_TEMPLATE.md
- INDEX.md (этот файл)

Плюс исходные документы проекта:
- SaldaBiz_Architecture_v2_3.md
- SaldaBiz_DB_Schema_FlowMap_v2.md
- SaldaBiz_Seed_Data.md

Enjoy! 🎯
