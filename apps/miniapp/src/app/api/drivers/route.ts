import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('role', ['driver', 'loader'])
      .eq('is_active', true)
      .order('full_name')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[drivers] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки персонала' }, { status: 500 })
  }
}
