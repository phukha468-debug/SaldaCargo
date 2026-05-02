# TASK 15: Ретроспективный ввод данных

**Адресат:** Claude Code.
**Длительность:** 2–3 часа.
**Зависимости:** TASK_14 выполнен. WebApp доступен на Vercel.

---

## Цель

Создать инструмент для ввода исторических данных: рейсы за апрель–май 2026.
Данные вводятся через WebApp (не SQL напрямую). Нужно создать:

1. Базовый layout WebApp с sidebar
2. Раздел «Ревью смены» — просмотр и апрув рейсов
3. Форму ручного ввода рейса (для ретро-данных)

**Дизайн-референс:** `docs/design/admin-web/02-review.html`
Открой и сверяй каждый элемент.

---

## Архитектура

```
apps/web/app/
├── (dashboard)/               ← route group, требует авторизации
│   ├── layout.tsx             ← sidebar + topbar
│   ├── page.tsx               ← главная (заглушка → TASK позже)
│   ├── review/
│   │   ├── page.tsx           ← ревью смены (список рейсов на апрув)
│   │   └── [id]/
│   │       └── page.tsx       ← детальный просмотр рейса
│   └── retro/
│       └── page.tsx           ← форма ввода ретро-рейса
```

---

## Алгоритм

### Шаг 1. Установить зависимости для WebApp

```powershell
pnpm add @tanstack/react-query --filter @saldacargo/web
pnpm add react-hook-form zod @hookform/resolvers --filter @saldacargo/web
pnpm add date-fns --filter @saldacargo/web
```

### Шаг 2. Провайдер для WebApp

Создай `apps/web/app/providers.tsx`:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 1000 * 60 } },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Обнови `apps/web/app/layout.tsx` — добавь `<Providers>` обёртку.

### Шаг 3. Dashboard layout (sidebar + topbar)

Создай `apps/web/app/(dashboard)/layout.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@saldacargo/ui';

const navItems = [
  { href: '/', label: 'Главная', icon: '🏠' },
  { href: '/review', label: 'Ревью смены', icon: '📋' },
  { href: '/fleet', label: 'Автопарк', icon: '🚛' },
  { href: '/garage', label: 'Гараж', icon: '🔧' },
  { href: '/finance', label: 'Финансы', icon: '💰' },
  { href: '/staff', label: 'Персонал', icon: '👥' },
  { href: '/settings', label: 'Настройки', icon: '⚙️' },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-bold text-slate-900">SaldaCargo</h1>
          <p className="text-xs text-slate-400 mt-0.5">Панель управления</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <Link
            href="/retro"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50"
          >
            📥 Ввод данных
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <button className="relative text-slate-500 hover:text-slate-900">
              🔔
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                3
              </span>
            </button>
            <div className="text-sm font-medium text-slate-900">Администратор</div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

### Шаг 4. Главная заглушка

Создай `apps/web/app/(dashboard)/page.tsx`:

```tsx
export default function DashboardHome() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Главная</h1>
      <p className="text-slate-500">Dashboard — следующая итерация разработки.</p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {['Ревью смены', 'Автопарк', 'Финансы'].map((name) => (
          <div
            key={name}
            className="bg-white rounded-xl p-5 border border-slate-200 text-center text-slate-400"
          >
            <p className="text-sm">{name}</p>
            <p className="text-xs mt-1">В разработке</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Шаг 5. API routes для WebApp

Создай `apps/web/app/api/trips/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/trips?status=draft&lifecycle=completed — рейсы для ревью */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lifecycle = searchParams.get('lifecycle') ?? 'draft';
  const date = searchParams.get('date'); // YYYY-MM-DD

  const supabase = await createClient();

  let query = supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at,
      trip_type, odometer_start, odometer_end,
      asset:assets(short_name, reg_number),
      driver:users!trips_driver_id_fkey(id, name),
      loader:users!trips_loader_id_fkey(id, name),
      trip_orders(
        id, amount, driver_pay, loader_pay,
        payment_method, settlement_status, lifecycle_status,
        counterparty:counterparties(name)
      )
    `,
    )
    .eq('lifecycle_status', lifecycle)
    .order('started_at', { ascending: false });

  if (date) {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;
    query = query.gte('started_at', start).lte('started_at', end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/trips — ручной ввод рейса (ретро) */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    driver_id: string;
    asset_id: string;
    loader_id?: string;
    trip_type: string;
    odometer_start: number;
    odometer_end: number;
    started_at: string;
    ended_at: string;
    driver_note?: string;
    orders: Array<{
      amount: string;
      driver_pay: string;
      loader_pay: string;
      payment_method: string;
      description?: string;
    }>;
  };

  const supabase = await createClient();

  // Создаём рейс
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      driver_id: body.driver_id,
      asset_id: body.asset_id,
      loader_id: body.loader_id ?? null,
      trip_type: body.trip_type,
      odometer_start: body.odometer_start,
      odometer_end: body.odometer_end,
      started_at: body.started_at,
      ended_at: body.ended_at,
      status: 'completed',
      lifecycle_status: 'draft', // сразу на ревью
      driver_note: body.driver_note ?? null,
    })
    .select()
    .single();

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  // Создаём заказы
  if (body.orders.length > 0) {
    const ordersToInsert = body.orders.map((o) => ({
      trip_id: trip.id,
      amount: o.amount,
      driver_pay: o.driver_pay,
      loader_pay: o.loader_pay ?? '0',
      payment_method: o.payment_method,
      settlement_status: ['bank_invoice', 'debt_cash'].includes(o.payment_method)
        ? 'pending'
        : 'completed',
      lifecycle_status: 'draft',
      description: o.description ?? null,
      idempotency_key: crypto.randomUUID(),
    }));

    const { error: ordersError } = await supabase.from('trip_orders').insert(ordersToInsert);

    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  return NextResponse.json(trip, { status: 201 });
}
```

Создай `apps/web/app/api/trips/[id]/approve/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Утверждаем рейс
  const { error: tripError } = await supabase
    .from('trips')
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  // Утверждаем все заказы этого рейса
  const { error: ordersError } = await supabase
    .from('trip_orders')
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .eq('lifecycle_status', 'draft');

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

Создай `apps/web/app/api/trips/[id]/return/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/return — вернуть на доработку */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { comment: string };
  const supabase = await createClient();

  const { error } = await supabase
    .from('trips')
    .update({
      lifecycle_status: 'returned',
      admin_note: body.comment,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### Шаг 6. Страница ревью смены

Создай `apps/web/app/(dashboard)/review/page.tsx`:

```tsx
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDate, formatTime } from '@saldacargo/shared';

