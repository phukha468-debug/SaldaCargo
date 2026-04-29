# TASK 12: Полный flow рейса водителя (MiniApp)

**Адресат:** Claude Code.
**Длительность:** 3–4 часа.
**Зависимости:** TASK_11 выполнен (главный экран водителя работает).

---

## Цель

Реализовать полный flow рейса водителя:

1. Начать рейс (выбор машины, грузчика, одометр)
2. Активный рейс (добавить заказ, добавить расход)
3. Завершить рейс (конечный одометр, финальная сводка)

**Дизайн-референс:** `docs/design/driver/03-trip-active.html`
Открой в браузере и сверяй каждый элемент.

**Интеграции НЕ реализуем:** GPS верификация пробега — без Wialon.

---

## Архитектура

```
apps/miniapp/app/
├── (driver)/
│   └── page.tsx              ← уже готово (TASK_11)
├── trip/
│   ├── new/
│   │   └── page.tsx          ← форма начала рейса
│   └── [id]/
│       ├── page.tsx          ← активный/завершённый рейс
│       ├── order/
│       │   └── page.tsx      ← добавить заказ
│       ├── expense/
│       │   └── page.tsx      ← добавить расход
│       └── finish/
│           └── page.tsx      ← завершить рейс
```

---

## Алгоритм

### Шаг 1. Создать структуру

```powershell
mkdir apps\miniapp\app\trip
mkdir apps\miniapp\app\trip\new
mkdir "apps\miniapp\app\trip\[id]"
mkdir "apps\miniapp\app\trip\[id]\order"
mkdir "apps\miniapp\app\trip\[id]\expense"
mkdir "apps\miniapp\app\trip\[id]\finish"
```

### Шаг 2. Установить зависимости

```powershell
pnpm add react-hook-form zod @hookform/resolvers --filter @saldacargo/miniapp
pnpm add uuid --filter @saldacargo/miniapp
pnpm add @types/uuid -D --filter @saldacargo/miniapp
```

### Шаг 3. API Routes

#### `apps/miniapp/app/api/driver/assets/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/assets — список активных машин для dropdown */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('id, short_name, reg_number, asset_type_id, odometer_current')
    .eq('status', 'active')
    .order('short_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

#### `apps/miniapp/app/api/driver/loaders/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/loaders — список грузчиков */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .contains('roles', ['loader'])
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

#### `apps/miniapp/app/api/trips/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips — создать рейс */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    driver_id: string;
    asset_id: string;
    loader_id?: string;
    trip_type: string;
    odometer_start: number;
    idempotency_key: string;
  };

  const supabase = await createClient();

  // Проверяем нет ли активного рейса у этого водителя
  const { data: existing } = await supabase
    .from('trips')
    .select('id, trip_number')
    .eq('driver_id', body.driver_id)
    .eq('status', 'in_progress')
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `У вас есть активный рейс №${existing.trip_number}` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      driver_id: body.driver_id,
      asset_id: body.asset_id,
      loader_id: body.loader_id ?? null,
      trip_type: body.trip_type,
      odometer_start: body.odometer_start,
      status: 'in_progress',
      lifecycle_status: 'draft',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

#### `apps/miniapp/app/api/trips/[id]/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/trips/:id — детали рейса */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trips')
    .select(
      `
      *,
      asset:assets(short_name, reg_number, asset_type_id),
      driver:users!trips_driver_id_fkey(name),
      loader:users!trips_loader_id_fkey(name),
      trip_orders(
        id, amount, driver_pay, loader_pay, payment_method,
        settlement_status, lifecycle_status, description,
        counterparty:counterparties(name)
      )
    `,
    )
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/trips/:id — обновить рейс */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const supabase = await createClient();

  const { data, error } = await supabase.from('trips').update(body).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

