<!-- BOOT: Перед выполнением прочитай docs/BOOT.md -->

<context>
Money Map готова (005). Теперь нужен Mini App для водителей (apps/miniapp) —
самый важный модуль с точки зрения бизнеса. Водители через него вводят данные
каждый день: начинают рейс, добавляют заказы с ЗП, фиксируют расходы,
завершают рейс и отправляют на ревью. Всё в draft — admin потом подтверждает.
Mini App — мобильный интерфейс, упор на простоту и скорость ввода.

ЗАВИСИМОСТИ: 003_supabase_client, 004_setup_wizard
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ:
  - apps/miniapp/src/app/page.tsx
  - apps/miniapp/src/app/layout.tsx
  - apps/miniapp/src/app/trip/new/page.tsx
  - apps/miniapp/src/app/trip/[id]/page.tsx
  - apps/miniapp/src/app/trip/[id]/order/new/page.tsx
  - apps/miniapp/src/app/trip/[id]/expense/new/page.tsx
  - apps/miniapp/src/app/trip/[id]/complete/page.tsx
  - apps/miniapp/src/app/api/trips/start/route.ts
  - apps/miniapp/src/app/api/trips/[id]/route.ts
  - apps/miniapp/src/app/api/trips/[id]/orders/route.ts
  - apps/miniapp/src/app/api/trips/[id]/expenses/route.ts
  - apps/miniapp/src/app/api/trips/[id]/complete/route.ts
  - apps/miniapp/src/app/api/drivers/route.ts
  - apps/miniapp/src/app/api/assets/route.ts
  - apps/miniapp/src/lib/hooks/useTrip.ts
ТИП: feat
</context>

<task>

/* ============================================================
   БЛОК 1: API ROUTES
   ============================================================ */

1. Создать apps/miniapp/src/app/api/assets/route.ts
   (список машин для выбора при старте рейса):

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('assets')
      .select(`
        id, plate_number, notes, status,
        asset_types ( code, name )
      `)
      .eq('status', 'active')
      .order('plate_number')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[assets] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки машин' }, { status: 500 })
  }
}
```

2. Создать apps/miniapp/src/app/api/drivers/route.ts
   (список водителей и грузчиков для выбора экипажа):

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('role', ['driver', 'loader'])
      .eq('is_active', true)
      .order('full_name')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[drivers] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки персонала' }, { status: 500 })
  }
}
```

