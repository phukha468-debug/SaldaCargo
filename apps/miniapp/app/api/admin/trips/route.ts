/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/trips?filter=review|active|all */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';

  const supabase = createAdminClient();

  let query = supabase
    .from('trips')
    .select(
      `
      id, trip_number, status, lifecycle_status, started_at, ended_at, trip_type,
      driver:users!trips_driver_id_fkey(name),
      asset:assets(short_name, reg_number),
      trip_orders(amount, driver_pay, lifecycle_status),
      trip_expenses(amount)
    `,
    )
    .order('started_at', { ascending: false })
    .limit(50) as any;

  if (filter === 'review') {
    query = query.eq('status', 'completed').eq('lifecycle_status', 'draft');
  } else if (filter === 'active') {
    query = query.eq('status', 'in_progress');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
