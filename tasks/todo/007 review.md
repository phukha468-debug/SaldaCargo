<!-- BOOT: Перед выполнением прочитай docs/BOOT.md -->

<context>
Mini App водителя готов (006). Теперь нужен экран ревью смены в apps/web —
администратор каждый вечер проверяет рейсы водителей и подтверждает их.
После подтверждения lifecycle_status → approved, и транзакции попадают в P&L
и балансы кошельков на главной (Money Map).
Без этого таска деньги не считаются в системе.

ЗАВИСИМОСТИ: 005_money_map, 006_miniapp_driver
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ:
  - apps/web/src/app/review/page.tsx
  - apps/web/src/app/api/review/route.ts
  - apps/web/src/app/api/review/[tripId]/approve/route.ts
  - apps/web/src/components/review/ReviewPage.tsx
  - apps/web/src/components/review/TripReviewCard.tsx
  - apps/web/src/app/page.tsx (добавить ссылку на /review)
ТИП: feat
</context>

<task>

/* ============================================================
   БЛОК 1: API ROUTES
   ============================================================ */

1. Создать apps/web/src/app/api/review/route.ts
   (список рейсов ожидающих ревью):

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = createAdminClient()

    const dateStart = `${date}T00:00:00.000Z`
    const dateEnd = `${date}T23:59:59.999Z`

    // Рейсы за дату в статусе completed + draft (ожидают ревью)
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        id, started_at, ended_at, status, lifecycle_status,
        trip_type, odometer_start, odometer_end,
        assets ( plate_number, asset_types ( code, name ) ),
        driver:users!trips_driver_id_fkey ( id, full_name ),
        loader:users!trips_loader_id_fkey ( id, full_name )
      `)
      .eq('status', 'completed')
      .eq('lifecycle_status', 'draft')
      .gte('ended_at', dateStart)
      .lte('ended_at', dateEnd)
      .order('ended_at', { ascending: true })

    if (error) throw error

    // Для каждого рейса подгружаем заказы и расходы
    const tripsWithDetails = await Promise.all(
      (trips || []).map(async (trip) => {
        const { data: orders } = await supabase
          .from('trip_orders')
          .select('*')
          .eq('trip_id', trip.id)
          .order('order_number')

        const { data: expenses } = await supabase
          .from('trip_expenses')
          .select('*, categories ( code, name )')
          .eq('trip_id', trip.id)

        const totalRevenue = (orders || []).reduce((s, o) => s + Number(o.amount), 0)
        const totalDriverPay = (orders || []).reduce((s, o) => s + Number(o.driver_pay), 0)
        const totalLoaderPay = (orders || []).reduce((s, o) => s + Number(o.loader_pay || 0), 0)
        const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
        const profit = totalRevenue - totalDriverPay - totalLoaderPay - totalExpenses
        const avgDriverPercent = totalRevenue > 0
          ? Math.round((totalDriverPay / totalRevenue) * 100 * 10) / 10
          : 0

        return {
          ...trip,
          orders: orders || [],
          expenses: expenses || [],
          summary: {
            totalRevenue: Math.round(totalRevenue),
            totalDriverPay: Math.round(totalDriverPay),
            totalLoaderPay: Math.round(totalLoaderPay),
            totalExpenses: Math.round(totalExpenses),
            profit: Math.round(profit),
            avgDriverPercent,
            ordersCount: (orders || []).length,
          },
        }
      })
    )

    // Итого за день
    const dayTotal = tripsWithDetails.reduce(
      (acc, t) => ({
        revenue: acc.revenue + t.summary.totalRevenue,
        driverPay: acc.driverPay + t.summary.totalDriverPay,
        loaderPay: acc.loaderPay + t.summary.totalLoaderPay,
        expenses: acc.expenses + t.summary.totalExpenses,
        profit: acc.profit + t.summary.profit,
      }),
      { revenue: 0, driverPay: 0, loaderPay: 0, expenses: 0, profit: 0 }
    )

    return NextResponse.json({
      date,
      trips: tripsWithDetails,
      dayTotal,
    })
  } catch (error) {
    console.error('[review] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки ревью' }, { status: 500 })
  }
}
```

