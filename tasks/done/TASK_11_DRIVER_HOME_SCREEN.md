# TASK 11: Главный экран водителя (MiniApp)

**Адресат:** Claude Code.
**Длительность:** 2–3 часа.
**Зависимости:** TASK_10 выполнен (авторизация работает).

---

## Цель

Реализовать главный экран водителя в MiniApp **точно по дизайн-референсу** `docs/design/driver/01-home.html`. Открой этот файл в браузере и сверяй каждый элемент. Дизайн — закон.

Экран должен работать с реальными данными из Supabase.

---

## Перед стартом — изучи дизайн

```powershell
# Открой в браузере:
start docs\design\driver\01-home.html
```

Зафиксируй визуально:

- Цвета, отступы, шрифты
- Расположение карточек
- Иконки и их размеры
- Таб-бар внизу (4 пункта)
- Шапка (имя, роль, индикатор сети)

**Реализация должна совпадать на 100%.**

---

## Архитектура экрана

```
apps/miniapp/app/
├── (driver)/                    ← route group для водителя
│   ├── layout.tsx               ← шапка + таб-бар
│   ├── page.tsx                 ← главная (этот TASK)
│   ├── trips/
│   │   └── page.tsx             ← история рейсов (заглушка)
│   ├── finance/
│   │   └── page.tsx             ← финансы (заглушка)
│   └── profile/
│       └── page.tsx             ← профиль (заглушка)
```

---

## Алгоритм

### Шаг 1. Создать структуру папок

```powershell
mkdir apps\miniapp\app\(driver)
mkdir apps\miniapp\app\(driver)\trips
mkdir apps\miniapp\app\(driver)\finance
mkdir apps\miniapp\app\(driver)\profile
```

### Шаг 2. Установить зависимости

```powershell
pnpm add @tanstack/react-query --filter @saldacargo/miniapp
pnpm add @tanstack/react-query-devtools --filter @saldacargo/miniapp
```

### Шаг 3. Провайдер TanStack Query

Создай `apps/miniapp/app/providers.tsx`:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 минута
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Обнови `apps/miniapp/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SaldaCargo',
  description: 'Грузоперевозки Верхняя Салда',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Шаг 4. API routes для данных водителя

Создай `apps/miniapp/app/api/driver/summary/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/driver/summary?driver_id=xxx
 * Возвращает сводку для главного экрана водителя:
 * - подотчёт (наличные на руках)
 * - ЗП за текущий месяц
 * - активный рейс (если есть)
 * - последние 3 рейса
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Активный рейс
  const { data: activeTrip } = await supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, started_at, trip_type,
      asset:assets(short_name, reg_number),
      loader:users!trips_loader_id_fkey(name)
    `,
    )
    .eq('driver_id', driverId)
    .eq('status', 'in_progress')
    .single();

  // Последние 3 рейса (не активные)
  const { data: recentTrips } = await supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      asset:assets(short_name),
      trip_orders(amount, driver_pay, lifecycle_status)
    `,
    )
    .eq('driver_id', driverId)
    .neq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(3);

  // Подотчёт водителя (наличные на руках)
  // Это wallet типа driver_accountable для этого водителя
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('owner_user_id', driverId)
    .eq('type', 'driver_accountable')
    .single();

  let accountableBalance = '0';
  if (wallet) {
    // Баланс = сумма всех транзакций в этот кошелёк - из него
    const { data: txns } = await supabase
      .from('transactions')
      .select('direction, amount, from_wallet_id, to_wallet_id')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`);

    if (txns) {
      const balance = txns.reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        if (t.to_wallet_id === wallet.id) return sum + amount;
        if (t.from_wallet_id === wallet.id) return sum - amount;
        return sum;
      }, 0);
      accountableBalance = balance.toFixed(2);
    }
  }

  // ЗП за текущий месяц (из утверждённых рейсов)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: monthOrders } = await supabase
    .from('trip_orders')
    .select('driver_pay, lifecycle_status, trips!inner(driver_id, started_at)')
    .eq('trips.driver_id', driverId)
    .gte('trips.started_at', monthStart);

  const approvedPay = (monthOrders ?? [])
    .filter((o) => o.lifecycle_status === 'approved')
    .reduce((sum, o) => sum + parseFloat(o.driver_pay), 0);

  const draftPay = (monthOrders ?? [])
    .filter((o) => o.lifecycle_status === 'draft')
    .reduce((sum, o) => sum + parseFloat(o.driver_pay), 0);

  return NextResponse.json({
    activeTrip,
    recentTrips: recentTrips ?? [],
    accountableBalance,
    monthPayApproved: approvedPay.toFixed(2),
    monthPayDraft: draftPay.toFixed(2),
  });
}
```

### Шаг 5. Layout водителя (шапка + таб-бар)

Создай `apps/miniapp/app/(driver)/layout.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NetworkIndicator } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

const tabs = [
  { href: '/', label: 'Главная', icon: '🏠' },
  { href: '/trips', label: 'Рейсы', icon: '📋' },
  { href: '/finance', label: 'Финансы', icon: '💰' },
  { href: '/profile', label: 'Профиль', icon: '👤' },
] as const;

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">SaldaCargo</p>
            <p className="text-sm font-semibold text-slate-900">Водитель</p>
          </div>
          <NetworkIndicator />
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Таб-бар */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-10">
        <div className="grid grid-cols-4">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]',
                  isActive ? 'text-orange-600' : 'text-slate-400',
                )}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

### Шаг 6. Главная страница водителя

Создай `apps/miniapp/app/(driver)/page.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Money } from '@saldacargo/ui';
import { LifecycleBadge } from '@saldacargo/ui';
import { formatDate, formatDuration } from '@saldacargo/shared';

