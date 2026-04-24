import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = createAdminClient()

    // 0. Получаем данные рейса для даты
    const { data: tripInfo } = await supabase
      .from('trips')
      .select('started_at')
      .eq('id', tripId)
      .single()

    const tripDate = tripInfo?.started_at ? tripInfo.started_at.split('T')[0] : new Date().toISOString().split('T')[0]

    // 1. Подтверждаем рейс
    const { error: tripError } = await supabase
      .from('trips')
      .update({
        lifecycle_status: 'approved',
      })
      .eq('id', tripId)

    if (tripError) throw tripError

    // 2. Получаем заказы рейса
    const { data: orders, error: ordersError } = await supabase
      .from('trip_orders')
      .select('id, amount, driver_pay, loader_pay, payment_method')
      .eq('trip_id', tripId)

    if (ordersError) throw ordersError

    // 3+4. Кошельки и категории — параллельно
    const [{ data: wallets }, { data: categories }] = await Promise.all([
      supabase.from('wallets').select('id, code'),
      supabase.from('categories').select('id, code'),
    ])

    const walletMap = Object.fromEntries(
      (wallets || []).map(w => [w.code, w.id])
    )
    const categoryMap = Object.fromEntries(
      (categories || []).map(c => [c.code, c.id])
    )

    // 5. Создаём транзакции для каждого заказа
    const transactionsToInsert = []

    for (const order of (orders || [])) {
      const toWalletCode = order.payment_method === 'qr' || order.payment_method === 'bank_invoice'
        ? 'ip_rs'
        : 'cash_office' // cash, card_driver, debt_cash (пока в кассу)

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
        lifecycle_status: 'approved',
        settlement_status: settlementStatus,
        transaction_type: 'regular',
        actual_date: tripDate,
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
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          transaction_type: 'payroll',
          actual_date: tripDate,
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
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          transaction_type: 'payroll',
          actual_date: tripDate,
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
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_type: 'regular',
        actual_date: tripDate,
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
