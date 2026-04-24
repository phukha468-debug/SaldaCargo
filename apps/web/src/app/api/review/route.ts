import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = createAdminClient()
    const dateStart = `${date}T00:00:00.000Z`
    const dateEnd = `${date}T23:59:59.999Z`

    // 1. Рейсы за дату
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

    if (!trips || trips.length === 0) {
      return NextResponse.json({
        date,
        trips: [],
        dayTotal: { revenue: 0, driverPay: 0, loaderPay: 0, expenses: 0, profit: 0 },
      })
    }

    const tripIds = trips.map(t => t.id)

    // 2. Заказы и расходы — 2 запроса вместо N*2 (были: по 2 запроса на каждый рейс)
    const [{ data: allOrders }, { data: allExpenses }] = await Promise.all([
      supabase
        .from('trip_orders')
        .select('id, trip_id, order_number, client_name, amount, driver_pay, loader_pay, payment_method, settlement_status')
        .in('trip_id', tripIds)
        .order('order_number'),

      supabase
        .from('trip_expenses')
        .select('id, trip_id, amount, description, categories ( code, name )')
        .in('trip_id', tripIds),
    ])

    // Группируем заказы и расходы по trip_id через Map — O(n) вместо O(n*m)
    const ordersByTrip = new Map<string, typeof allOrders>()
    const expensesByTrip = new Map<string, typeof allExpenses>()

    for (const o of allOrders || []) {
      const list = ordersByTrip.get(o.trip_id) ?? []
      list.push(o)
      ordersByTrip.set(o.trip_id, list)
    }
    for (const e of allExpenses || []) {
      const list = expensesByTrip.get(e.trip_id) ?? []
      list.push(e)
      expensesByTrip.set(e.trip_id, list)
    }

    // Собираем итоговые объекты рейсов
    const tripsWithDetails = trips.map((trip: any) => {
      const orders = ordersByTrip.get(trip.id) ?? []
      const expenses = expensesByTrip.get(trip.id) ?? []

      const totalRevenue = orders.reduce((s, o) => s + Number(o.amount), 0)
      const totalDriverPay = orders.reduce((s, o) => s + Number(o.driver_pay), 0)
      const totalLoaderPay = orders.reduce((s, o) => s + Number(o.loader_pay || 0), 0)
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
      const profit = totalRevenue - totalDriverPay - totalLoaderPay - totalExpenses
      const avgDriverPercent = totalRevenue > 0
        ? Math.round((totalDriverPay / totalRevenue) * 100 * 10) / 10
        : 0

      // Добавляем driver_pay_percent к каждому заказу
      const ordersWithPercent = orders.map(o => ({
        ...o,
        driver_pay_percent: Number(o.amount) > 0
          ? Math.round((Number(o.driver_pay) / Number(o.amount)) * 100 * 10) / 10
          : 0,
      }))

      return {
        ...trip,
        orders: ordersWithPercent,
        expenses,
        summary: {
          totalRevenue: Math.round(totalRevenue),
          totalDriverPay: Math.round(totalDriverPay),
          totalLoaderPay: Math.round(totalLoaderPay),
          totalExpenses: Math.round(totalExpenses),
          profit: Math.round(profit),
          avgDriverPercent,
          ordersCount: orders.length,
        },
      }
    })

    const dayTotal = tripsWithDetails.reduce(
      (acc, t) => ({
        revenue:   acc.revenue   + t.summary.totalRevenue,
        driverPay: acc.driverPay + t.summary.totalDriverPay,
        loaderPay: acc.loaderPay + t.summary.totalLoaderPay,
        expenses:  acc.expenses  + t.summary.totalExpenses,
        profit:    acc.profit    + t.summary.profit,
      }),
      { revenue: 0, driverPay: 0, loaderPay: 0, expenses: 0, profit: 0 }
    )

    return NextResponse.json({ date, trips: tripsWithDetails, dayTotal })
  } catch (error) {
    console.error('[review] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки ревью' }, { status: 500 })
  }
}