interface TripForReview {
  id: string;
  trip_number: number;
  lifecycle_status: string;
  started_at: string;
  ended_at: string | null;
  trip_type: string;
  odometer_start: number;
  odometer_end: number | null;
  asset: { short_name: string; reg_number: string };
  driver: { id: string; name: string };
  loader: { id: string; name: string } | null;
  trip_orders: Array<{
    id: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    payment_method: string;
    settlement_status: string;
    lifecycle_status: string;
    counterparty: { name: string } | null;
  }>;
}

const PAYMENT_ICONS: Record<string, string> = {
  cash: '💵',
  qr: '📱',
  bank_invoice: '🏦',
  debt_cash: '⏳',
  card_driver: '💳',
};

export default function ReviewPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState('');
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery<TripForReview[]>({
    queryKey: ['trips-review', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/trips?lifecycle=draft&date=${selectedDate}`);
      return res.json() as Promise<TripForReview[]>;
    },
  });

  async function handleApprove(tripId: string) {
    setApprovingId(tripId);
    await fetch(`/api/trips/${tripId}/approve`, { method: 'POST' });
    await queryClient.invalidateQueries({ queryKey: ['trips-review'] });
    setApprovingId(null);
  }

  async function handleReturn(tripId: string) {
    if (!returnComment.trim()) return;
    await fetch(`/api/trips/${tripId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: returnComment }),
    });
    await queryClient.invalidateQueries({ queryKey: ['trips-review'] });
    setReturningId(null);
    setReturnComment('');
  }

  return (
    <div className="p-6">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ревью смены</h1>
          <p className="text-slate-500 text-sm mt-1">
            {trips.length > 0 ? `${trips.length} рейсов ждут подтверждения` : 'Нет рейсов на ревью'}
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-200 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      )}

      {/* Список рейсов */}
      <div className="space-y-4">
        {trips.map((trip) => {
          const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');
          const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
          const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
          const loaderPay = activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay), 0);
          const mileage = trip.odometer_end ? trip.odometer_end - trip.odometer_start : null;

          return (
            <div
              key={trip.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Шапка карточки */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      🚚 {trip.asset.short_name} · {trip.driver.name}
                      {trip.loader && ` + ${trip.loader.name}`}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {formatTime(trip.started_at)}
                      {trip.ended_at && ` – ${formatTime(trip.ended_at)}`}
                      {mileage && ` · ${mileage} км`}
                    </p>
                  </div>
                  <LifecycleBadge
                    status={
                      trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'
                    }
                  />
                </div>
              </div>

              {/* Таблица заказов */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-5 py-2 text-xs text-slate-500 font-medium">#</th>
                      <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">
                        Клиент
                      </th>
                      <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">
                        Сумма
                      </th>
                      <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">
                        ЗП вод.
                      </th>
                      <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">
                        ЗП гр.
                      </th>
                      <th className="text-center px-3 py-2 text-xs text-slate-500 font-medium">
                        Оплата
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.map((order, i) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-5 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-900">
                          {order.counterparty?.name ?? 'б/н'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          <Money amount={order.amount} />
                        </td>
                        <td className="px-3 py-2 text-right text-green-700">
                          <Money amount={order.driver_pay} />
                        </td>
                        <td className="px-3 py-2 text-right text-green-700">
                          <Money amount={order.loader_pay} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span title={order.payment_method}>
                            {PAYMENT_ICONS[order.payment_method]}
                            {order.settlement_status === 'pending' && ' ⏳'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={2} className="px-5 py-2 font-semibold text-slate-700">
                        Итого
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        <Money amount={revenue} />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">
                        <Money amount={driverPay} />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">
                        <Money amount={loaderPay} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Кнопки */}
              <div className="px-5 py-3 flex items-center gap-3 border-t border-slate-100">
                <button
                  onClick={() => handleApprove(trip.id)}
                  disabled={approvingId === trip.id}
                  className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  ✅ {approvingId === trip.id ? 'Утверждаем...' : 'Утвердить'}
                </button>

                {returningId === trip.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      placeholder="Комментарий обязателен..."
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleReturn(trip.id)}
                      className="bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-medium"
                    >
                      ↩️ Вернуть
                    </button>
                    <button onClick={() => setReturningId(null)} className="text-slate-500 text-sm">
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setReturningId(trip.id)}
                    className="flex items-center gap-2 border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    ↩️ Вернуть
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!isLoading && trips.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-4">✅</p>
            <p className="font-medium">Нет рейсов на ревью за эту дату</p>
            <p className="text-sm mt-1">
              Или{' '}
              <a href="/retro" className="text-orange-600 hover:underline">
                введите ретро-данные
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Шаг 7. Форма ввода ретро-рейса

Создай `apps/web/app/(dashboard)/retro/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button, Money } from '@saldacargo/ui';

const orderSchema = z.object({
  amount: z.coerce.number().positive(),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0),
  payment_method: z.enum(['cash', 'qr', 'bank_invoice', 'debt_cash', 'card_driver']),
  description: z.string().optional(),
});

const schema = z.object({
  driver_id: z.string().min(1, 'Выберите водителя'),
  asset_id: z.string().min(1, 'Выберите машину'),
  loader_id: z.string().optional(),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  odometer_start: z.coerce.number().min(0),
  odometer_end: z.coerce.number().min(0),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  driver_note: z.string().optional(),
  orders: z.array(orderSchema).min(1, 'Добавьте хотя бы один заказ'),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Нал' },
  { value: 'qr', label: '📱 QR' },
  { value: 'bank_invoice', label: '🏦 Безнал' },
  { value: 'debt_cash', label: '⏳ Долг' },
  { value: 'card_driver', label: '💳 На карту' },
] as const;

export default function RetroPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const [assets, setAssets] = useState<
    Array<{ id: string; short_name: string; odometer_current: number }>
  >([]);
  const [loaders, setLoaders] = useState<Array<{ id: string; name: string }>>([]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      trip_type: 'local',
      orders: [{ amount: 0, driver_pay: 0, loader_pay: 0, payment_method: 'cash' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'orders' });

  useEffect(() => {
    fetch('/api/driver/assets')
      .then((r) => r.json())
      .then(setAssets);
    fetch('/api/driver/loaders')
      .then((r) => r.json())
      .then(setLoaders);
    // Загружаем водителей
    fetch('/api/users?role=driver')
      .then((r) => r.json())
      .then(setDrivers);
  }, []);

  const orders = watch('orders');
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const totalDriverPay = orders.reduce((s, o) => s + (Number(o.driver_pay) || 0), 0);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        orders: data.orders.map((o) => ({
          ...o,
          amount: String(o.amount),
          driver_pay: String(o.driver_pay),
          loader_pay: String(o.loader_pay),
        })),
      }),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push('/review');
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ввод данных</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ретроспективный ввод рейса. После сохранения рейс попадёт в ревью.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Основные данные */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Данные рейса</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Водитель</label>
              <select
                {...register('driver_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.driver_id && (
                <p className="text-red-500 text-xs mt-1">{errors.driver_id.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Машина</label>
              <select
                {...register('asset_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Грузчик</label>
              <select
                {...register('loader_id')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Без грузчика</option>
                {loaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Тип рейса</label>
              <select
                {...register('trip_type')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="local">По городу</option>
                <option value="intercity">Межгород</option>
                <option value="moving">Переезд</option>
                <option value="hourly">Почасовой</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Начало</label>
              <input
                type="datetime-local"
                {...register('started_at')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Конец</label>
              <input
                type="datetime-local"
                {...register('ended_at')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Одометр начало
              </label>
              <input
                type="number"
                {...register('odometer_start')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Одометр конец</label>
              <input
                type="number"
                {...register('odometer_end')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Заметка</label>
            <input
              type="text"
              {...register('driver_note')}
              placeholder="Необязательно"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Заказы */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Заказы ({fields.length})</h2>
            <div className="text-sm text-slate-500">
              Итого: <Money amount={totalRevenue} /> · ЗП: <Money amount={totalDriverPay} />
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-sm mt-2 w-4">{i + 1}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    {...register(`orders.${i}.amount`)}
                    placeholder="Сумма ₽"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm col-span-1"
                  />
                  <input
                    type="number"
                    {...register(`orders.${i}.driver_pay`)}
                    placeholder="ЗП водителя ₽"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    {...register(`orders.${i}.payment_method`)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    {...register(`orders.${i}.description`)}
                    placeholder="Описание"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-red-400 hover:text-red-600 mt-2 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              append({ amount: 0, driver_pay: 0, loader_pay: 0, payment_method: 'cash' })
            }
            className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            + Добавить заказ
          </button>

          {errors.orders && <p className="text-red-500 text-sm mt-2">{errors.orders.message}</p>}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Сохраняем...' : '💾 Сохранить рейс'}
        </Button>
      </form>
    </div>
  );
}
```

### Шаг 8. API для списка пользователей (водителей)

Создай `apps/web/app/api/users/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const supabase = await createClient();
  let query = supabase.from('users').select('id, name, roles').eq('is_active', true);

  if (role) {
    query = query.contains('roles', [role]);
  }

  const { data, error } = await query.order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

### Шаг 9. Проверка

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

Открой `docs/design/admin-web/02-review.html` в браузере и сверь с реализацией `/review`.

Протестируй полный цикл:

1. Зайди на `/retro`
2. Введи тестовый рейс с 2-3 заказами
3. Перейди на `/review` — рейс должен появиться
4. Нажми «Утвердить» — рейс должен исчезнуть из списка

### Шаг 10. Коммит

```powershell
git add .
git commit -m "feat: WebApp layout, ревью смены и ввод ретро-данных

- Dashboard layout: sidebar + topbar
- /review: список рейсов на апрув с таблицей заказов
- Утвердить / Вернуть на доработку с комментарием
- /retro: форма ручного ввода рейса (ретро-данные)
- API: GET/POST /api/trips, approve, return, users
- Дизайн по referens docs/design/admin-web/02-review.html"
git push
```

---

## Критерии приёмки

- [ ] Dashboard layout (sidebar + topbar) соответствует `docs/design/admin-web/02-review.html`
- [ ] `/review` — рейсы на ревью отображаются с таблицей заказов
- [ ] Кнопка «Утвердить» работает (меняет lifecycle_status → approved)
- [ ] Кнопка «Вернуть» работает (требует комментарий)
- [ ] `/retro` — форма ввода рейса с заказами работает
- [ ] После сохранения ретро-рейс появляется в `/review`
- [ ] `pnpm typecheck` зелёный
- [ ] `pnpm build` зелёный
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не реализуй главную (Dashboard home) с графиками — следующая итерация
- ❌ Не реализуй Автопарк, Финансы, Персонал — следующая итерация
- ❌ Не добавляй интеграции Wialon/Опти24

---

## Отчёт

```
✅ TASK_15 выполнено

Экраны WebApp:
- / (dashboard home — заглушка) ✓
- /review ✓
- /retro ✓

API routes: 5 штук ✓
Тест цикла: ввод → ревью → апрув ✓
Дизайн: совпадает с референсом ✓

Команды:
- pnpm typecheck ✓
- pnpm build ✓

Git: push успешно
```