#### `apps/miniapp/app/api/trips/[id]/orders/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/orders — добавить заказ */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const body = (await request.json()) as {
    counterparty_id?: string;
    description?: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    payment_method: string;
    idempotency_key: string;
  };

  const supabase = await createClient();

  // Определяем settlement_status по способу оплаты
  const pendingMethods = ['bank_invoice', 'debt_cash'];
  const settlementStatus = pendingMethods.includes(body.payment_method) ? 'pending' : 'completed';

  const { data, error } = await supabase
    .from('trip_orders')
    .insert({
      trip_id: tripId,
      counterparty_id: body.counterparty_id ?? null,
      description: body.description ?? null,
      amount: body.amount,
      driver_pay: body.driver_pay,
      loader_pay: body.loader_pay,
      payment_method: body.payment_method,
      settlement_status: settlementStatus,
      lifecycle_status: 'draft',
      idempotency_key: body.idempotency_key,
    })
    .select()
    .single();

  if (error) {
    // Idempotency: если ключ уже есть — возвращаем существующий
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('trip_orders')
        .select()
        .eq('idempotency_key', body.idempotency_key)
        .single();
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

#### `apps/miniapp/app/api/trips/[id]/finish/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/finish — завершить рейс */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    odometer_end: number;
    driver_note?: string;
  };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trips')
    .update({
      status: 'completed',
      lifecycle_status: 'draft', // ждёт апрува админа
      odometer_end: body.odometer_end,
      driver_note: body.driver_note ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'in_progress') // защита от двойного завершения
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

### Шаг 4. Страница «Начать рейс»

Создай `apps/miniapp/app/trip/new/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';

const schema = z.object({
  asset_id: z.string().min(1, 'Выберите машину'),
  trip_type: z.enum(['local', 'intercity', 'moving', 'hourly']),
  loader_id: z.string().optional(),
  odometer_start: z.coerce.number().min(0, 'Введите одометр'),
});

type FormData = z.infer<typeof schema>;

const TRIP_TYPES = [
  { value: 'local', label: 'По городу' },
  { value: 'intercity', label: 'Межгород' },
  { value: 'moving', label: 'Переезд' },
  { value: 'hourly', label: 'Почасовой' },
] as const;

// TODO: получать из авторизации
const MOCK_DRIVER_ID = 'replace-with-real-driver-id';

export default function NewTripPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<
    Array<{ id: string; short_name: string; odometer_current: number }>
  >([]);
  const [loaders, setLoaders] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { trip_type: 'local' },
  });

  const selectedAssetId = watch('asset_id');
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  useEffect(() => {
    fetch('/api/driver/assets')
      .then((r) => r.json())
      .then(setAssets);
    fetch('/api/driver/loaders')
      .then((r) => r.json())
      .then(setLoaders);
  }, []);

  // Подставляем текущий одометр при выборе машины
  useEffect(() => {
    if (selectedAsset) {
      setValue('odometer_start', selectedAsset.odometer_current);
    }
  }, [selectedAsset, setValue]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        driver_id: MOCK_DRIVER_ID,
        idempotency_key: uuid(),
      }),
    });

    const result = (await res.json()) as { id?: string; error?: string };

    if (!res.ok) {
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push(`/trip/${result.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-500 text-xl">
          ←
        </button>
        <h1 className="font-bold text-slate-900">Новый рейс</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5 pb-24">
        {/* Машина */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Машина</label>
          <select
            {...register('asset_id')}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 bg-white focus:border-orange-500 focus:outline-none"
          >
            <option value="">Выберите машину</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.short_name}
              </option>
            ))}
          </select>
          {errors.asset_id && (
            <p className="text-red-500 text-sm mt-1">{errors.asset_id.message}</p>
          )}
        </div>

        {/* Тип рейса */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Тип рейса</label>
          <div className="grid grid-cols-2 gap-2">
            {TRIP_TYPES.map((t) => (
              <label key={t.value} className="relative">
                <input
                  type="radio"
                  value={t.value}
                  {...register('trip_type')}
                  className="sr-only peer"
                />
                <div className="border-2 border-slate-200 rounded-xl p-3 text-center cursor-pointer peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-checked:text-orange-700 font-medium text-sm transition-colors">
                  {t.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Грузчик */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Грузчик</label>
          <select
            {...register('loader_id')}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 bg-white focus:border-orange-500 focus:outline-none"
          >
            <option value="">Без грузчика</option>
            {loaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Одометр */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Одометр (км)</label>
          <input
            type="number"
            inputMode="numeric"
            {...register('odometer_start')}
            placeholder="340 100"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 text-lg focus:border-orange-500 focus:outline-none"
          />
          {selectedAsset && (
            <p className="text-xs text-slate-400 mt-1">
              Последнее значение: {selectedAsset.odometer_current.toLocaleString('ru-RU')} км
            </p>
          )}
          {errors.odometer_start && (
            <p className="text-red-500 text-sm mt-1">{errors.odometer_start.message}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <Button type="submit" size="hero" disabled={submitting}>
            {submitting ? 'Создаём рейс...' : '▶ Поехали'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### Шаг 5. Страница активного рейса

Создай `apps/miniapp/app/trip/[id]/page.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Money, LifecycleBadge } from '@saldacargo/ui';
import { formatDuration, formatDate } from '@saldacargo/shared';

interface TripDetail {
  id: string;
  trip_number: number;
  status: string;
  lifecycle_status: string;
  started_at: string;
  trip_type: string;
  asset: { short_name: string; reg_number: string };
  driver: { name: string };
  loader: { name: string } | null;
  trip_orders: Array<{
    id: string;
    amount: string;
    driver_pay: string;
    loader_pay: string;
    payment_method: string;
    settlement_status: string;
    lifecycle_status: string;
    description: string | null;
    counterparty: { name: string } | null;
  }>;
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: trip, isLoading } = useQuery<TripDetail>({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Рейс не найден');
      return res.json() as Promise<TripDetail>;
    },
    refetchInterval: 30000, // обновляем каждые 30 сек
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin text-3xl">⚙️</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-slate-600">Рейс не найден</p>
          <button onClick={() => router.push('/')} className="mt-4 text-orange-600">
            На главную
          </button>
        </div>
      </div>
    );
  }

  const isActive = trip.status === 'in_progress';
  const activeOrders = trip.trip_orders.filter((o) => o.lifecycle_status !== 'cancelled');

  const totals = {
    revenue: activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0),
    driverPay: activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0),
    loaderPay: activeOrders.reduce((s, o) => s + parseFloat(o.loader_pay), 0),
  };

  const durationMin = trip.started_at
    ? Math.floor((Date.now() - new Date(trip.started_at).getTime()) / 60000)
    : 0;

  const PAYMENT_ICONS: Record<string, string> = {
    cash: '💵',
    qr: '📱',
    bank_invoice: '🏦',
    debt_cash: '⏳',
    card_driver: '💳',
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-slate-500 text-xl">
            ←
          </button>
          <div className="text-center">
            <p className="font-bold text-slate-900">Рейс №{trip.trip_number}</p>
            <p className="text-xs text-slate-400">
              {trip.asset.short_name} ·{' '}
              {isActive ? `${formatDuration(durationMin)}` : formatDate(trip.started_at)}
            </p>
          </div>
          <LifecycleBadge
            status={trip.lifecycle_status as 'draft' | 'approved' | 'returned' | 'cancelled'}
          />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Сводка */}
        <div className="bg-white rounded-2xl p-4 shadow-sm grid grid-cols-2 gap-3">
          <Stat label="Заказов" value={String(activeOrders.length)} />
          <Stat label="Выручка" value={<Money amount={totals.revenue} />} />
          <Stat label="ЗП водителя" value={<Money amount={totals.driverPay} />} />
          {trip.loader && <Stat label="ЗП грузчика" value={<Money amount={totals.loaderPay} />} />}
        </div>

        {/* Список заказов */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Заказы ({activeOrders.length})
          </h2>
          {activeOrders.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-slate-400 text-sm">
              Заказов пока нет
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl p-3 shadow-sm border border-slate-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {order.counterparty?.name ?? 'б/н'}
                      </p>
                      {order.description && (
                        <p className="text-xs text-slate-400">{order.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Money amount={order.amount} className="font-semibold text-slate-900" />
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-sm">{PAYMENT_ICONS[order.payment_method]}</span>
                        {order.settlement_status === 'pending' && (
                          <span className="text-xs text-amber-600">долг</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    ЗП: <Money amount={order.driver_pay} />
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Кнопки действий (только для активного рейса) */}
      {isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/trip/${id}/order`}
              className="flex items-center justify-center gap-2 bg-orange-600 text-white rounded-xl py-3 font-semibold text-sm"
            >
              ➕ Заказ
            </Link>
            <Link
              href={`/trip/${id}/expense`}
              className="flex items-center justify-center gap-2 bg-slate-100 text-slate-900 rounded-xl py-3 font-semibold text-sm"
            >
              💸 Расход
            </Link>
          </div>
          <Link
            href={`/trip/${id}/finish`}
            className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white rounded-xl py-3 font-semibold"
          >
            🏁 Завершить рейс
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
```

### Шаг 6. Страница «Добавить заказ»

Создай `apps/miniapp/app/trip/[id]/order/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Button } from '@saldacargo/ui';

const schema = z.object({
  amount: z.coerce.number().positive('Введите сумму'),
  driver_pay: z.coerce.number().min(0),
  loader_pay: z.coerce.number().min(0),
  payment_method: z.enum(['cash', 'qr', 'bank_invoice', 'debt_cash', 'card_driver']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные', icon: '💵' },
  { value: 'qr', label: 'QR на р/с', icon: '📱' },
  { value: 'bank_invoice', label: 'Безнал', icon: '🏦' },
  { value: 'debt_cash', label: 'Долг', icon: '⏳' },
  { value: 'card_driver', label: 'На карту', icon: '💳' },
] as const;

// Подсказка ЗП: ~30% от суммы (TODO: брать из payroll_rules)
const SUGGEST_PERCENT = 30;

export default function AddOrderPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // idempotency_key генерируется ОДИН РАЗ при открытии формы
  const [idempotencyKey] = useState(() => uuid());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_method: 'cash',
      driver_pay: 0,
      loader_pay: 0,
    },
  });

  const amount = watch('amount');

  // Пересчитываем подсказку при изменении суммы
  const suggestedPay = amount ? Math.round((amount * SUGGEST_PERCENT) / 100) : 0;

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/trips/${tripId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        amount: String(data.amount),
        driver_pay: String(data.driver_pay),
        loader_pay: String(data.loader_pay),
        idempotency_key: idempotencyKey,
      }),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push(`/trip/${tripId}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-500 text-xl">
          ←
        </button>
        <h1 className="font-bold text-slate-900">Добавить заказ</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5 pb-28">
        {/* Сумма */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Сумма заказа, ₽</label>
          <input
            type="number"
            inputMode="numeric"
            {...register('amount')}
            placeholder="2 700"
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-2xl font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
          />
          {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
        </div>

        {/* Способ оплаты */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Способ оплаты</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="flex-shrink-0">
                <input
                  type="radio"
                  value={m.value}
                  {...register('payment_method')}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center gap-1 border-2 border-slate-200 rounded-xl px-3 py-2 cursor-pointer peer-checked:border-orange-500 peer-checked:bg-orange-50 transition-colors min-w-[72px]">
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">{m.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ЗП водителя */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">ЗП водителя, ₽</label>
          <p className="text-xs text-slate-400 mb-2">
            Подсказка: ~{suggestedPay.toLocaleString('ru-RU')} ₽ ({SUGGEST_PERCENT}%)
          </p>
          <input
            type="number"
            inputMode="numeric"
            {...register('driver_pay')}
            placeholder={String(suggestedPay)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Описание (опционально)
          </label>
          <input
            type="text"
            {...register('description')}
            placeholder="Переезд, доставка плитки..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <Button type="submit" size="hero" disabled={submitting}>
            {submitting ? 'Сохраняем...' : '✅ Добавить заказ'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### Шаг 7. Страница «Завершить рейс»

Создай `apps/miniapp/app/trip/[id]/finish/page.tsx`:

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Money } from '@saldacargo/ui';

const schema = z.object({
  odometer_end: z.coerce.number().positive('Введите одометр'),
  driver_note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function FinishTripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: trip } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      return res.json() as Promise<{
        trip_number: number;
        odometer_start: number;
        asset: { short_name: string };
        trip_orders: Array<{
          amount: string;
          driver_pay: string;
          payment_method: string;
          settlement_status: string;
          lifecycle_status: string;
        }>;
      }>;
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const odometerEnd = watch('odometer_end');
  const mileage = odometerEnd && trip?.odometer_start ? odometerEnd - trip.odometer_start : 0;

  const activeOrders = (trip?.trip_orders ?? []).filter((o) => o.lifecycle_status !== 'cancelled');
  const revenue = activeOrders.reduce((s, o) => s + parseFloat(o.amount), 0);
  const driverPay = activeOrders.reduce((s, o) => s + parseFloat(o.driver_pay), 0);
  const debtOrders = activeOrders.filter((o) => o.settlement_status === 'pending');

  async function onSubmit(data: FormData) {
    if (mileage < 0) {
      setError('Конечный одометр не может быть меньше начального');
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/trips/${id}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const result = (await res.json()) as { error?: string };
      setError(result.error ?? 'Ошибка');
      setSubmitting(false);
      return;
    }

    router.push('/');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-500 text-xl">
          ←
        </button>
        <h1 className="font-bold text-slate-900">Завершить рейс</h1>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4 pb-28">
        {/* Сводка */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <h2 className="font-semibold text-slate-900 mb-3">Итоги рейса</h2>
          <SummaryRow label="Заказов" value={String(activeOrders.length)} />
          <SummaryRow label="Выручка" value={<Money amount={revenue} />} />
          <SummaryRow label="ЗП водителя" value={<Money amount={driverPay} />} />
          {debtOrders.length > 0 && (
            <SummaryRow
              label="⏳ Долги"
              value={
                <span className="text-amber-600">
                  <Money amount={debtOrders.reduce((s, o) => s + parseFloat(o.amount), 0)} /> (
                  {debtOrders.length} кл.)
                </span>
              }
            />
          )}
          {mileage > 0 && <SummaryRow label="Пробег" value={`${mileage} км`} />}
        </div>

        {/* Конечный одометр */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Конечный одометр (км)
          </label>
          {trip && (
            <p className="text-xs text-slate-400 mb-2">
              Начальный: {trip.odometer_start.toLocaleString('ru-RU')} км
            </p>
          )}
          <input
            type="number"
            inputMode="numeric"
            {...register('odometer_end')}
            placeholder="340 160"
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-2xl font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
          />
          {errors.odometer_end && (
            <p className="text-red-500 text-sm mt-1">{errors.odometer_end.message}</p>
          )}
        </div>

        {/* Заметка */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Заметка для админа (опционально)
          </label>
          <textarea
            {...register('driver_note')}
            rows={3}
            placeholder="Всё хорошо / Стучит подвеска / Клиент просил перезвонить"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <Button type="submit" size="hero" disabled={submitting}>
            {submitting ? 'Отправляем...' : '📤 Отправить на ревью'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
```

### Шаг 8. Заглушка для расходов

Создай `apps/miniapp/app/trip/[id]/expense/page.tsx`:

```tsx
'use client';
import { useRouter, useParams } from 'next/navigation';

export default function ExpensePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-500 text-xl">
          ←
        </button>
        <h1 className="font-bold text-slate-900">Добавить расход</h1>
      </header>
      <div className="p-4 text-center mt-20 text-slate-400">
        <p className="text-4xl mb-4">💸</p>
        <p>Расходы — следующая итерация</p>
        <button
          onClick={() => router.push(`/trip/${id}`)}
          className="mt-6 text-orange-600 font-medium"
        >
          ← Назад к рейсу
        </button>
      </div>
    </div>
  );
}
```

### Шаг 9. Проверка

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

Открой `docs/design/driver/03-trip-active.html` в браузере и сверь с реализацией.

### Шаг 10. Коммит

```powershell
git add .
git commit -m "feat: полный flow рейса водителя (MiniApp)

- /trip/new — форма начала рейса (машина, тип, грузчик, одометр)
- /trip/:id — активный рейс (сводка, список заказов, кнопки)
- /trip/:id/order — добавить заказ с подсказкой ЗП 30%
- /trip/:id/finish — завершить рейс (одометр, заметка, сводка)
- API routes: POST /trips, GET/PATCH /trips/:id, POST /trips/:id/orders
- Idempotency key на всех мутациях
- Двухосный статус: lifecycle=draft, settlement по способу оплаты"
git push
```

---

## Критерии приёмки

- [ ] Дизайн `/trip/:id` совпадает с `docs/design/driver/03-trip-active.html`
- [ ] `/trip/new` — форма создания рейса работает
- [ ] Создание рейса → редирект на `/trip/:id`
- [ ] Добавление заказа → появляется в списке
- [ ] `/trip/:id/finish` — кнопка «Отправить на ревью» меняет статус в БД
- [ ] Idempotency key генерируется при открытии каждой формы
- [ ] `pnpm typecheck` зелёный
- [ ] `pnpm build` зелёный
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не реализуй офлайн/IndexedDB — следующая итерация
- ❌ Не реализуй расходы полностью — заглушка достаточна
- ❌ Не реализуй фото одометра — следующая итерация
- ❌ Не добавляй интеграцию с Wialon/Опти24

---

## Отчёт

```
✅ TASK_12 выполнено

Экраны:
- /trip/new ✓
- /trip/:id ✓
- /trip/:id/order ✓
- /trip/:id/finish ✓
- /trip/:id/expense (заглушка) ✓

API routes: 5 штук ✓
Дизайн: совпадает с референсом ✓

Команды:
- pnpm typecheck ✓
- pnpm build ✓

Git: push успешно
```