// Тип ответа API
interface DriverSummary {
  activeTrip: {
    id: string;
    trip_number: number;
    started_at: string;
    trip_type: string;
    asset: { short_name: string; reg_number: string };
    loader: { name: string } | null;
  } | null;
  recentTrips: Array<{
    id: string;
    trip_number: number;
    status: string;
    lifecycle_status: string;
    started_at: string;
    asset: { short_name: string };
    trip_orders: Array<{ amount: string; driver_pay: string; lifecycle_status: string }>;
  }>;
  accountableBalance: string;
  monthPayApproved: string;
  monthPayDraft: string;
}

// TODO: после TASK_10 получать driver_id из контекста авторизации
const MOCK_DRIVER_ID = 'replace-with-real-driver-id';

export default function DriverHomePage() {
  const { data, isLoading, error } = useQuery<DriverSummary>({
    queryKey: ['driver-summary', MOCK_DRIVER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/driver/summary?driver_id=${MOCK_DRIVER_ID}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json() as Promise<DriverSummary>;
    },
  });

  if (isLoading) {
    return <DriverHomeSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        Ошибка загрузки. Потяните вниз для обновления.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Приветствие */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Привет! 👋</h1>
      </div>

      {/* Карточка подотчёта */}
      <AccountableCard balance={data?.accountableBalance ?? '0'} />

      {/* Карточка ЗП */}
      <PayCard approved={data?.monthPayApproved ?? '0'} draft={data?.monthPayDraft ?? '0'} />

      {/* Кнопка начать рейс (если нет активного) */}
      {!data?.activeTrip && (
        <Link
          href="/trip/new"
          className="flex items-center justify-center gap-3 w-full bg-orange-600 text-white rounded-2xl py-5 text-lg font-bold shadow-lg active:bg-orange-700 transition-colors"
        >
          <span>🚚</span>
          <span>Начать рейс</span>
        </Link>
      )}

      {/* Активный рейс */}
      {data?.activeTrip && <ActiveTripCard trip={data.activeTrip} />}

      {/* Последние рейсы */}
      {(data?.recentTrips ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Последние рейсы
          </h2>
          <div className="space-y-2">
            {data?.recentTrips.map((trip) => (
              <RecentTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Компоненты ──────────────────────────────────────────────────────────────

function AccountableCard({ balance }: { balance: string }) {
  return (
    <Link href="/finance?tab=accountable">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:bg-slate-50">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">На руках</p>
        <Money amount={balance} className="text-2xl font-bold text-slate-900 mt-1" />
        <p className="text-xs text-slate-400 mt-1">Подотчётные наличные →</p>
      </div>
    </Link>
  );
}

function PayCard({ approved, draft }: { approved: string; draft: string }) {
  const hasDraft = parseFloat(draft) > 0;
  return (
    <Link href="/finance?tab=pay">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:bg-slate-50">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">ЗП за месяц</p>
        <Money amount={approved} className="text-2xl font-bold text-green-600 mt-1" />
        {hasDraft && (
          <p className="text-xs text-amber-500 mt-1">
            В черновиках: <Money amount={draft} />
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">Детализация →</p>
      </div>
    </Link>
  );
}

function ActiveTripCard({
  trip,
}: {
  trip: {
    id: string;
    trip_number: number;
    started_at: string;
    asset: { short_name: string };
    loader: { name: string } | null;
  };
}) {
  const durationMs = Date.now() - new Date(trip.started_at).getTime();
  const durationMin = Math.floor(durationMs / 60000);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 active:bg-orange-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
            Активный рейс
          </span>
          <span className="text-xs text-orange-500">⏱ {formatDuration(durationMin)}</span>
        </div>
        <p className="font-bold text-slate-900">
          Рейс №{trip.trip_number} · {trip.asset.short_name}
        </p>
        {trip.loader && <p className="text-sm text-slate-500 mt-0.5">+ {trip.loader.name}</p>}
        <p className="text-sm text-orange-600 font-medium mt-2">Открыть рейс →</p>
      </div>
    </Link>
  );
}

function RecentTripCard({
  trip,
}: {
  trip: {
    id: string;
    trip_number: number;
    lifecycle_status: string;
    started_at: string;
    asset: { short_name: string };
    trip_orders: Array<{ amount: string; driver_pay: string; lifecycle_status: string }>;
  };
}) {
  const revenue = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.amount), 0);

  const driverPay = trip.trip_orders
    .filter((o) => o.lifecycle_status !== 'cancelled')
    .reduce((s, o) => s + parseFloat(o.driver_pay), 0);

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50">
        <div>
          <p className="font-medium text-slate-900 text-sm">
            Рейс №{trip.trip_number} · {trip.asset.short_name}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{formatDate(trip.started_at)}</p>
        </div>
        <div className="text-right">
          <Money amount={revenue} className="text-sm font-semibold text-slate-900" />
          <p className="text-xs text-green-600 mt-0.5">
            ЗП: <Money amount={driverPay} />
          </p>
          <LifecycleBadge
            status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
          />
        </div>
      </div>
    </Link>
  );
}

function DriverHomeSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-slate-200 rounded" />
      <div className="bg-slate-200 rounded-2xl h-20" />
      <div className="bg-slate-200 rounded-2xl h-20" />
      <div className="bg-slate-200 rounded-2xl h-16" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-200 rounded-xl h-14" />
        ))}
      </div>
    </div>
  );
}
```

### Шаг 7. Заглушки остальных вкладок

Создай `apps/miniapp/app/(driver)/trips/page.tsx`:

```tsx
export default function TripsPage() {
  return (
    <div className="p-4 text-center text-slate-400 mt-20">
      <p className="text-4xl mb-4">📋</p>
      <p className="font-medium">История рейсов</p>
      <p className="text-sm mt-1">Реализация в TASK_12</p>
    </div>
  );
}
```

Создай `apps/miniapp/app/(driver)/finance/page.tsx`:

```tsx
export default function FinancePage() {
  return (
    <div className="p-4 text-center text-slate-400 mt-20">
      <p className="text-4xl mb-4">💰</p>
      <p className="font-medium">Финансы</p>
      <p className="text-sm mt-1">Реализация в TASK_12</p>
    </div>
  );
}
```

Создай `apps/miniapp/app/(driver)/profile/page.tsx`:

```tsx
export default function ProfilePage() {
  return (
    <div className="p-4 text-center text-slate-400 mt-20">
      <p className="text-4xl mb-4">👤</p>
      <p className="font-medium">Профиль</p>
      <p className="text-sm mt-1">Реализация в TASK_12</p>
    </div>
  );
}
```

### Шаг 8. Проверка

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

Запусти dev и открой http://localhost:3001:

```powershell
pnpm dev
```

Сверь визуально с `docs/design/driver/01-home.html`. Отступы, карточки, таб-бар, цвета — должно совпадать.

### Шаг 9. Коммит

```powershell
git add .
git commit -m "feat: главный экран водителя (MiniApp)

