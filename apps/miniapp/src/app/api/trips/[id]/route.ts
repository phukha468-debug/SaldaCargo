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
