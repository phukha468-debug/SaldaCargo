import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { odometer_end } = body

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        lifecycle_status: 'draft',
        ended_at: new Date().toISOString(),
        odometer_end: odometer_end || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Обновить одометр машины
    if (odometer_end && data.asset_id) {
      await supabase
        .from('assets')
        .update({ odometer_current: odometer_end })
        .eq('id', data.asset_id)
    }

    return NextResponse.json({ success: true, trip: data })
  } catch (error) {
    console.error('[trips/complete] Error:', error)
    return NextResponse.json({ error: 'Ошибка завершения рейса' }, { status: 500 })
  }
}
