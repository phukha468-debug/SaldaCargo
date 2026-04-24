import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { Database } from '@saldacargo/shared-types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('assets')
      .select('*, asset_types(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('assets')
      .update({
        plate_number: body.plate_number,
        notes: body.notes,
        status: body.status,
        odometer_current: Number(body.odometer_current),
        residual_value: Number(body.residual_value),
      } as Database['public']['Tables']['assets']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as any).message }, { status: 500 })
  }
}
