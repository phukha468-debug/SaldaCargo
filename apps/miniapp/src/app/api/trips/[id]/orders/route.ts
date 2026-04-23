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
      ? (existing[0].order_number as number) + 1
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
