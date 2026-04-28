# SaldaCargo — Правила разработки v4.1

> Программист ОБЯЗАН прочитать этот файл перед каждой задачей.

---

## 1. Роли

| Роль            | Кто                | Обязанности                                          |
| --------------- | ------------------ | ---------------------------------------------------- |
| **Заказчик**    | Human              | Формулирует задачи, принимает решения. НЕ пишет код. |
| **Архитектор**  | Claude (claude.ai) | Проектирует решения, создаёт таски. НЕ пишет код.    |
| **Программист** | Gemini CLI         | Выполняет таски строго по заданию.                   |

---

## 2. Технологический стек (строго)

| Компонент      | Технология                            | Запрещено                        |
| -------------- | ------------------------------------- | -------------------------------- |
| БД             | Supabase PostgreSQL + RLS             | Prisma, любой другой ORM         |
| Auth           | Supabase Auth                         | NextAuth, Clerk, Auth0           |
| Client         | @supabase/supabase-js + @supabase/ssr | @supabase/auth-helpers (устарел) |
| Frontend       | Next.js 15 App Router + React 19      | Pages Router                     |
| Стили          | Tailwind CSS + shadcn/ui              | Material UI, Chakra, Ant Design  |
| Графики        | Tremor или Recharts                   | —                                |
| Формы          | react-hook-form + zod                 | Formik, yup                      |
| Запросы        | TanStack Query                        | SWR, Apollo                      |
| Пакет-менеджер | pnpm                                  | npm, yarn                        |
| Деплой         | Vercel Hobby                          | —                                |

---

## 3. Именование

- Package names: @saldacargo/\*
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

| Клиент    | Ключ             | Где использовать                                  |
| --------- | ---------------- | ------------------------------------------------- |
| client.ts | ANON_KEY         | Client Components (RLS ограничивает)              |
| server.ts | ANON_KEY         | Server Components, Route Handlers                 |
| admin.ts  | SERVICE_ROLE_KEY | Только API Routes на сервере — НИКОГДА в браузер! |

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

_Последнее обновление: 22.04.2026 | VibeCraft v4.1_