2. Создать apps/web/src/app/api/review/[tripId]/approve/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = createAdminClient()

    // 1. Подтверждаем рейс
    const { error: tripError } = await supabase
      .from('trips')
      .update({
        lifecycle_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', tripId)

    if (tripError) throw tripError

    // 2. Получаем заказы рейса
    const { data: orders, error: ordersError } = await supabase
      .from('trip_orders')
      .select('id, amount, driver_pay, loader_pay, payment_method, linked_income_tx_id')
      .eq('trip_id', tripId)

    if (ordersError) throw ordersError

    // 3. Получаем нужные кошельки
    const { data: wallets } = await supabase
      .from('wallets')
      .select('id, code')

    const walletMap = Object.fromEntries(
      (wallets || []).map(w => [w.code, w.id])
    )

    // 4. Получаем категории
    const { data: categories } = await supabase
      .from('categories')
      .select('id, code')

    const categoryMap = Object.fromEntries(
      (categories || []).map(c => [c.code, c.id])
    )

    // 5. Создаём транзакции для каждого заказа
    const transactionsToInsert = []

    for (const order of (orders || [])) {
      const toWalletCode = order.payment_method === 'qr' || order.payment_method === 'bank_invoice'
        ? 'ip_rs'
        : order.payment_method === 'debt_cash'
        ? 'cash_office'
        : 'cash_office' // cash и card_driver = касса/подотчёт

      const settlementStatus =
        order.payment_method === 'bank_invoice' || order.payment_method === 'debt_cash'
          ? 'pending'
          : 'completed'

      // Доход от заказа
      transactionsToInsert.push({
        direction: 'income',
        amount: Number(order.amount),
        from_wallet_id: walletMap['ext_clients'],
        to_wallet_id: walletMap[toWalletCode] || walletMap['cash_office'],
        category_id: categoryMap['FREIGHT_LCV_CITY'],
        trip_id: tripId,
        lifecycle_status: 'approved',
        settlement_status: settlementStatus,
        transaction_type: 'regular',
        actual_date: new Date().toISOString().split('T')[0],
        description: 'Доход от заказа',
      })

      // ЗП водителя
      if (Number(order.driver_pay) > 0) {
        transactionsToInsert.push({
          direction: 'expense',
          amount: Number(order.driver_pay),
          from_wallet_id: walletMap['cash_office'],
          to_wallet_id: walletMap['ext_suppliers'],
          category_id: categoryMap['PAYROLL_DRIVER'],
          trip_id: tripId,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          transaction_type: 'payroll',
          actual_date: new Date().toISOString().split('T')[0],
          description: 'ЗП водителя',
        })
      }

      // ЗП грузчика
      if (Number(order.loader_pay) > 0) {
        transactionsToInsert.push({
          direction: 'expense',
          amount: Number(order.loader_pay),
          from_wallet_id: walletMap['cash_office'],
          to_wallet_id: walletMap['ext_suppliers'],
          category_id: categoryMap['PAYROLL_LOADER'],
          trip_id: tripId,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          transaction_type: 'payroll',
          actual_date: new Date().toISOString().split('T')[0],
          description: 'ЗП грузчика',
        })
      }
    }

    // 6. Расходы рейса (ГСМ и т.д.)
    const { data: expenses } = await supabase
      .from('trip_expenses')
      .select('*')
      .eq('trip_id', tripId)

    for (const expense of (expenses || [])) {
      transactionsToInsert.push({
        direction: 'expense',
        amount: Number(expense.amount),
        from_wallet_id: walletMap['cash_office'],
        to_wallet_id: walletMap['ext_suppliers'],
        category_id: expense.category_id,
        trip_id: tripId,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_type: 'regular',
        actual_date: new Date().toISOString().split('T')[0],
        description: expense.description || 'Расход в рейсе',
      })
    }

    // 7. Вставляем все транзакции
    if (transactionsToInsert.length > 0) {
      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)

      if (txError) throw txError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[review/approve] Error:', error)
    return NextResponse.json({ error: 'Ошибка подтверждения' }, { status: 500 })
  }
}
```

/* ============================================================
   БЛОК 2: КОМПОНЕНТЫ
   ============================================================ */

3. Создать apps/web/src/components/review/TripReviewCard.tsx:

```typescript
'use client'

import { useState } from 'react'

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Нал',
  qr: '📱 QR',
  bank_invoice: '🏦 Счёт',
  debt_cash: '⏳ Долг',
  card_driver: '💳 Карта',
}

