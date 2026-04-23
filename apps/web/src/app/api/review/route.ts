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
      (trips || []).map(async (trip: any) => {
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
