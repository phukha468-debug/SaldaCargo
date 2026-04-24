import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const { periodId } = await request.json()

  // Получаем период, чтобы фильтровать рейсы по дате — иначе считаем всю историю
  let startDate: string | null = null
  let endDate: string | null = null

  if (periodId) {
    const { data: period } = await supabase
      .from('payroll_periods')
      .select('start_date, end_date')
      .eq('id', periodId)
      .single()

    startDate = period?.start_date ?? null
    endDate = period?.end_date ?? null
  }

  let query = supabase
    .from('trips')
    .select('driver_salary, loader_salary')
    .eq('lifecycle_status', 'approved')

  if (startDate) query = query.gte('started_at', startDate)
  if (endDate)   query = query.lte('started_at', endDate)

  const { data: trips, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = (trips || []).reduce(
    (s, t) => s + Number(t.driver_salary || 0) + Number(t.loader_salary || 0),
    0
  )

  return NextResponse.json({
    calculated: true,
    totalPayroll: total,
    count: trips?.length ?? 0,
  })
}