3. Создать apps/miniapp/src/app/api/trips/start/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { asset_id, driver_id, loader_id, odometer_start, trip_type } = body

    if (!asset_id || !driver_id) {
      return NextResponse.json(
        { error: 'Машина и водитель обязательны' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('trips')
      .insert({
        asset_id,
        driver_id,
        loader_id: loader_id || null,
        trip_type: trip_type || 'local',
        started_at: new Date().toISOString(),
        odometer_start: odometer_start || null,
        lifecycle_status: 'draft',
        status: 'in_progress',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[trips/start] Error:', error)
    return NextResponse.json({ error: 'Ошибка создания рейса' }, { status: 500 })
  }
}
```

4. Создать apps/miniapp/src/app/api/trips/[id]/route.ts
   (получить детали рейса с заказами и расходами):

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        *,
        assets ( plate_number, asset_types ( code, name ) ),
        driver:users!trips_driver_id_fkey ( id, full_name ),
        loader:users!trips_loader_id_fkey ( id, full_name )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    const { data: orders } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('trip_id', id)
      .order('order_number')

    const { data: expenses } = await supabase
      .from('trip_expenses')
      .select('*, categories ( code, name )')
      .eq('trip_id', id)

    // Сводка
    const totalRevenue = (orders || []).reduce((s, o) => s + Number(o.amount), 0)
    const totalDriverPay = (orders || []).reduce((s, o) => s + Number(o.driver_pay), 0)
    const totalLoaderPay = (orders || []).reduce((s, o) => s + Number(o.loader_pay || 0), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
    const profit = totalRevenue - totalDriverPay - totalLoaderPay - totalExpenses

    return NextResponse.json({
      trip,
      orders: orders || [],
      expenses: expenses || [],
      summary: {
        ordersCount: (orders || []).length,
        totalRevenue: Math.round(totalRevenue),
        totalDriverPay: Math.round(totalDriverPay),
        totalLoaderPay: Math.round(totalLoaderPay),
        totalExpenses: Math.round(totalExpenses),
        profit: Math.round(profit),
      },
    })
  } catch (error) {
    console.error('[trips/id] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки рейса' }, { status: 500 })
  }
}
```

5. Создать apps/miniapp/src/app/api/trips/[id]/orders/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trip_id } = await params
    const body = await request.json()
    const {
      client_name,
      amount,
      driver_pay,
      loader_pay,
      payment_method,
    } = body

    if (!amount || !payment_method) {
      return NextResponse.json(
        { error: 'Сумма и способ оплаты обязательны' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Следующий номер заказа в рейсе
    const { data: existing } = await supabase
      .from('trip_orders')
      .select('order_number')
      .eq('trip_id', trip_id)
      .order('order_number', { ascending: false })
      .limit(1)

    const nextNumber = existing && existing.length > 0
      ? existing[0].order_number + 1
      : 1

    const driverPayNum = Number(driver_pay) || 0
    const amountNum = Number(amount)
    const driverPayPercent = amountNum > 0
      ? Math.round((driverPayNum / amountNum) * 100 * 10) / 10
      : 0

    const settlementStatus =
      payment_method === 'bank_invoice' || payment_method === 'debt_cash'
        ? 'pending'
        : 'completed'

    const { data, error } = await supabase
      .from('trip_orders')
      .insert({
        trip_id,
        order_number: nextNumber,
        client_name: client_name || 'б/н',
        amount: amountNum,
        driver_pay: driverPayNum,
        loader_pay: Number(loader_pay) || 0,
        driver_pay_percent: driverPayPercent,
        payment_method,
        settlement_status: settlementStatus,
        idempotency_key: randomUUID(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[trips/orders] Error:', error)
    return NextResponse.json({ error: 'Ошибка добавления заказа' }, { status: 500 })
  }
}
```

6. Создать apps/miniapp/src/app/api/trips/[id]/expenses/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trip_id } = await params
    const body = await request.json()
    const { category_code, amount, payment_method, description } = body

    if (!amount || !category_code) {
      return NextResponse.json(
        { error: 'Сумма и категория обязательны' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('code', category_code)
      .single()

    if (!category) {
      return NextResponse.json({ error: 'Категория не найдена' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id,
        category_id: category.id,
        amount: Number(amount),
        payment_method: payment_method || 'cash',
        description: description || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[trips/expenses] Error:', error)
    return NextResponse.json({ error: 'Ошибка добавления расхода' }, { status: 500 })
  }
}
```

7. Создать apps/miniapp/src/app/api/trips/[id]/complete/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { odometer_end } = body

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        lifecycle_status: 'draft',
        ended_at: new Date().toISOString(),
        odometer_end: odometer_end || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Обновить одометр машины
    if (odometer_end && data.asset_id) {
      await supabase
        .from('assets')
        .update({ odometer_current: odometer_end })
        .eq('id', data.asset_id)
    }

    return NextResponse.json({ success: true, trip: data })
  } catch (error) {
    console.error('[trips/complete] Error:', error)
    return NextResponse.json({ error: 'Ошибка завершения рейса' }, { status: 500 })
  }
}
```

/* ============================================================
   БЛОК 2: ХУКИ
   ============================================================ */

8. Создать apps/miniapp/src/lib/hooks/useTrip.ts:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TripOrder {
  id: string
  order_number: number
  client_name: string
  amount: number
  driver_pay: number
  loader_pay: number
  driver_pay_percent: number
  payment_method: string
  settlement_status: string
}

export interface TripExpense {
  id: string
  amount: number
  description: string
  payment_method: string
  categories: { code: string; name: string }
}

export interface TripSummary {
  ordersCount: number
  totalRevenue: number
  totalDriverPay: number
  totalLoaderPay: number
  totalExpenses: number
  profit: number
}

export function useTrip(tripId: string) {
  const [trip, setTrip] = useState<Record<string, unknown> | null>(null)
  const [orders, setOrders] = useState<TripOrder[]>([])
  const [expenses, setExpenses] = useState<TripExpense[]>([])
  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) throw new Error('Ошибка загрузки рейса')
      const data = await res.json()
      setTrip(data.trip)
      setOrders(data.orders)
      setExpenses(data.expenses)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { load() }, [load])

  return { trip, orders, expenses, summary, loading, error, reload: load }
}
```

/* ============================================================
   БЛОК 3: СТРАНИЦЫ
   ============================================================ */

9. Обновить apps/miniapp/src/app/layout.tsx:

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SaldaCargo — Водитель',
  description: 'Путевые листы и рейсы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-50 min-h-screen max-w-md mx-auto">
        {children}
      </body>
    </html>
  )
}
```

10. Создать apps/miniapp/src/app/page.tsx
    (главная водителя — выбор водителя и кнопка "Начать рейс"):

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Driver {
  id: string
  full_name: string
  role: string
}

export default function DriverHome() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/drivers')
        const data = await res.json()
        setDrivers(data.filter((d: Driver) => d.role === 'driver'))
      } catch (err) {
        console.error('[DriverHome] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleStart = () => {
    if (!selectedDriver) return
    router.push(`/trip/new?driver_id=${selectedDriver}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-6">
      {/* Шапка */}
      <div className="pt-6 pb-2">
        <h1 className="text-2xl font-bold text-slate-800">SaldaCargo</h1>
        <p className="text-slate-500 text-sm mt-1">Путевые листы</p>
      </div>

      {/* Выбор водителя */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Кто вы?
        </label>
        <select
          className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
          value={selectedDriver}
          onChange={e => setSelectedDriver(e.target.value)}
        >
          <option value="">— Выберите водителя —</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
        </select>
      </div>

      {/* Кнопка начать рейс */}
      <button
        onClick={handleStart}
        disabled={!selectedDriver}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 disabled:cursor-not-allowed
                   active:bg-blue-700 transition-colors"
      >
        🚚 Начать рейс
      </button>
    </div>
  )
}
```

11. Создать apps/miniapp/src/app/trip/new/page.tsx:

```typescript
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Asset {
  id: string
  plate_number: string
  notes: string
  asset_types: { code: string; name: string }
}

interface User {
  id: string
  full_name: string
  role: string
}

function NewTripForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const driverId = searchParams.get('driver_id') || ''

  const [assets, setAssets] = useState<Asset[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    asset_id: '',
    loader_id: '',
    trip_type: 'local',
    odometer_start: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [assetsRes, usersRes] = await Promise.all([
          fetch('/api/assets'),
          fetch('/api/drivers'),
        ])
        setAssets(await assetsRes.json())
        setUsers(await usersRes.json())
      } catch (err) {
        console.error('[NewTrip] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async () => {
    if (!form.asset_id) {
      setError('Выберите машину')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/trips/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: form.asset_id,
          driver_id: driverId,
          loader_id: form.loader_id || null,
          trip_type: form.trip_type,
          odometer_start: form.odometer_start ? Number(form.odometer_start) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push(`/trip/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const loaders = users.filter(u => u.role === 'loader' || u.role === 'driver')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Начало рейса</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Машина */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Машина *</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={form.asset_id}
            onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}
          >
            <option value="">— Выберите машину —</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>
                {a.plate_number} — {a.asset_types?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Грузчик */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Грузчик</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={form.loader_id}
            onChange={e => setForm(f => ({ ...f, loader_id: e.target.value }))}
          >
            <option value="">— Без грузчика —</option>
            {loaders.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {/* Тип рейса */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тип рейса</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'local', label: '🏙 Город' },
              { value: 'intercity', label: '🛣 Межгород' },
              { value: 'moving', label: '📦 Переезд' },
              { value: 'hourly', label: '⏱ Почасовой' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, trip_type: t.value }))}
                className={`py-2 px-3 rounded-lg text-sm border transition-colors ${
                  form.trip_type === t.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Одометр */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Одометр начальный (км)
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="340000"
            value={form.odometer_start}
            onChange={e => setForm(f => ({ ...f, odometer_start: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !form.asset_id}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-blue-700 transition-colors"
      >
        {submitting ? 'Создаём рейс...' : '▶ ПОЕХАЛИ'}
      </button>
    </div>
  )
}

export default function NewTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><p className="text-slate-400">Загрузка...</p></div>}>
      <NewTripForm />
    </Suspense>
  )
}
```

12. Создать apps/miniapp/src/app/trip/[id]/page.tsx
    (активный рейс — список заказов, кнопки добавить/завершить):

```typescript
'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useTrip } from '@/lib/hooks/useTrip'

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Нал',
  qr: '📱 QR',
  bank_invoice: '🏦 Счёт',
  debt_cash: '⏳ Долг',
  card_driver: '💳 Карта',
}

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { trip, orders, expenses, summary, loading, error } = useTrip(id)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка рейса...</p>
    </div>
  )

  if (error) return (
    <div className="p-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        ❌ {error}
      </div>
    </div>
  )

  const tripData = trip as Record<string, unknown>
  const assets = tripData?.assets as Record<string, unknown>
  const assetTypes = assets?.asset_types as Record<string, unknown>
  const driver = tripData?.driver as Record<string, unknown>
  const loader = tripData?.loader as Record<string, unknown>

  return (
    <div className="pb-32">
      {/* Шапка рейса */}
      <div className="bg-slate-800 text-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold">
            🚚 {assets?.plate_number as string}
          </span>
          <span className="text-slate-400 text-sm">
            {assetTypes?.name as string}
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          {driver?.full_name as string}
          {loader ? ` + ${loader.full_name as string}` : ''}
        </p>
      </div>

      {/* Сводка */}
      {summary && (
        <div className="bg-slate-700 text-white px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-slate-400">Выручка</p>
            <p className="font-bold text-sm">{fmt(summary.totalRevenue)} ₽</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">ЗП вод.</p>
            <p className="font-bold text-sm">{fmt(summary.totalDriverPay)} ₽</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Прибыль</p>
            <p className={`font-bold text-sm ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(summary.profit)} ₽
            </p>
          </div>
        </div>
      )}

      {/* Список заказов */}
      <div className="p-4 space-y-2">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          Заказы ({orders.length})
        </h2>
        {orders.length === 0 && (
          <p className="text-slate-400 text-sm py-4 text-center">Нет заказов</p>
        )}
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 mr-2">#{order.order_number}</span>
                <span className="font-medium text-slate-800">{order.client_name}</span>
              </div>
              <span className="font-bold text-slate-800">{fmt(order.amount)} ₽</span>
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>
                ЗП: {fmt(order.driver_pay)} ₽
                {order.loader_pay > 0 && ` + ${fmt(order.loader_pay)} ₽`}
                {' '}({order.driver_pay_percent}%)
              </span>
              <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
            </div>
          </div>
        ))}

        {/* Расходы */}
        {expenses.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide pt-2">
              Расходы
            </h2>
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-700">
                    {exp.categories?.name || exp.description || 'Расход'}
                  </span>
                  <span className="font-medium text-red-600">−{fmt(exp.amount)} ₽</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Нижние кнопки */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push(`/trip/${id}/order/new`)}
            className="py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700"
          >
            ➕ Заказ
          </button>
          <button
            onClick={() => router.push(`/trip/${id}/expense/new`)}
            className="py-3 bg-slate-100 text-slate-700 font-bold rounded-xl active:bg-slate-200"
          >
            💸 Расход
          </button>
        </div>
        <button
          onClick={() => router.push(`/trip/${id}/complete`)}
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl active:bg-green-700"
        >
          🏁 Завершить рейс
        </button>
      </div>
    </div>
  )
}
```

13. Создать apps/miniapp/src/app/trip/[id]/order/new/page.tsx:

```typescript
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Нал' },
  { value: 'qr', label: '📱 QR' },
  { value: 'bank_invoice', label: '🏦 Счёт' },
  { value: 'debt_cash', label: '⏳ Долг' },
  { value: 'card_driver', label: '💳 Карта' },
]

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState({
    client_name: '',
    amount: '',
    driver_pay: '',
    loader_pay: '',
    payment_method: 'cash',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Подсказка 30%
  const hint = form.amount
    ? Math.round(Number(form.amount) * 0.3)
    : null

  const handleSubmit = async () => {
    if (!form.amount) {
      setError('Введите сумму')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: form.client_name || 'б/н',
          amount: Number(form.amount),
          driver_pay: Number(form.driver_pay) || 0,
          loader_pay: Number(form.loader_pay) || 0,
          payment_method: form.payment_method,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push(`/trip/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Новый заказ</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Клиент */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Клиент</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="Левша, Интерьер, б/н..."
            value={form.client_name}
            onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
          />
        </div>

        {/* Сумма */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Сумма заказа *</label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="2700"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>

        {/* ЗП водителя */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ЗП водителя
            {hint && <span className="text-slate-400 font-normal"> (подсказка: ~{hint.toLocaleString('ru-RU')} ₽ / 30%)</span>}
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder={hint ? String(hint) : '0'}
            value={form.driver_pay}
            onChange={e => setForm(f => ({ ...f, driver_pay: e.target.value }))}
          />
        </div>

        {/* ЗП грузчика */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ЗП грузчика
            {hint && <span className="text-slate-400 font-normal"> (подсказка: ~{hint.toLocaleString('ru-RU')} ₽)</span>}
          </label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="0"
            value={form.loader_pay}
            onChange={e => setForm(f => ({ ...f, loader_pay: e.target.value }))}
          />
        </div>

        {/* Способ оплаты */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Оплата</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                className={`py-2 px-2 rounded-lg text-sm border transition-colors ${
                  form.payment_method === m.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !form.amount}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-blue-700 transition-colors"
      >
        {submitting ? 'Сохраняем...' : '✅ ДОБАВИТЬ'}
      </button>
    </div>
  )
}
```

14. Создать apps/miniapp/src/app/trip/[id]/expense/new/page.tsx:

```typescript
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

const EXPENSE_CATEGORIES = [
  { code: 'FUEL', label: '⛽ ГСМ' },
  { code: 'PARKING_EXPENSE', label: '🅿️ Стоянка' },
  { code: 'WASH', label: '🚿 Мойка' },
  { code: 'TOLL_ROAD', label: '🛣 Платная дорога' },
  { code: 'REPAIR_PARTS', label: '🔧 Ремонт' },
  { code: 'OTHER_EXPENSE', label: '📋 Прочее' },
]

export default function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = use(params)
  const router = useRouter()

  const [form, setForm] = useState({
    category_code: 'FUEL',
    amount: '',
    payment_method: 'cash',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.amount) {
      setError('Введите сумму')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_code: form.category_code,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          description: form.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push(`/trip/${tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Расход</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Категория */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Категория</label>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map(c => (
              <button
                key={c.code}
                onClick={() => setForm(f => ({ ...f, category_code: c.code }))}
                className={`py-2 px-3 rounded-lg text-sm border text-left transition-colors ${
                  form.category_code === c.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Сумма */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Сумма *</label>
          <input
            type="number"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            placeholder="1000"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>

        {/* Оплата */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Оплата</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'cash', label: '💵 Нал' },
              { value: 'card_driver', label: '💳 Карта' },
              { value: 'fuel_card', label: '⛽ Опти24' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                className={`py-2 rounded-lg text-sm border transition-colors ${
                  form.payment_method === m.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Заметка */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Заметка</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Необязательно"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !form.amount}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-blue-700 transition-colors"
      >
        {submitting ? 'Сохраняем...' : '✅ ДОБАВИТЬ'}
      </button>
    </div>
  )
}
```

15. Создать apps/miniapp/src/app/trip/[id]/complete/page.tsx:

```typescript
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTrip } from '@/lib/hooks/useTrip'

export default function CompleteTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { summary, loading } = useTrip(id)

  const [odometerEnd, setOdometerEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const handleComplete = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odometer_end: odometerEnd ? Number(odometerEnd) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-slate-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => router.back()} className="text-slate-400 text-xl">←</button>
        <h1 className="text-xl font-bold text-slate-800">Завершение рейса</h1>
      </div>

      {/* Итоги */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-700">Итоги рейса</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Заказов', value: String(summary.ordersCount) },
              { label: 'Выручка', value: `${fmt(summary.totalRevenue)} ₽` },
              { label: 'ЗП водителя', value: `${fmt(summary.totalDriverPay)} ₽` },
              { label: 'ЗП грузчика', value: `${fmt(summary.totalLoaderPay)} ₽` },
              { label: 'Расходы', value: `${fmt(summary.totalExpenses)} ₽` },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-medium text-slate-800">{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700">Прибыль фирмы</span>
              <span className={`font-bold text-lg ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(summary.profit)} ₽
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Одометр */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Одометр конечный (км)
        </label>
        <input
          type="number"
          className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
          placeholder="340060"
          value={odometerEnd}
          onChange={e => setOdometerEnd(e.target.value)}
        />
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        ⚠️ После отправки рейс уйдёт на ревью администратору. Редактирование будет недоступно.
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={submitting}
        className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl
                   disabled:opacity-40 active:bg-green-700 transition-colors"
      >
        {submitting ? 'Отправляем...' : '📤 ОТПРАВИТЬ НА РЕВЬЮ'}
      </button>
    </div>
  )
}
```

16. Запустить miniapp локально (порт 3001):
    cd apps/miniapp && pnpm dev -- --port 3001

17. Закоммитить:
    git add .
    git commit -m "feat: Mini App водителя — рейсы, заказы, расходы, завершение"
    git push origin main

18. ВЕРИФИКАЦИЯ (полный сценарий):
    А) Открыть http://localhost:3001
    Б) Виден список водителей, выбрать любого → кнопка "Начать рейс" активна
    В) Нажать "Начать рейс" → страница /trip/new
    Г) Выбрать машину, тип рейса → нажать "ПОЕХАЛИ"
    Д) Открылась страница /trip/[id] с пустым списком заказов
    Е) Нажать "➕ Заказ" → форма нового заказа
    Ж) Заполнить: клиент "Тест", сумма 2700, ЗП 800, оплата Нал → "ДОБАВИТЬ"
    З) Вернулись к рейсу — заказ появился в списке, сводка обновилась
    И) Нажать "💸 Расход" → форма расхода
    К) Заполнить: ГСМ, 1000₽, Нал → "ДОБАВИТЬ"
    Л) Нажать "🏁 Завершить рейс" → экран с итогами
    М) Нажать "📤 ОТПРАВИТЬ НА РЕВЬЮ" → редирект на главную /
    Н) Проверить в Supabase Dashboard: trips таблица — новая запись со status=completed, lifecycle_status=draft

19. Заполнить COMPLETION LOG.
20. Перенести файл из tasks/todo/ в tasks/done/.
21. Обновить docs/BRIEF.md — отметить 006 выполненным.
</task>

<rules>
- Все страницы miniapp — 'use client' (SPA для мобильного)
- ASYNC/AWAIT: handleSubmit, handleComplete — await fetch ПЕРЕД router.push()
- Try/catch обязателен в каждом обработчике и API route
- НЕ использовать createAdminClient в клиентских компонентах — только в API routes
- idempotency_key при создании trip_orders — randomUUID() (уже реализовано в п.5)
- Подсказка ЗП = 30% от суммы — только подсказка, водитель вводит своё
- Язык UI: русский везде
- Мобильный дизайн: кнопки min-height 48px, крупный текст, удобные touch targets
- НЕ трогать файлы apps/web/ — только apps/miniapp/
- ПРОТОКОЛ ОШИБКИ: если /api/trips/start возвращает 500 — показать текст ошибки
  в форме и НЕ делать redirect. Уже реализовано через state error.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:** Реализованы API, хуки и страницы для работы водителя с рейсами. Исправлена проблема с отсутствующей колонкой idempotency_key.
**Результат верификации:** [x] Успешно