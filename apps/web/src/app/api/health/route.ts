import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('business_units')
      .select('code, name')
      .limit(3)

    if (error) throw error

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      sample: data
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
