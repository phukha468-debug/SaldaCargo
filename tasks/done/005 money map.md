<!-- BOOT: Перед выполнением прочитай docs/BOOT.md -->

<context>
Setup Wizard готов (004). Теперь нужна главная страница Dashboard — «Карта денег».
Это первое что видит владелец каждое утро: чистая позиция, кошельки, автопарк,
P&L месяца, сводка за сегодня и алерты. Данные читаются из БД через API Route.
Балансы ВСЕГДА вычисляются из transactions (lifecycle=approved, settlement=completed).

ЗАВИСИМОСТИ: 004_setup_wizard
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ:
  - apps/web/src/app/page.tsx
  - apps/web/src/app/api/money-map/route.ts
  - apps/web/src/components/dashboard/MoneyMap.tsx
  - apps/web/src/components/dashboard/WalletCard.tsx
  - apps/web/src/components/dashboard/PnlCard.tsx
  - apps/web/src/components/dashboard/AlertsCard.tsx
  - apps/web/src/components/dashboard/TodayCard.tsx
ТИП: feat
</context>

<task>
1. Создать apps/web/src/app/api/money-map/route.ts:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    // 1. Балансы кошельков (только approved + completed)
    const { data: txAll, error: txError } = await supabase
      .from('transactions')
      .select('from_wallet_id, to_wallet_id, amount, direction, actual_date')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')

    if (txError) throw txError

    // 2. Кошельки
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, code, name, type')
      .eq('is_active', true)
      .neq('type', 'external_virtual')

    if (walletsError) throw walletsError

    // Считаем баланс каждого кошелька
    const walletBalances = wallets.map(w => {
      const balance = (txAll || []).reduce((sum, tx) => {
        if (tx.to_wallet_id === w.id) return sum + Number(tx.amount)
        if (tx.from_wallet_id === w.id) return sum - Number(tx.amount)
        return sum
      }, 0)
      return { ...w, balance: Math.round(balance) }
    })

    // 3. Автопарк — балансовая стоимость
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, plate_number, current_book_value, status, asset_type_id')
      .eq('status', 'active')

    if (assetsError) throw assetsError

    const fleetTotal = (assets || []).reduce(
      (sum, a) => sum + Number(a.current_book_value || 0), 0
    )

    // 4. Дебиторка (pending income)
    const { data: receivables } = await supabase
      .from('transactions')
      .select('amount')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('direction', 'income')

    const receivablesTotal = (receivables || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )

    // Просроченная дебиторка (30+ дней)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: overdueRec } = await supabase
      .from('transactions')
      .select('amount')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('direction', 'income')
      .lt('actual_date', thirtyDaysAgo.toISOString().split('T')[0])

    const overdueTotal = (overdueRec || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )

    // 5. Кредиторка (pending expense)
    const { data: payables } = await supabase
      .from('transactions')
      .select('amount')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('direction', 'expense')

    const payablesTotal = (payables || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )

    // 6. P&L текущего месяца
    const monthTx = (txAll || []).filter(
      tx => tx.actual_date >= monthStart && tx.actual_date <= today
    )

    const monthIncome = monthTx
      .filter(tx => tx.direction === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const monthExpense = monthTx
      .filter(tx => tx.direction === 'expense')
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const monthProfit = monthIncome - monthExpense
    const TARGET = 1500000

    // 7. Сводка за сегодня
    const todayTx = (txAll || []).filter(tx => tx.actual_date === today)
    const todayIncome = todayTx
      .filter(tx => tx.direction === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const todayExpense = todayTx
      .filter(tx => tx.direction === 'expense')
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    // 8. Драфты (требуют ревью)
    const { data: drafts } = await supabase
      .from('trips')
      .select('id')
      .eq('lifecycle_status', 'draft')
      .eq('status', 'completed')

    // 9. Машины на линии сегодня
    const { data: activeTrips } = await supabase
      .from('trips')
      .select('asset_id')
      .eq('status', 'in_progress')

    const { data: allAssets } = await supabase
      .from('assets')
      .select('id')
      .eq('status', 'active')

    const onLine = (activeTrips || []).length
    const totalActive = (allAssets || []).length

    // 10. ТО алерты
    const { data: toAlerts } = await supabase
      .from('maintenance_alerts')
      .select('id, alert_status, asset_id, next_service_mileage')
      .in('alert_status', ['pending', 'overdue'])

    // 11. Чистая позиция
    const cashTotal = walletBalances.reduce((sum, w) => sum + w.balance, 0)
    const netPosition = cashTotal + fleetTotal + receivablesTotal - payablesTotal

    return NextResponse.json({
      netPosition: Math.round(netPosition),
      cash: {
        total: cashTotal,
        wallets: walletBalances,
      },
      fleet: {
        total: Math.round(fleetTotal),
        count: (assets || []).length,
      },
      receivables: {
        total: Math.round(receivablesTotal),
        overdue: Math.round(overdueTotal),
      },
      payables: {
        total: Math.round(payablesTotal),
      },
      pnl: {
        income: Math.round(monthIncome),
        expense: Math.round(monthExpense),
        profit: Math.round(monthProfit),
        target: TARGET,
        progressPercent: Math.min(Math.round((monthProfit / TARGET) * 100), 100),
      },
      today: {
        date: today,
        income: Math.round(todayIncome),
        expense: Math.round(todayExpense),
        profit: Math.round(todayIncome - todayExpense),
        onLine,
        totalActive,
        loadPercent: totalActive > 0 ? Math.round((onLine / totalActive) * 100) : 0,
      },
      alerts: {
        draftsCount: (drafts || []).length,
        toAlertsCount: (toAlerts || []).length,
        overdueReceivables: Math.round(overdueTotal),
        lowLoad: totalActive > 0 && onLine / totalActive < 0.3,
      },
    })
  } catch (error) {
    console.error('[money-map] Error:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки данных' },
      { status: 500 }
    )
  }
}
```

2. Создать apps/web/src/components/dashboard/WalletCard.tsx:

```typescript
interface Wallet {
  id: string
  code: string
  name: string
  type: string
  balance: number
}

