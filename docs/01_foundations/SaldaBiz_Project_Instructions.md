# SaldaBiz — Инструкции для проекта

## Что это за проект
Система управления транспортным бизнесом в г. Верхняя Салда: Mini App (MAX) + Web Dashboard. Стек: Next.js 15, Supabase (PostgreSQL), Vercel. Разработчик один (фулстек), использует AI-кодинг.

## Правила при написании кода

### Стек и инструменты
- Frontend: Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS, shadcn/ui, Tremor (графики)
- Backend: Next.js API Routes (Route Handlers), Supabase JS Client
- БД: Supabase PostgreSQL с Row Level Security
- Storage: Supabase Storage (фото одометров, чеки)
- Auth: Supabase Auth + MAX OAuth
- Mini App: Next.js SPA + MAX Mini App SDK
- Деплой: Vercel (Hobby)

### Архитектура
- Монорепо: apps/web (дашборд), apps/miniapp (Mini App для MAX)
- Общие пакеты: packages/shared-types, packages/ui
- Вся бизнес-логика на бэкенде (API Routes). Фронт — тупой клиент.
- Балансы кошельков ВСЕГДА вычисляемые из транзакций, никогда не хранимые.

### Двухосный статус (критически важно)
Каждая транзакция имеет ДВА независимых статуса:
1. lifecycle_status: draft → approved → cancelled (кто утвердил)
2. settlement_status: pending → completed (прошли ли деньги)

Сотрудники создают ТОЛЬКО draft. Внешние API (Опти24, банк) создают сразу approved. Балансы и P&L считаются ТОЛЬКО по approved + completed.

### ЗП водителей
ЗП вводится ВРУЧНУЮ по каждому заказу (поле driver_pay в trip_orders). Система только ПОДСКАЗЫВАЕТ расчётную цифру (30% серым текстом). Формулы не пересчитывают автоматически. Итого ЗП = SUM по всем trip_orders за период.

### Именование
- Таблицы: snake_case, мн. число (transactions, trip_orders)
- Поля: snake_case (created_at, asset_id)
- API: /api/trips, /api/transactions/:id/approve
- Компоненты React: PascalCase (TripCard, MoneyMap)
- Всегда created_at, updated_at в каждой таблице
- Soft delete (cancelled + reason), никогда не DELETE

### Безопасность
- Все финансовые суммы: DECIMAL(12,2), никогда float
- Идемпотентность: idempotency_key на всех мутациях от клиента
- RLS в Supabase: водитель видит только своё
- Все изменения транзакций → audit_log

### При генерации кода
- Используй Supabase JS Client (@supabase/supabase-js), не Prisma
- Для типов — генерируй из Supabase CLI (supabase gen types)
- Компоненты UI — shadcn/ui, не Material UI
- Графики — Tremor или Recharts
- Формы — react-hook-form + zod
- Запросы — TanStack Query (@tanstack/react-query)
- Всегда обрабатывай ошибки и loading states
- Пиши на русском в UI (кнопки, лейблы, сообщения)

## Контекст бизнеса
- Город: Верхняя Салда (40к населения, моногород ВСМПО-АВИСМА)
- Парк: 4 Валдая, 6 Газелей, 1 Митсубиси Кантер 5т, 1 Газель-проект
- Водители: 11 человек (включая Владельца на Кантере временно)
- Механики: Ваня (хороший, лишён прав), Вадик (ненадёжный, спец по КПП)
- Юрлицо: ИП Нигамедьянов А.С. (патент), планируется ООО
- Топливо: Опти24 (API, ручная синхронизация на MVP)
- GPS: Wialon на Валдаях
- Цель: 1 500 000₽ чистой прибыли в месяц
