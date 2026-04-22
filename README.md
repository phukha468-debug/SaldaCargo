# SaldaBiz — Система управления автопарком

Приложение для управления парком грузовиков, расчёта зарплаты и финансов для малого бизнеса логистики.

## Быстрый старт

### Требования
- Node.js 20+
- pnpm 8+
- Supabase аккаунт
- (опционально) Vercel для деплоя

### Установка

1. **Клонировать и перейти**
```bash
git clone https://github.com/your-org/saldabiz.git
cd saldabiz
```

2. **Установить зависимости**
```bash
pnpm install
```

3. **Создать и заполнить .env.local**
```bash
cp .env.example .env.local

# Отредактировать .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
# MAX_CLIENT_ID=your-id
# MAX_CLIENT_SECRET=your-secret
```

4. **Инициализировать БД в Supabase**
```bash
# Открыть Supabase Dashboard
# SQL Editor → скопировать содержимое supabase/schema.sql
# Выполнить SQL (создаст 22 таблицы + ENUMs)
```

5. **Запустить оба приложения**
```bash
pnpm dev
```

Откроются:
- Dashboard (web): http://localhost:3000
- Mini App (miniapp): http://localhost:3001

## Структура проекта

```
saldabiz/
├── apps/
│   ├── web/              ← Next.js Dashboard (admin, owner)
│   └── miniapp/          ← Next.js Mini App (drivers в MAX)
├── packages/
│   ├── shared-types/     ← Типы данных (@saldacargo/shared-types)
│   ├── ui/               ← shadcn/ui компоненты (@saldacargo/ui)
│   ├── api-client/       ← Supabase функции (@saldacargo/api-client)
│   └── constants/        ← Константы (@saldacargo/constants)
└── supabase/
    └── schema.sql        ← SQL инициализация (22 таблицы)
```

## API Routes

### Авторизация
- `POST /api/auth/max` — Вход через MAX OAuth
- `GET /api/auth/me` — Получить текущего пользователя
- `POST /api/auth/logout` — Выход

### Рейсы
- `GET /api/trips` — Список рейсов (с фильтрацией)
- `POST /api/trips` — Создать рейс (draft)
- `GET /api/trips/[id]/summary` — Сводка рейса
- `POST /api/trips/[id]/approve` — Утвердить рейс
- `POST /api/trips/[id]/orders` — Добавить заказ

### Финансы
- `GET /api/money-map` — Баланс кошельков + P&L
- `GET /api/transactions` — Лента транзакций
- `POST /api/transactions` — Создать транзакцию

### ЗП
- `GET /api/payroll/periods` — Периоды расчёта ЗП
- `POST /api/payroll/calculate` — Рассчитать ЗП за период

## Разработка

### Создать новый API route
```bash
# 1. Создать файл
touch apps/web/app/api/example/route.ts

# 2. Добавить код
```

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Твой код...
    const data = await supabase.from("table").select("*");

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

### Использовать UI компоненты
```typescript
import { Button, Card, CardHeader, CardTitle, Badge } from "@saldacargo/ui";

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Заголовок</CardTitle>
      </CardHeader>
      <div className="p-4">
        <Badge variant="success">Completed</Badge>
        <Button onClick={() => {}}>Нажми меня</Button>
      </div>
    </Card>
  );
}
```

## Деплой на Vercel

### 1. Создать проекты в Vercel
- `saldabiz-web` → deploy из `apps/web`
- `saldabiz-miniapp` → deploy из `apps/miniapp`

### 2. Добавить переменные в Vercel
Для каждого проекта → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Настроить GitHub Actions
CI/CD workflow автоматически деплоит при push в main

## Дорожная карта

### W1 (текущая) ✅
- ✅ Структура монорепо
- ✅ Auth (MAX OAuth)
- ✅ API базовый (trips, orders)
- ✅ Mini App (DriverHome, OrderForm, ActiveTrip)
- ✅ Dashboard (MoneyMap, TripReviewTable)

### W2 (финансы)
- Карта денег (главная)
- Баланс кошельков
- Амортизация машин
- Дашборд для админа

### W3 (ЗП)
- Расчёт ЗП за период
- Дебиторка (должники)
- Кредиторка (кому должны)

### W4-W6 (интеграции и полировка)
- Opti24 (топливо)
- Wialon (GPS)
- Банк API
- Offline-first (IndexedDB)
- СТО + регламенты ТО
- Production deploy

## Тестирование локально

### Сценарий 1: Создание рейса
```
1. Открыть http://localhost:3001 (miniapp)
2. Логин через MAX
3. Нажать [Начать рейс]
4. Выбрать машину, грузчика, ввести одометр
5. Добавить заказ (клиент, сумма, ЗП)
6. Нажать [🏁 Завершить рейс]
7. Открыть http://localhost:3000 (dashboard)
8. Видеть рейс в ревью дня
9. Подтвердить рейс
10. Проверить карту денег (баланс обновился)
```

### Сценарий 2: ЗП
```
1. Создать 5+ рейсов за месяц
2. Перейти в Dashboard → ЗП
3. Рассчитать за период
4. Водитель видит в Mini App → Моя ЗП
```

## Документация

Полная документация в папке `/docs`:
- `MONOREPO_STRUCTURE.md` — Архитектура
- `DATABASE_MAP.md` — Схема БД (22 таблицы)
- `ENVIRONMENT_VARS.md` — Переменные
- `ROADMAP.md` — Дорожная карта (W1-W6)
- `TASK_TEMPLATE.md` — Как писать таски

## Помощь

### Проблема: "Cannot find module"
```bash
# Переустановить зависимости
pnpm install

# Очистить кэш
pnpm store prune
```

### Проблема: Supabase connection error
```bash
# Проверить .env.local
# NEXT_PUBLIC_SUPABASE_URL и ANON_KEY заполнены?
# Service Role Key в SUPABASE_SERVICE_ROLE_KEY?
```

### Проблема: Типы TypeScript ошибаются
```bash
# Экспортировать типы из Supabase
supabase gen types typescript > packages/shared-types/src/database.types.ts
```

## Контрибьютинг

1. Создать branch: `git checkout -b feat/W2-money-map`
2. Делать коммиты: `git commit -m "feat(W2): add money-map component"`
3. Push: `git push origin feat/W2-money-map`
4. Pull Request → Review → Merge

## Лицензия

MIT
```