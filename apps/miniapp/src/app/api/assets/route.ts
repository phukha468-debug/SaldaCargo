import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('assets')
      .select(`
        id, plate_number, notes, status,
        asset_types ( code, name )
      `)
      .eq('status', 'active')
      .order('plate_number')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[assets] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки машин' }, { status: 500 })
  }
}
