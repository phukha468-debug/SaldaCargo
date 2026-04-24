import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('assets')
      .select(
        'id, plate_number, status, odometer_current, current_book_value, residual_value, ' +
        'remaining_life_months, notes, asset_type_id, business_unit_id, legal_entity_id, ' +
        'asset_types ( code, name )'
      )
      .order('plate_number', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Три запроса параллельно вместо последовательных
    const [
      { data: legal },
      { data: bu },
      { data: type },
    ] = await Promise.all([
      supabase.from('legal_entities').select('id').limit(1).single(),
      supabase.from('business_units').select('id').limit(1).single(),
      supabase.from('asset_types').select('id').limit(1).single(),
    ])

    if (!legal || !bu || !type) {
      return NextResponse.json({ error: 'Required relations not found' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('assets')
      .insert({
        plate_number: body.plate_number,
        notes: body.notes,
        status: body.status || 'active',
        odometer_current: Number(body.odometer_current) || 0,
        residual_value: Number(body.residual_value) || 0,
        legal_entity_id: legal.id,
        business_unit_id: bu.id,
        asset_type_id: type.id,
        remaining_life_months: Number(body.remaining_life_months) || 60,
      } as any)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}
