import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // Все 11 запросов параллельно вместо последовательных await
    const [
      { data: txAll, error: txError },
      { data: wallets, error: walletsError },
      { data: assets, error: assetsError },
      { data: receivables },
      { data: payables },
      { count: pendingTripsCount },
      { count: pendingServiceCount },
      { count: pendingOrdersCount },
      { count: pendingExpensesCount },
      { count: onLine },
      { count: totalActive },
      { count: toAlertsRaw, error: toAlertsError },
    ] = await Promise.all([
      // 1. Транзакции approved+completed — для балансов кошельков, P&L, сегодня
      supabase
        .from('transactions')
        .select('from_wallet_id, to_wallet_id, amount, direction, actual_date')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      // 2. Кошельки
      supabase
        .from('wallets')
        .select('id, code, name, type')
        .eq('is_active', true)
        .neq('type', 'external_virtual'),

      // 3. Автопарк
      supabase
        .from('assets')
        .select('id, current_book_value')
        .eq('status', 'active'),

      // 4. Дебиторка (income pending)
      supabase
        .from('transactions')
        .select('amount, actual_date')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('direction', 'income'),

      // 5. Кредиторка (expense pending)
      supabase
        .from('transactions')
        .select('amount')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .eq('direction', 'expense'),

      // 6-9. Счётчики верификации — HEAD-запросы, строки не тянем
      supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('lifecycle_status', 'draft'),
      supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('lifecycle_status', 'pending'),
      supabase
        .from('trip_orders')
        .select('*', { count: 'exact', head: true })
        .eq('lifecycle_status', 'pending'),
      supabase
        .from('trip_expenses')
        .select('*', { count: 'exact', head: true })
        .eq('lifecycle_status', 'pending'),

      // 10. Машины на линии — только счётчик
      supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress'),

      // 11. Всего активных машин — только счётчик
      supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // 12. ТО алерты (таблица может отсутствовать — ошибку подавляем ниже)
      supabase
        .from('maintenance_alerts' as any)
        .select('*', { count: 'exact', head: true })
        .in('alert_status', ['pending', 'overdue']),
    ])

    if (txError) throw txError
    if (walletsError) throw walletsError
    if (assetsError) throw assetsError

    // Балансы кошельков — считаем из уже загруженного txAll
    const walletBalances = (wallets || []).map(w => {
      const balance = (txAll || []).reduce((sum, tx) => {
        if (tx.to_wallet_id === w.id) return sum + Number(tx.amount)
        if (tx.from_wallet_id === w.id) return sum - Number(tx.amount)
        return sum
      }, 0)
      return { ...w, balance: Math.round(balance) }
    })

    const fleetTotal = (assets || []).reduce(
      (sum, a) => sum + Number(a.current_book_value || 0), 0
    )

    const receivablesTotal = (receivables || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )
    const overdueTotal = (receivables || [])
      .filter(t => t.actual_date < thirtyDaysAgoStr)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const payablesTotal = (payables || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )

    // P&L и "Сегодня" — фильтруем уже загруженный txAll в памяти (O(n), не доп. запросы)
    const monthTx = (txAll || []).filter(
      tx => tx.actual_date >= monthStart && tx.actual_date <= today
    )
    const monthIncome = monthTx.filter(tx => tx.direction === 'income').reduce((s, tx) => s + Number(tx.amount), 0)
    const monthExpense = monthTx.filter(tx => tx.direction === 'expense').reduce((s, tx) => s + Number(tx.amount), 0)
    const monthProfit = monthIncome - monthExpense
    const TARGET = 1500000

    const todayTx = (txAll || []).filter(tx => tx.actual_date === today)
    const todayIncome = todayTx.filter(tx => tx.direction === 'income').reduce((s, tx) => s + Number(tx.amount), 0)
    const todayExpense = todayTx.filter(tx => tx.direction === 'expense').reduce((s, tx) => s + Number(tx.amount), 0)

    const verificationCount =
      (pendingTripsCount || 0) +
      (pendingServiceCount || 0) +
      (pendingOrdersCount || 0) +
      (pendingExpensesCount || 0)

    const toAlertsCount = toAlertsError ? 0 : (toAlertsRaw || 0)
    const onLineCount = onLine || 0
    const totalActiveCount = totalActive || 0

    const cashTotal = walletBalances.reduce((sum, w) => sum + w.balance, 0)
    const netPosition = cashTotal + fleetTotal + receivablesTotal - payablesTotal

    return NextResponse.json({
      success: true,
      data: {
        netPosition: Math.round(netPosition),
        cash: { total: cashTotal, wallets: walletBalances },
        fleet: { total: Math.round(fleetTotal), count: (assets || []).length },
        receivables: { total: Math.round(receivablesTotal), overdue: Math.round(overdueTotal) },
        payables: { total: Math.round(payablesTotal) },
        pnl: {
          income: Math.round(monthIncome),
          expense: Math.round(monthExpense),
          profit: Math.round(monthProfit),
          target: TARGET,
          progressPercent: TARGET > 0 ? Math.min(Math.round((monthProfit / TARGET) * 100), 100) : 0,
        },
        today: {
          date: today,
          income: Math.round(todayIncome),
          expense: Math.round(todayExpense),
          profit: Math.round(todayIncome - todayExpense),
          onLine: onLineCount,
          totalActive: totalActiveCount,
          loadPercent: totalActiveCount > 0 ? Math.round((onLineCount / totalActiveCount) * 100) : 0,
        },
        alerts: {
          verificationCount,
          toAlertsCount,
          overdueReceivables: Math.round(overdueTotal),
          lowLoad: totalActiveCount > 0 && onLineCount / totalActiveCount < 0.3,
        },
      }
    })
  } catch (error) {
    console.error('[money-map] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки данных' }, { status: 500 })
  }
}