interface Order {
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

interface Expense {
  id: string
  amount: number
  description: string
  categories: { code: string; name: string }
}

interface TripSummary {
  totalRevenue: number
  totalDriverPay: number
  totalLoaderPay: number
  totalExpenses: number
  profit: number
  avgDriverPercent: number
  ordersCount: number
}

interface TripReviewCardProps {
  trip: {
    id: string
    assets: { plate_number: string; asset_types: { name: string } }
    driver: { id: string; full_name: string }
    loader?: { id: string; full_name: string }
    orders: Order[]
    expenses: Expense[]
    summary: TripSummary
  }
  onApprove: (tripId: string) => Promise<void>
}

export default function TripReviewCard({ trip, onApprove }: TripReviewCardProps) {
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      await onApprove(trip.id)
      setApproved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setApproving(false)
    }
  }

  if (approved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-medium">
        ✅ {trip.assets.plate_number} — подтверждён
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Заголовок */}
      <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <span className="font-bold">🚚 {trip.assets.plate_number}</span>
          <span className="text-slate-400 text-sm ml-2">{trip.assets.asset_types?.name}</span>
        </div>
        <div className="text-sm text-slate-300">
          {trip.driver.full_name}
          {trip.loader && ` + ${trip.loader.full_name}`}
        </div>
      </div>

      {/* Таблица заказов */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 text-slate-500 font-medium">#</th>
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Клиент</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">Сумма</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">ЗП вод.</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">%</th>
              {trip.loader && (
                <th className="text-right px-3 py-2 text-slate-500 font-medium">ЗП гр.</th>
              )}
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Оплата</th>
            </tr>
          </thead>
          <tbody>
            {trip.orders.map(order => {
              const pct = order.driver_pay_percent
              const isWarning = pct > 40 || pct < 25
              return (
                <tr key={order.id} className={`border-b border-slate-100 ${isWarning ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 text-slate-400">{order.order_number}</td>
                  <td className="px-3 py-2 text-slate-800">{order.client_name}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(order.amount)}</td>
                  <td className="px-3 py-2 text-right">{fmt(order.driver_pay)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${isWarning ? 'text-amber-600' : 'text-slate-600'}`}>
                    {isWarning ? '⚠️' : ''}{pct}%
                  </td>
                  {trip.loader && (
                    <td className="px-3 py-2 text-right">{fmt(order.loader_pay)}</td>
                  )}
                  <td className="px-3 py-2 text-slate-500 text-xs">
                    {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                    {order.settlement_status === 'pending' && ' ⏳'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
              <td className="px-3 py-2 text-slate-500" colSpan={2}>Итого</td>
              <td className="px-3 py-2 text-right">{fmt(trip.summary.totalRevenue)}</td>
              <td className="px-3 py-2 text-right">{fmt(trip.summary.totalDriverPay)}</td>
              <td className="px-3 py-2 text-right text-slate-500">{trip.summary.avgDriverPercent}%</td>
              {trip.loader && (
                <td className="px-3 py-2 text-right">{fmt(trip.summary.totalLoaderPay)}</td>
              )}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Расходы */}
      {trip.expenses.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-3">
          {trip.expenses.map(exp => (
            <span key={exp.id} className="text-sm text-slate-500">
              {exp.categories?.name || 'Расход'}: <span className="text-red-600 font-medium">−{fmt(exp.amount)} ₽</span>
            </span>
          ))}
        </div>
      )}

      {/* Итоговая строка */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
        <div className="text-sm text-slate-600 space-x-4">
          <span>ГСМ и расходы: <strong>{fmt(trip.summary.totalExpenses)} ₽</strong></span>
          <span>Прибыль: <strong className={trip.summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
            {fmt(trip.summary.profit)} ₽
          </strong></span>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Кнопки */}
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 py-2 bg-green-600 text-white font-semibold rounded-lg
                     hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
        >
          {approving ? 'Подтверждаем...' : '✅ Подтвердить'}
        </button>
      </div>
    </div>
  )
}
```

4. Создать apps/web/src/components/review/ReviewPage.tsx:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import TripReviewCard from './TripReviewCard'

interface DayTotal {
  revenue: number
  driverPay: number
  loaderPay: number
  expenses: number
  profit: number
}

interface ReviewData {
  date: string
  trips: Record<string, unknown>[]
  dayTotal: DayTotal
}

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/review?date=${date}`)
      if (!res.ok) throw new Error('Ошибка загрузки')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const handleApprove = async (tripId: string) => {
    const res = await fetch(`/api/review/${tripId}/approve`, { method: 'POST' })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Ошибка подтверждения')
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  const dateLabel = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Заголовок + выбор даты */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📋 Ревью смены</h1>
          <p className="text-slate-500 text-sm mt-1">{dateLabel}</p>
        </div>
        <input
          type="date"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {/* Итого за день */}
      {data && data.trips.length > 0 && (
        <div className="bg-slate-800 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Выручка', value: fmt(data.dayTotal.revenue) },
            { label: 'ФОТ водит.', value: fmt(data.dayTotal.driverPay) },
            { label: 'ФОТ груз.', value: fmt(data.dayTotal.loaderPay) },
            { label: 'ГСМ+расходы', value: fmt(data.dayTotal.expenses) },
            { label: 'Прибыль', value: fmt(data.dayTotal.profit), highlight: true },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-slate-400 text-xs mb-1">{item.label}</p>
              <p className={`font-bold text-lg ${item.highlight
                ? data.dayTotal.profit >= 0 ? 'text-green-400' : 'text-red-400'
                : 'text-white'
              }`}>
                {item.value} ₽
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <p className="text-slate-400">Загрузка...</p>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Пусто */}
      {!loading && !error && data && data.trips.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Нет рейсов для ревью за {dateLabel}</p>
          <p className="text-sm mt-1">Все рейсы подтверждены или не было активности</p>
        </div>
      )}

      {/* Рейсы */}
      {!loading && data && data.trips.map(trip => (
        <TripReviewCard
          key={trip.id as string}
          trip={trip as Parameters<typeof TripReviewCard>[0]['trip']}
          onApprove={handleApprove}
        />
      ))}
    </div>
  )
}
```

/* ============================================================
   БЛОК 3: СТРАНИЦА И НАВИГАЦИЯ
   ============================================================ */

5. Создать apps/web/src/app/review/page.tsx:

```typescript
import ReviewPage from '@/components/review/ReviewPage'

export default function ReviewRoute() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-slate-400 hover:text-white transition-colors">← Главная</a>
        <span className="text-lg font-bold">SaldaCargo</span>
      </header>
      <ReviewPage />
    </main>
  )
}
```

6. Обновить apps/web/src/app/page.tsx — добавить кнопку перехода на ревью.
   Найти блок с кнопками или добавить после заголовка:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MoneyMap from '@/components/dashboard/MoneyMap'
import Link from 'next/link'

export default async function HomePage() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('legal_entities')
      .select('id')
      .limit(1)

    if (!data || data.length === 0) {
      redirect('/setup')
    }
  } catch (error) {
    console.error('[HomePage] check error:', error)
  }

  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">SaldaCargo</span>
          <span className="text-slate-400 text-sm">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/review"
            className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold
                       rounded-lg hover:bg-amber-600 transition-colors"
          >
            📋 Ревью смены
          </Link>
          <span className="text-slate-400 text-sm hidden md:block">{today}</span>
        </div>
      </header>

      {/* Контент */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MoneyMap />
      </div>
    </main>
  )
}
```

