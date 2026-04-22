import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('legal_entities')
      .select('id')
      .limit(1)

    if (error) throw error

    return NextResponse.json({
      isComplete: data && data.length > 0
    })
  } catch (error) {
    console.error('[setup/status] Error:', error)
    return NextResponse.json(
      { error: 'Ошибка проверки статуса' },
      { status: 500 }
    )
  }
}
