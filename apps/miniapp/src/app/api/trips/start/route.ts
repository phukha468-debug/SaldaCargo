import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { asset_id, driver_id, loader_id, odometer_start, trip_type } = body

    if (!asset_id || !driver_id) {
      return NextResponse.json(
        { error: 'Машина и водитель обязательны' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('trips')
      .insert({
        asset_id,
        driver_id,
        loader_id: loader_id || null,
        trip_type: trip_type || 'local',
        started_at: new Date().toISOString(),
        odometer_start: odometer_start || null,
        lifecycle_status: 'draft',
        status: 'in_progress',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[trips/start] Error:', error)
    return NextResponse.json({ error: 'Ошибка создания рейса' }, { status: 500 })
  }
}