- Layout с шапкой и таб-баром
- Карточки: подотчёт, ЗП за месяц
- Кнопка 'Начать рейс'
- Активный рейс (если есть)
- Последние 3 рейса
- Skeleton-загрузка
- API route /api/driver/summary
- TanStack Query провайдер"
git push
```

---

## Критерии приёмки

- [ ] Дизайн совпадает с `docs/design/driver/01-home.html` визуально
- [ ] `apps/miniapp/app/(driver)/layout.tsx` — шапка + таб-бар
- [ ] `apps/miniapp/app/(driver)/page.tsx` — главная водителя
- [ ] API route `/api/driver/summary` возвращает данные
- [ ] Заглушки для trips, finance, profile созданы
- [ ] Skeleton при загрузке отображается
- [ ] `pnpm typecheck` зелёный
- [ ] `pnpm build` зелёный
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не реализуй создание рейса — это TASK_12
- ❌ Не реализуй детальный экран рейса — это TASK_12
- ❌ Не реализуй офлайн/IndexedDB — это отдельная итерация
- ❌ Не меняй дизайн — только pixel-perfect по референсу

---

## Отчёт

```
✅ TASK_11 выполнено

Экраны:
- / (главная водителя) ✓
- /trips (заглушка) ✓
- /finance (заглушка) ✓
- /profile (заглушка) ✓

Дизайн: совпадает с референсом ✓

Команды:
- pnpm typecheck ✓
- pnpm build ✓

Git: push успешно
```
