import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const supabase = createAdminClient()

  // Три запроса параллельно вместо последовательных
  const [
    { data: trip },
    { data: orders },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('trips')
      .select(
        'id, started_at, ended_at, status, lifecycle_status, trip_type, ' +
        'odometer_start, odometer_end, profit, ' +
        'driver:users!trips_driver_id_fkey ( id, full_name ), ' +
        'vehicle:assets ( id, plate_number, asset_types ( code, name ) )'
      )
      .eq('id', tripId)
      .single(),

    supabase
      .from('trip_orders')
      .select('id, order_number, client_name, amount, driver_pay, loader_pay, payment_method, settlement_status')
      .eq('trip_id', tripId)
      .order('order_number'),

    supabase
      .from('trip_expenses')
      .select('id, amount, description, categories ( code, name )')
      .eq('trip_id', tripId),
  ])

  const totalRevenue = orders?.reduce((s, o) => s + Number(o.amount), 0) ?? 0

  return NextResponse.json({
    trip,
    orders,
    expenses,
    summary: {
      totalRevenue,
      totalProfit: trip?.profit ?? null,
    },
  })
}
