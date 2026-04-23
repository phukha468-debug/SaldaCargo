import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    // 1. Балансы кошельков (только approved + completed)
    const { data: txAll, error: txError } = await (supabase
      .from('transactions') as any)
      .select('from_wallet_id, to_wallet_id, amount, direction, actual_date')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'completed')

    if (txError) throw txError

    // 2. Кошельки
    const { data: wallets, error: walletsError } = await (supabase
      .from('wallets') as any)
      .select('id, code, name, type')
      .eq('is_active', true)
      .neq('type', 'external_virtual')

    if (walletsError) throw walletsError

    // Считаем баланс каждого кошелька
    const walletBalances = (wallets as any[]).map(w => {
      const balance = (txAll || []).reduce((sum, tx) => {
        if (tx.to_wallet_id === w.id) return sum + Number(tx.amount)
        if (tx.from_wallet_id === w.id) return sum - Number(tx.amount)
        return sum
      }, 0)
      return { ...w, balance: Math.round(balance) }
    })

    // 3. Автопарк — балансовая стоимость
    const { data: assets, error: assetsError } = await (supabase
      .from('assets') as any)
      .select('id, plate_number, current_book_value, status, asset_type_id')
      .eq('status', 'active')

    if (assetsError) throw assetsError

    const fleetTotal = (assets || []).reduce(
      (sum, a) => sum + Number(a.current_book_value || 0), 0
    )

    // 4. Дебиторка (pending income)
    const { data: receivables } = await (supabase
      .from('transactions') as any)
      .select('amount, actual_date')
      .eq('lifecycle_status', 'approved')
      .eq('settlement_status', 'pending')
      .eq('direction', 'income')

    const receivablesTotal = (receivables || []).reduce(
      (sum, t) => sum + Number(t.amount), 0
    )

    // Просроченная дебиторка (30+ дней)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const overdueTotal = (receivables || [])
      .filter(t => t.actual_date < thirtyDaysAgo.toISOString().split('T')[0])
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // 5. Кредиторка (pending expense)
    const { data: payables } = await (supabase
      .from('transactions') as any)
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
    const { data: drafts } = await (supabase
      .from('trips') as any)
      .select('id')
      .eq('lifecycle_status', 'draft')
      .eq('status', 'completed')

    // 9. Машины на линии сегодня
    const { data: activeTrips } = await (supabase
      .from('trips') as any)
      .select('asset_id')
      .eq('status', 'in_progress')

    const { data: allAssets } = await (supabase
      .from('assets') as any)
      .select('id')
      .eq('status', 'active')

    const onLine = (activeTrips || []).length
    const totalActive = (allAssets || []).length

    // 10. ТО алерты (таблица maintenance_alerts может не существовать, обрабатываем ошибку)
    let toAlertsCount = 0
    try {
      const { data: toAlerts } = await (supabase
        .from('maintenance_alerts') as any)
        .select('id')
        .in('alert_status', ['pending', 'overdue'])
      toAlertsCount = (toAlerts || []).length
    } catch {}

    // 11. Чистая позиция
    const cashTotal = walletBalances.reduce((sum, w) => sum + w.balance, 0)
    const netPosition = cashTotal + fleetTotal + receivablesTotal - payablesTotal

    return NextResponse.json({
      success: true,
      data: {
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
          progressPercent: TARGET > 0 ? Math.min(Math.round((monthProfit / TARGET) * 100), 100) : 0,
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
          toAlertsCount,
          overdueReceivables: Math.round(overdueTotal),
          lowLoad: totalActive > 0 && onLine / totalActive < 0.3,
        },
      }
    })
  } catch (error) {
    console.error('[money-map] Error:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки данных' },
      { status: 500 }
    )
  }
}
