/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** GET /api/driver/trips — история рейсов текущего водителя */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = cookieStore.get('salda_user_id')?.value;

  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('trips')
    .select(
      `id, trip_number, status, lifecycle_status, started_at, ended_at,
       asset:assets(short_name),
       trip_orders(amount, driver_pay, lifecycle_status)`,
    )
    .eq('driver_id', driverId)
    .eq('lifecycle_status', 'approved')
    .order('started_at', { ascending: false }) as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