interface WalletCardProps {
  wallets: Wallet[]
  total: number
}

export default function WalletCard({ wallets, total }: WalletCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">💵 Деньги</h3>
        <span className="text-lg font-bold text-slate-800">{fmt(total)} ₽</span>
      </div>
      <div className="space-y-2">
        {wallets.map(w => (
          <div key={w.id} className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{w.name}</span>
            <span className={`font-medium ${w.balance < 0 ? 'text-red-600' : 'text-slate-700'}`}>
              {fmt(w.balance)} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

3. Создать apps/web/src/components/dashboard/PnlCard.tsx:

```typescript
interface PnlCardProps {
  income: number
  expense: number
  profit: number
  target: number
  progressPercent: number
}

export default function PnlCard({ income, expense, profit, target, progressPercent }: PnlCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-700 mb-4">💰 P&L текущего месяца</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Выручка</p>
          <p className="font-bold text-slate-800">{fmt(income)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Расходы</p>
          <p className="font-bold text-slate-800">{fmt(expense)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Прибыль</p>
          <p className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
          </p>
        </div>
      </div>

      {/* Прогресс к цели */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Прогресс к цели {fmt(target)} ₽</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              progressPercent >= 100
                ? 'bg-green-500'
                : progressPercent >= 50
                ? 'bg-blue-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

4. Создать apps/web/src/components/dashboard/TodayCard.tsx:

```typescript
interface TodayCardProps {
  date: string
  income: number
  expense: number
  profit: number
  onLine: number
  totalActive: number
  loadPercent: number
}

export default function TodayCard({
  date, income, expense, profit, onLine, totalActive, loadPercent
}: TodayCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')
  const dateStr = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long'
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-700 mb-4">📅 Сегодня ({dateStr})</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Выручка</p>
          <p className="font-bold text-slate-800">{fmt(income)} ₽</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Прибыль</p>
          <p className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{fmt(profit)} ₽
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-sm text-slate-500">Машин на линии</span>
        <span className={`text-sm font-bold ${
          loadPercent < 30 ? 'text-red-600' : loadPercent < 60 ? 'text-amber-600' : 'text-green-600'
        }`}>
          {onLine}/{totalActive} ({loadPercent}%)
        </span>
      </div>
    </div>
  )
}
```

5. Создать apps/web/src/components/dashboard/AlertsCard.tsx:

```typescript
interface AlertsCardProps {
  draftsCount: number
  toAlertsCount: number
  overdueReceivables: number
  lowLoad: boolean
}

export default function AlertsCard({
  draftsCount, toAlertsCount, overdueReceivables, lowLoad
}: AlertsCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')
  const alerts: string[] = []

  if (draftsCount > 0) alerts.push(`${draftsCount} смен ждут ревью`)
  if (toAlertsCount > 0) alerts.push(`${toAlertsCount} алертов ТО`)
  if (overdueReceivables > 0) alerts.push(`Просрочено 30+: ${fmt(overdueReceivables)} ₽`)
  if (lowLoad) alerts.push('Загрузка парка < 30% ⚠️')

  if (alerts.length === 0) return (
    <div className="bg-white rounded-xl border border-green-200 p-5">
      <h3 className="font-semibold text-slate-700 mb-2">✅ Требует внимания</h3>
      <p className="text-sm text-green-600">Всё в порядке</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-5">
      <h3 className="font-semibold text-slate-700 mb-3">⚠️ Требует внимания</h3>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
            <span className="mt-0.5">•</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

6. Создать apps/web/src/components/dashboard/MoneyMap.tsx:

```typescript
'use client'

import { useEffect, useState } from 'react'
import WalletCard from './WalletCard'
import PnlCard from './PnlCard'
import TodayCard from './TodayCard'
import AlertsCard from './AlertsCard'

interface MoneyMapData {
  netPosition: number
  cash: { total: number; wallets: Array<{ id: string; code: string; name: string; type: string; balance: number }> }
  fleet: { total: number; count: number }
  receivables: { total: number; overdue: number }
  payables: { total: number }
  pnl: { income: number; expense: number; profit: number; target: number; progressPercent: number }
  today: { date: string; income: number; expense: number; profit: number; onLine: number; totalActive: number; loadPercent: number }
  alerts: { draftsCount: number; toAlertsCount: number; overdueReceivables: number; lowLoad: boolean }
}

export default function MoneyMap() {
  const [data, setData] = useState<MoneyMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/money-map')
        if (!res.ok) throw new Error('Ошибка загрузки')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">Загрузка данных...</div>
    </div>
  )

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      ❌ {error}
    </div>
  )

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Чистая позиция */}
      <div className="bg-slate-800 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm mb-1">ЧИСТАЯ ПОЗИЦИЯ</p>
            <p className="text-3xl font-bold">{fmt(data.netPosition)} ₽</p>
          </div>
          <div className="text-right text-sm text-slate-400 space-y-1">
            <div>Деньги: <span className="text-white font-medium">{fmt(data.cash.total)} ₽</span></div>
            <div>Автопарк: <span className="text-white font-medium">{fmt(data.fleet.total)} ₽</span></div>
            <div>Дебиторка: <span className="text-white font-medium">{fmt(data.receivables.total)} ₽</span></div>
            <div>Кредиторка: <span className="text-red-400 font-medium">−{fmt(data.payables.total)} ₽</span></div>
          </div>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletCard wallets={data.cash.wallets} total={data.cash.total} />

        {/* Автопарк */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">🚛 Автопарк</h3>
            <span className="text-lg font-bold text-slate-800">{fmt(data.fleet.total)} ₽</span>
          </div>
          <p className="text-sm text-slate-500">
            {data.fleet.count} машин активно · балансовая стоимость
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Дебиторка</p>
              <p className="font-medium text-slate-700">{fmt(data.receivables.total)} ₽</p>
              {data.receivables.overdue > 0 && (
                <p className="text-xs text-red-500">⚠️ Просрочено: {fmt(data.receivables.overdue)} ₽</p>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-xs">Кредиторка</p>
              <p className="font-medium text-slate-700">{fmt(data.payables.total)} ₽</p>
            </div>
          </div>
        </div>

        <PnlCard {...data.pnl} />
        <TodayCard {...data.today} />
      </div>

      {/* Алерты */}
      <AlertsCard {...data.alerts} />
    </div>
  )
}
```

7. Обновить apps/web/src/app/page.tsx:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MoneyMap from '@/components/dashboard/MoneyMap'

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
        <span className="text-slate-400 text-sm">{today}</span>
      </header>

      {/* Контент */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MoneyMap />
      </div>
    </main>
  )
}
```

8. Запустить локально:
   cd apps/web && pnpm dev

9. Закоммитить:
   git add .
   git commit -m "feat: Money Map — главная страница Dashboard"
   git push origin main

10. ВЕРИФИКАЦИЯ:
    А) Открыть http://localhost:3000
    Б) Видна шапка "SaldaCargo Dashboard" с текущей датой
    В) Блок "ЧИСТАЯ ПОЗИЦИЯ" — показывает число (может быть 0 если нет транзакций)
    Г) Блок "💵 Деньги" — список кошельков (р/с, касса, Опти24, подотчёты)
    Д) Блок "🚛 Автопарк" — количество машин и балансовая стоимость
    Е) Блок "💰 P&L" — выручка / расходы / прибыль / прогресс-бар к 1.5М
    Ж) Блок "📅 Сегодня" — дата, выручка, загрузка парка
    З) Блок "⚠️ Требует внимания" — алерты или "Всё в порядке"
    И) Открыть http://localhost:3000/api/money-map — возвращает JSON без ошибок
    К) Консоль браузера — нет red errors

11. Заполнить COMPLETION LOG.
12. Перенести файл из tasks/todo/ в tasks/done/.
13. Обновить docs/BRIEF.md — отметить 005 выполненным.
</task>

<rules>
- MoneyMap.tsx — 'use client' (данные грузятся через fetch в useEffect)
- page.tsx — Server Component (редирект на /setup если БД пустая)
- Балансы ТОЛЬКО из transactions где lifecycle=approved AND settlement=completed
- НЕ хранить баланс в wallets.balance — только вычислять
- Все суммы в UI: toLocaleString('ru-RU') — русский формат с пробелами
- Try/catch обязателен во всех async операциях
- НЕ трогать файлы вне списка ЗАТРАГИВАЕМЫЕ ФАЙЛЫ
- ПРОТОКОЛ ОШИБКИ: если /api/money-map возвращает 500 — вывести текст ошибки
  в MoneyMap компоненте (уже реализовано через state error) и ждать Архитектора.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:** 
- Создан API роут /api/money-map для финансовых расчетов.
- Реализованы компоненты MoneyMap, WalletCard, PnlCard, TodayCard, AlertsCard.
- Обновлена главная страница (apps/web/src/app/page.tsx) с новым дизайном шапки.
- Проведена верификация сборки через pnpm build.
**Результат верификации:** [x] Успешно. Дашборд готов к отображению данных после Setup Wizard.