7. Запустить локально:
   cd apps/web && pnpm dev

8. Закоммитить:
   git add .
   git commit -m "feat: ревью смены — подтверждение рейсов, создание транзакций"
   git push origin main

9. ВЕРИФИКАЦИЯ (полный сценарий):
   А) Открыть http://localhost:3000 — в шапке видна кнопка "📋 Ревью смены"
   Б) Кликнуть → открылась страница /review
   В) Выбрать дату когда были тестовые рейсы из таска 006
   Г) Видны карточки рейсов с таблицами заказов
   Д) Строки с % > 40% или < 25% подсвечены жёлтым ⚠️
   Е) Нажать "✅ Подтвердить" на одном рейсе
   Ж) Карточка становится зелёной "✅ подтверждён"
   З) Открыть http://localhost:3000 → Money Map
   И) Блок P&L и баланс кошельков обновились (появились данные)
   К) Проверить в Supabase Dashboard → trips: lifecycle_status = 'approved'
   Л) Проверить в Supabase Dashboard → transactions: появились записи с lifecycle_status = 'approved'

10. Заполнить COMPLETION LOG.
11. Перенести файл из tasks/todo/ в tasks/done/.
12. Обновить docs/BRIEF.md — отметить 007 выполненным.
</task>

<rules>
- createAdminClient() везде — ревью только для admin/owner, обходим RLS
- ASYNC/AWAIT: handleApprove ждёт await fetch → только потом setApproved(true)
- Try/catch обязателен в handleApprove и во всех API routes
- При approve создаём транзакции с lifecycle_status='approved' сразу —
  это правильно, т.к. admin подтверждает данные от водителя
- НЕ трогать файлы apps/miniapp/
- Транзакции для ЗП: from=cash_office, to=ext_suppliers (деньги ушли водителю)
- Транзакции для дохода: from=ext_clients, to=wallet по payment_method
- ПРОТОКОЛ ОШИБКИ: если approve возвращает 500 — показать текст ошибки
  в карточке рейса (уже реализовано через state error) и НЕ скрывать карточку
</rules>

---

## COMPLETION LOG
**Статус:** _pending_
**Исполнитель:** ___
**Изменения:** [краткий список]
**Результат верификации:** [ ] Успешно